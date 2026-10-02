from django.conf import settings
from django.utils.module_loading import import_string

from apps.ai.providers.base import (
    AIProviderError,
    AIProviderUnavailable,
    ChatMessage,
    EmbeddingProvider,
    EmbeddingResult,
    GenerationResult,
    LLMProvider,
    StreamChunk,
)


def get_llm_provider() -> LLMProvider:
    return import_string(settings.AI_LLM_PROVIDER)()


def get_embedding_provider() -> EmbeddingProvider:
    return import_string(settings.AI_EMBEDDING_PROVIDER)()


__all__ = [
    "AIProviderError",
    "AIProviderUnavailable",
    "ChatMessage",
    "EmbeddingProvider",
    "EmbeddingResult",
    "GenerationResult",
    "LLMProvider",
    "StreamChunk",
    "get_embedding_provider",
    "get_llm_provider",
]
