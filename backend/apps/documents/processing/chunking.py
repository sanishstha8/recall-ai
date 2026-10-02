"""Token-aware recursive chunking that never crosses page boundaries.

Keeping every chunk inside one page preserves the document -> page -> chunk lineage
that citations rely on.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

from common.utils import estimate_tokens

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")


@dataclass
class TextChunk:
    content: str
    page_number: int
    chunk_index: int
    token_count: int


def _split_units(text: str, max_tokens: int) -> list[str]:
    """Split text into units no larger than ``max_tokens``: paragraphs, sentences, then words."""
    units: list[str] = []
    for paragraph in (p.strip() for p in re.split(r"\n\s*\n", text)):
        if not paragraph:
            continue
        if estimate_tokens(paragraph) <= max_tokens:
            units.append(paragraph)
            continue
        for sentence in (s.strip() for s in _SENTENCE_END.split(paragraph)):
            if not sentence:
                continue
            if estimate_tokens(sentence) <= max_tokens:
                units.append(sentence)
                continue
            words, buffer = sentence.split(), []
            for word in words:
                buffer.append(word)
                if estimate_tokens(" ".join(buffer)) >= max_tokens:
                    units.append(" ".join(buffer))
                    buffer = []
            if buffer:
                units.append(" ".join(buffer))
    return units


def chunk_page(text: str, chunk_size: int, overlap: int) -> list[str]:
    units = _split_units(text, chunk_size)
    chunks: list[str] = []
    current: list[tuple[str, int]] = []
    current_tokens = 0
    for unit in units:
        tokens = estimate_tokens(unit)
        if current and current_tokens + tokens > chunk_size:
            chunks.append("\n\n".join(u for u, _ in current))
            # Carry trailing units into the next chunk as overlap.
            carried: list[tuple[str, int]] = []
            carried_tokens = 0
            for u, t in reversed(current):
                if carried_tokens + t > overlap:
                    break
                carried.insert(0, (u, t))
                carried_tokens += t
            current, current_tokens = carried, carried_tokens
        current.append((unit, tokens))
        current_tokens += tokens
    if current:
        last = "\n\n".join(u for u, _ in current)
        if not chunks or last != chunks[-1]:
            chunks.append(last)
    return chunks


def chunk_pages(
    pages: list[tuple[int, str]],
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[TextChunk]:
    chunk_size = chunk_size or settings.CHUNK_SIZE_TOKENS
    overlap = settings.CHUNK_OVERLAP_TOKENS if overlap is None else overlap
    if overlap >= chunk_size:
        raise ValueError("Chunk overlap must be smaller than the chunk size.")
    result: list[TextChunk] = []
    for page_number, text in pages:
        for content in chunk_page(text, chunk_size, overlap):
            result.append(
                TextChunk(
                    content=content,
                    page_number=page_number,
                    chunk_index=len(result),
                    token_count=estimate_tokens(content),
                )
            )
    return result
