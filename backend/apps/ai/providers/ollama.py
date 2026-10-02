"""Ollama-backed providers (https://github.com/ollama/ollama/blob/main/docs/api.md)."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import httpx
from django.conf import settings

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

logger = logging.getLogger(__name__)


def _model_matches(wanted: str, available: str) -> bool:
    if ":" not in wanted:
        wanted = f"{wanted}:latest"
    return available == wanted


class OllamaClient:
    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | None = None,
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.http = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout or settings.OLLAMA_REQUEST_TIMEOUT, connect=5.0),
            transport=transport,
        )

    def _error(self, response: httpx.Response, model: str) -> AIProviderError:
        try:
            message = response.json().get("error", response.text)
        except ValueError:
            message = response.text
        if response.status_code == 404 and "not found" in message.lower():
            return AIProviderError(
                f"Model '{model}' is not available in Ollama. Pull it with: ollama pull {model}"
            )
        return AIProviderError(
            f"Ollama error ({response.status_code}): {message[:300]}",
            retryable=response.status_code >= 500,
        )

    def post(self, path: str, payload: dict, *, model: str) -> dict:
        try:
            response = self.http.post(path, json=payload)
        except httpx.TimeoutException as exc:
            raise AIProviderError("The local model timed out.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise AIProviderUnavailable(f"Cannot reach Ollama at {self.base_url}.") from exc
        if response.status_code != 200:
            raise self._error(response, model)
        return response.json()

    def stream(self, path: str, payload: dict, *, model: str) -> Iterator[dict]:
        try:
            with self.http.stream("POST", path, json=payload) as response:
                if response.status_code != 200:
                    response.read()
                    raise self._error(response, model)
                for line in response.iter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    if "error" in data:
                        raise AIProviderError(f"Ollama error: {data['error']}")
                    yield data
        except httpx.TimeoutException as exc:
            raise AIProviderError("The local model timed out.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise AIProviderUnavailable(f"Cannot reach Ollama at {self.base_url}.") from exc

    def list_models(self) -> list[str]:
        try:
            response = self.http.get("/api/tags", timeout=5.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AIProviderUnavailable(f"Cannot reach Ollama at {self.base_url}.") from exc
        return [m["name"] for m in response.json().get("models", [])]


class OllamaProvider(LLMProvider):
    def __init__(self, model: str | None = None, client: OllamaClient | None = None):
        self.model = model or settings.OLLAMA_CHAT_MODEL
        self.client = client or OllamaClient()

    def _payload(self, messages: list[ChatMessage], *, stream: bool, temperature: float) -> dict:
        return {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
            "options": {"temperature": temperature, "num_ctx": settings.OLLAMA_NUM_CTX},
        }

    def generate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.2,
        json_schema: dict | None = None,
        max_tokens: int | None = None,
    ) -> GenerationResult:
        payload = self._payload(messages, stream=False, temperature=temperature)
        if json_schema is not None:
            payload["format"] = json_schema  # Ollama structured outputs
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        started = time.perf_counter()
        data = self.client.post("/api/chat", payload, model=self.model)
        return GenerationResult(
            content=data.get("message", {}).get("content", ""),
            model=data.get("model", self.model),
            prompt_tokens=data.get("prompt_eval_count", 0) or 0,
            completion_tokens=data.get("eval_count", 0) or 0,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    def stream(self, messages: list[ChatMessage], *, temperature: float = 0.2) -> Iterator[StreamChunk]:
        payload = self._payload(messages, stream=True, temperature=temperature)
        for data in self.client.stream("/api/chat", payload, model=self.model):
            if data.get("done"):
                yield StreamChunk(
                    delta=data.get("message", {}).get("content", ""),
                    done=True,
                    model=data.get("model", self.model),
                    prompt_tokens=data.get("prompt_eval_count", 0) or 0,
                    completion_tokens=data.get("eval_count", 0) or 0,
                )
                return
            yield StreamChunk(delta=data.get("message", {}).get("content", ""), model=self.model)

    def health(self) -> dict[str, Any]:
        models = self.client.list_models()
        required = {
            "chat_model": settings.OLLAMA_CHAT_MODEL,
            "embedding_model": settings.OLLAMA_EMBEDDING_MODEL,
        }
        missing = [name for name in required.values() if not any(_model_matches(name, m) for m in models)]
        if missing:
            raise AIProviderError(
                "Ollama is running but these models are not pulled: "
                + ", ".join(missing)
                + ". Run: "
                + " && ".join(f"ollama pull {m}" for m in missing)
            )
        return {"provider": "ollama", **required, "installed_models": models}


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str | None = None, client: OllamaClient | None = None):
        self.model = model or settings.OLLAMA_EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self.client = client or OllamaClient()

    def _embed(self, inputs: list[str]) -> EmbeddingResult:
        started = time.perf_counter()
        data = self.client.post(
            "/api/embed",
            {
                "model": self.model,
                "input": inputs,
                "truncate": True,
                "keep_alive": settings.OLLAMA_KEEP_ALIVE,
            },
            model=self.model,
        )
        vectors = data.get("embeddings") or []
        if len(vectors) != len(inputs):
            raise AIProviderError("Ollama returned an unexpected number of embeddings.")
        for vector in vectors:
            if len(vector) != self.dimensions:
                raise AIProviderError(
                    f"Embedding model '{self.model}' returned {len(vector)} dimensions but "
                    f"EMBEDDING_DIMENSIONS is {self.dimensions}. Update the setting (and re-run "
                    "migrations) or switch embedding model."
                )
        return EmbeddingResult(
            vectors=vectors,
            model=self.model,
            prompt_tokens=data.get("prompt_eval_count", 0) or 0,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    def embed_documents(self, texts: list[str]) -> EmbeddingResult:
        prefix = settings.EMBEDDING_DOCUMENT_PREFIX
        return self._embed([f"{prefix}{t}" for t in texts])

    def embed_query(self, text: str) -> EmbeddingResult:
        return self._embed([f"{settings.EMBEDDING_QUERY_PREFIX}{text}"])
