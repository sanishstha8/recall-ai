"""Offline test doubles for the AI provider interfaces.

They sit exactly at the provider boundary, so everything above it (chunking, pgvector
storage and search, RAG prompt building, citations, streaming, study parsing) runs for
real in tests without needing an Ollama server.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import deque
from collections.abc import Iterator

from django.conf import settings

from apps.ai.providers.base import (
    ChatMessage,
    EmbeddingProvider,
    EmbeddingResult,
    GenerationResult,
    LLMProvider,
    StreamChunk,
)

_TOKEN = re.compile(r"[a-z0-9]+")


class HashingEmbeddingProvider(EmbeddingProvider):
    """Feature-hashing bag-of-words embeddings: lexically similar texts get similar vectors."""

    model = "test-hashing-embedder"

    def __init__(self):
        self.dimensions = settings.EMBEDDING_DIMENSIONS

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dimensions
        for token in _TOKEN.findall(text.lower()):
            digest = hashlib.md5(token.encode()).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimensions
            vec[index] += 1.0 if digest[4] % 2 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> EmbeddingResult:
        return EmbeddingResult(
            vectors=[self._vector(t) for t in texts],
            model=self.model,
            prompt_tokens=sum(len(t.split()) for t in texts),
        )

    def embed_query(self, text: str) -> EmbeddingResult:
        return EmbeddingResult(
            vectors=[self._vector(text)], model=self.model, prompt_tokens=len(text.split())
        )


class ScriptedLLMProvider(LLMProvider):
    """Returns queued responses; records every prompt it receives for assertions."""

    model = "test-scripted-llm"
    responses: deque[str] = deque()
    calls: list[list[ChatMessage]] = []

    @classmethod
    def reset(cls) -> None:
        cls.responses = deque()
        cls.calls = []

    @classmethod
    def queue(cls, *responses: str | dict) -> None:
        for r in responses:
            cls.responses.append(r if isinstance(r, str) else json.dumps(r))

    def _next(self) -> str:
        if self.responses:
            return self.responses.popleft()
        return "According to the provided documents, this is the answer [1]."

    def generate(self, messages, *, temperature=0.2, json_schema=None, max_tokens=None):
        type(self).calls.append(list(messages))
        content = self._next()
        return GenerationResult(
            content=content,
            model=self.model,
            prompt_tokens=sum(len(m.content.split()) for m in messages),
            completion_tokens=len(content.split()),
            latency_ms=1,
        )

    def stream(self, messages, *, temperature=0.2) -> Iterator[StreamChunk]:
        type(self).calls.append(list(messages))
        content = self._next()
        words = content.split(" ")
        for i, word in enumerate(words):
            yield StreamChunk(delta=word if i == 0 else f" {word}", model=self.model)
        yield StreamChunk(
            done=True,
            model=self.model,
            prompt_tokens=sum(len(m.content.split()) for m in messages),
            completion_tokens=len(words),
        )

    def health(self):
        return {"provider": "scripted"}
