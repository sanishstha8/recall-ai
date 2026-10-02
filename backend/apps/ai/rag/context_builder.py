"""Turn selected chunks into numbered SOURCE blocks within a token budget."""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

from apps.ai.rag.retriever import RetrievedChunk
from common.utils import estimate_tokens


@dataclass
class Source:
    index: int  # the [n] marker
    chunk: RetrievedChunk


@dataclass
class Context:
    sources: list[Source]
    text: str

    @property
    def is_empty(self) -> bool:
        return not self.sources


def build_context(
    chunks: list[RetrievedChunk],
    *,
    max_chunks: int | None = None,
    min_score: float | None = None,
    max_tokens: int | None = None,
) -> Context:
    max_chunks = max_chunks or settings.RAG_CONTEXT_CHUNKS
    min_score = settings.RAG_MIN_SCORE if min_score is None else min_score
    max_tokens = max_tokens or settings.RAG_CONTEXT_TOKENS

    sources: list[Source] = []
    blocks: list[str] = []
    used = 0
    for chunk in chunks:
        if len(sources) >= max_chunks:
            break
        if chunk.score < min_score:
            continue
        cost = estimate_tokens(chunk.content) + 20
        if sources and used + cost > max_tokens:
            break
        index = len(sources) + 1
        sources.append(Source(index=index, chunk=chunk))
        blocks.append(
            f"SOURCE {index}\nDocument: {chunk.document_name}\nPage: {chunk.page_number}\n\n"
            f"{chunk.content.strip()}"
        )
        used += cost
    return Context(sources=sources, text="\n\n---\n\n".join(blocks))
