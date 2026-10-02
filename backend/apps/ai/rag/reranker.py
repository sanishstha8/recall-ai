"""Second-stage selection of retrieved chunks."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod

from django.conf import settings
from django.utils.module_loading import import_string

from apps.ai.rag.retriever import RetrievedChunk

_WORD = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    """
    a an and are as at be by can do does explain for from give how i in is it me of on or
    please tell that the their them this to was what when where which who why with you your
    """.split()
)


def _terms(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in _STOPWORDS and len(w) > 1}


class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]: ...


class NoopReranker(BaseReranker):
    def rerank(self, query, chunks):
        return sorted(chunks, key=lambda c: c.score, reverse=True)


class LexicalReranker(BaseReranker):
    """Blend vector similarity with query-term coverage, and drop near-duplicate overlap chunks.

    Cheap and deterministic; a cross-encoder can be plugged in via ``RAG_RERANKER``.
    """

    def __init__(self, vector_weight: float = 0.8):
        self.vector_weight = vector_weight

    def rerank(self, query, chunks):
        query_terms = _terms(query)
        for chunk in chunks:
            coverage = len(query_terms & _terms(chunk.content)) / len(query_terms) if query_terms else 0.0
            chunk.rerank_score = round(
                self.vector_weight * chunk.score + (1 - self.vector_weight) * coverage, 4
            )
        ranked = sorted(chunks, key=lambda c: c.final_score, reverse=True)

        selected: list[RetrievedChunk] = []
        for chunk in ranked:
            # Chunks from the same page overlap by design; skip ones mostly contained in another.
            if any(
                other.document_id == chunk.document_id
                and other.page_number == chunk.page_number
                and _overlap_ratio(chunk.content, other.content) > 0.6
                for other in selected
            ):
                continue
            selected.append(chunk)
        return selected


def _overlap_ratio(a: str, b: str) -> float:
    ta, tb = set(_WORD.findall(a.lower())), set(_WORD.findall(b.lower()))
    return len(ta & tb) / min(len(ta), len(tb)) if ta and tb else 0.0


def get_reranker() -> BaseReranker:
    return import_string(settings.RAG_RERANKER)()
