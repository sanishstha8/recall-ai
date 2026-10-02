"""Retrieval-augmented generation pipeline.

question -> query embedding -> vector search (top-k) -> rerank -> context -> prompt -> local LLM
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from dataclasses import dataclass

from django.conf import settings

from apps.ai.providers import ChatMessage, GenerationResult, LLMProvider, StreamChunk, get_llm_provider
from apps.ai.rag.context_builder import Context, build_context
from apps.ai.rag.prompt_builder import build_messages
from apps.ai.rag.reranker import BaseReranker, get_reranker
from apps.ai.rag.retriever import BaseRetriever, RetrievalResult, get_retriever


@dataclass
class PreparedPrompt:
    messages: list[ChatMessage]
    context: Context
    retrieval: RetrievalResult | None


class RAGPipeline:
    def __init__(
        self,
        retriever: BaseRetriever | None = None,
        reranker: BaseReranker | None = None,
        llm: LLMProvider | None = None,
    ):
        self._retriever = retriever
        self.reranker = reranker or get_reranker()
        self.llm = llm or get_llm_provider()

    @property
    def retriever(self) -> BaseRetriever:
        # Lazy: no embedding provider is needed when there is nothing to search.
        if self._retriever is None:
            self._retriever = get_retriever()
        return self._retriever

    def retrieve_context(
        self,
        query: str,
        *,
        knowledge_base_ids: Iterable[int],
        document_ids: Iterable[int] | None = None,
        top_k: int | None = None,
        max_chunks: int | None = None,
    ) -> tuple[Context, RetrievalResult | None]:
        kb_ids = list(knowledge_base_ids)
        if not kb_ids:
            return Context(sources=[], text=""), None
        retrieval = self.retriever.retrieve(
            query,
            knowledge_base_ids=kb_ids,
            document_ids=document_ids,
            top_k=top_k or settings.RAG_TOP_K,
        )
        ranked = self.reranker.rerank(query, retrieval.chunks)
        return build_context(ranked, max_chunks=max_chunks), retrieval

    def prepare(
        self,
        question: str,
        *,
        knowledge_base_ids: Iterable[int],
        history: list[ChatMessage] | None = None,
        retrieval_query: str | None = None,
    ) -> PreparedPrompt:
        context, retrieval = self.retrieve_context(
            retrieval_query or question, knowledge_base_ids=knowledge_base_ids
        )
        return PreparedPrompt(
            messages=build_messages(question, context, history or []),
            context=context,
            retrieval=retrieval,
        )

    def generate(self, prepared: PreparedPrompt) -> GenerationResult:
        return self.llm.generate(prepared.messages)

    def stream(self, prepared: PreparedPrompt) -> Iterator[StreamChunk]:
        return self.llm.stream(prepared.messages)
