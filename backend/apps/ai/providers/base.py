"""Provider-agnostic interfaces for local (or future remote) AI backends.

Nothing outside ``apps.ai.providers`` talks to a model server directly.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any, Literal

Role = Literal["system", "user", "assistant"]


class AIProviderError(Exception):
    """The provider returned an error (bad model name, invalid request, ...)."""

    def __init__(self, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class AIProviderUnavailable(AIProviderError):
    """The provider could not be reached at all."""

    def __init__(self, message: str):
        super().__init__(message, retryable=True)


@dataclass(frozen=True)
class ChatMessage:
    role: Role
    content: str


@dataclass
class GenerationResult:
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass
class StreamChunk:
    delta: str = ""
    done: bool = False
    model: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0


@dataclass
class EmbeddingResult:
    vectors: list[list[float]]
    model: str
    prompt_tokens: int = 0
    latency_ms: int = 0
    extra: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    model: str

    @abstractmethod
    def generate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.2,
        json_schema: dict | None = None,
        max_tokens: int | None = None,
    ) -> GenerationResult: ...

    @abstractmethod
    def stream(self, messages: list[ChatMessage], *, temperature: float = 0.2) -> Iterator[StreamChunk]: ...

    @abstractmethod
    def health(self) -> dict[str, Any]:
        """Return status details, or raise ``AIProviderError`` when not usable."""


class EmbeddingProvider(ABC):
    model: str
    dimensions: int

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> EmbeddingResult: ...

    @abstractmethod
    def embed_query(self, text: str) -> EmbeddingResult: ...
