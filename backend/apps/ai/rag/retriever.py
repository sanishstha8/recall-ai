"""Semantic retrieval over pgvector, with an optional hybrid (vector + full-text) mode."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass, field
from functools import cache

from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db import connection, transaction
from pgvector.django import CosineDistance

from apps.ai.providers import EmbeddingProvider, get_embedding_provider
from apps.documents.models import DocumentChunk, DocumentStatus


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    document_name: str
    page_number: int
    chunk_index: int
    content: str
    score: float  # cosine similarity in [-1, 1]; higher is better
    rerank_score: float | None = None

    @property
    def final_score(self) -> float:
        return self.rerank_score if self.rerank_score is not None else self.score


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunk]
    embedding_model: str
    query_tokens: int = 0
    latency_ms: int = 0
    extra: dict = field(default_factory=dict)


@cache
def _pgvector_version() -> tuple[int, ...]:
    with connection.cursor() as cursor:
        cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        row = cursor.fetchone()
    return tuple(int(p) for p in row[0].split(".")) if row else (0,)


def _to_retrieved(chunk: DocumentChunk, score: float) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk.pk,
        document_id=chunk.document_id,
        document_name=chunk.document.name,
        page_number=chunk.page.page_number,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        score=round(float(score), 4),
    )


class BaseRetriever(ABC):
    @abstractmethod
    def retrieve(
        self,
        query: str,
        *,
        knowledge_base_ids: Iterable[int],
        document_ids: Iterable[int] | None = None,
        top_k: int | None = None,
    ) -> RetrievalResult: ...


class VectorRetriever(BaseRetriever):
    def __init__(self, embedder: EmbeddingProvider | None = None):
        self.embedder = embedder or get_embedding_provider()

    def base_queryset(self, knowledge_base_ids, document_ids):
        qs = DocumentChunk.objects.filter(
            knowledge_base_id__in=list(knowledge_base_ids),
            document__status=DocumentStatus.READY,
            embedding_model=self.embedder.model,
            embedding__isnull=False,
        )
        if document_ids:
            qs = qs.filter(document_id__in=list(document_ids))
        return qs.select_related("document", "page")

    def search_vector(self, vector, knowledge_base_ids, document_ids, top_k) -> list[RetrievedChunk]:
        qs = (
            self.base_queryset(knowledge_base_ids, document_ids)
            .annotate(distance=CosineDistance("embedding", vector))
            .order_by("distance")[:top_k]
        )
        with transaction.atomic(), connection.cursor() as cursor:
            # Widen the HNSW candidate list so post-filtering by knowledge base still
            # yields top_k rows; pgvector >= 0.8 can additionally scan iteratively.
            cursor.execute("SET LOCAL hnsw.ef_search = %s", [max(40, top_k * 4)])
            if _pgvector_version() >= (0, 8):
                cursor.execute("SET LOCAL hnsw.iterative_scan = relaxed_order")
            rows = list(qs)
        rows.sort(key=lambda c: c.distance)
        return [_to_retrieved(c, 1 - c.distance) for c in rows]

    def retrieve(self, query, *, knowledge_base_ids, document_ids=None, top_k=None) -> RetrievalResult:
        top_k = top_k or settings.RAG_TOP_K
        started = time.perf_counter()
        embedded = self.embedder.embed_query(query)
        chunks = self.search_vector(embedded.vectors[0], knowledge_base_ids, document_ids, top_k)
        return RetrievalResult(
            chunks=chunks,
            embedding_model=self.embedder.model,
            query_tokens=embedded.prompt_tokens,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class HybridRetriever(VectorRetriever):
    """Vector search + Postgres full-text search, merged with reciprocal rank fusion."""

    RRF_K = 60

    def search_text(self, query, knowledge_base_ids, document_ids, top_k) -> list[DocumentChunk]:
        ts_query = SearchQuery(query, config="english", search_type="websearch")
        return list(
            self.base_queryset(knowledge_base_ids, document_ids)
            .filter(search_vector=ts_query)
            .annotate(rank=SearchRank("search_vector", ts_query))
            .order_by("-rank")[:top_k]
        )

    def retrieve(self, query, *, knowledge_base_ids, document_ids=None, top_k=None) -> RetrievalResult:
        top_k = top_k or settings.RAG_TOP_K
        started = time.perf_counter()
        embedded = self.embedder.embed_query(query)
        vector_hits = self.search_vector(embedded.vectors[0], knowledge_base_ids, document_ids, top_k)
        text_hits = self.search_text(query, knowledge_base_ids, document_ids, top_k)

        fused: dict[int, float] = {}
        for rank, hit in enumerate(vector_hits):
            fused[hit.chunk_id] = fused.get(hit.chunk_id, 0) + 1 / (self.RRF_K + rank + 1)
        for rank, chunk in enumerate(text_hits):
            fused[chunk.pk] = fused.get(chunk.pk, 0) + 1 / (self.RRF_K + rank + 1)

        by_id = {hit.chunk_id: hit for hit in vector_hits}
        missing = [c for c in text_hits if c.pk not in by_id]
        if missing:
            # Text-only hits still need a real cosine score for thresholds and display.
            scored = (
                DocumentChunk.objects.filter(pk__in=[c.pk for c in missing])
                .annotate(distance=CosineDistance("embedding", embedded.vectors[0]))
                .select_related("document", "page")
            )
            for chunk in scored:
                by_id[chunk.pk] = _to_retrieved(chunk, 1 - chunk.distance)

        ordered = sorted(fused, key=fused.get, reverse=True)[:top_k]
        return RetrievalResult(
            chunks=[by_id[i] for i in ordered],
            embedding_model=self.embedder.model,
            query_tokens=embedded.prompt_tokens,
            latency_ms=int((time.perf_counter() - started) * 1000),
            extra={"text_hits": len(text_hits)},
        )


def get_retriever() -> BaseRetriever:
    return HybridRetriever() if settings.RAG_RETRIEVER == "hybrid" else VectorRetriever()
