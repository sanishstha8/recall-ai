"""The real Ollama providers, exercised against a mocked HTTP transport."""

import json
import re

import httpx
import pytest

from apps.ai.providers import AIProviderError, AIProviderUnavailable, ChatMessage
from apps.ai.providers.ollama import OllamaClient, OllamaEmbeddingProvider, OllamaProvider


def client_with(handler) -> OllamaClient:
    return OllamaClient(base_url="http://ollama.test", transport=httpx.MockTransport(handler))


def test_generate_sends_messages_and_reads_token_counts(settings):
    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "llama3.2:3b",
                "message": {"role": "assistant", "content": "Hello"},
                "prompt_eval_count": 12,
                "eval_count": 3,
                "done": True,
            },
        )

    provider = OllamaProvider(model="llama3.2:3b", client=client_with(handler))
    result = provider.generate([ChatMessage("user", "hi")], json_schema={"type": "object"})
    assert result.content == "Hello" and result.prompt_tokens == 12 and result.completion_tokens == 3
    assert seen["model"] == "llama3.2:3b" and seen["stream"] is False
    assert seen["format"] == {"type": "object"}
    assert seen["messages"] == [{"role": "user", "content": "hi"}]
    assert seen["options"]["num_ctx"] == settings.OLLAMA_NUM_CTX


def test_stream_parses_ndjson():
    lines = [
        {"message": {"content": "Nor"}, "done": False},
        {"message": {"content": "malization"}, "done": False},
        {"message": {"content": ""}, "done": True, "model": "m", "prompt_eval_count": 5, "eval_count": 2},
    ]

    def handler(request):
        return httpx.Response(200, content="\n".join(json.dumps(line) for line in lines).encode())

    chunks = list(OllamaProvider(model="m", client=client_with(handler)).stream([ChatMessage("user", "x")]))
    assert "".join(c.delta for c in chunks) == "Normalization"
    assert chunks[-1].done and chunks[-1].prompt_tokens == 5 and chunks[-1].completion_tokens == 2


def test_missing_model_error_is_actionable():
    def handler(request):
        return httpx.Response(404, json={"error": "model 'llama3.2:3b' not found"})

    with pytest.raises(AIProviderError, match=re.escape("ollama pull llama3.2:3b")):
        OllamaProvider(model="llama3.2:3b", client=client_with(handler)).generate([ChatMessage("user", "x")])


def test_unreachable_server_raises_unavailable():
    def handler(request):
        raise httpx.ConnectError("refused")

    with pytest.raises(AIProviderUnavailable):
        OllamaProvider(model="m", client=client_with(handler)).generate([ChatMessage("user", "x")])


def test_embeddings_validate_dimensions_and_apply_prefixes(settings):
    settings.EMBEDDING_DIMENSIONS = 3
    settings.EMBEDDING_DOCUMENT_PREFIX = "search_document: "
    settings.EMBEDDING_QUERY_PREFIX = "search_query: "
    inputs = []

    def handler(request):
        body = json.loads(request.content)
        inputs.extend(body["input"])
        return httpx.Response(
            200, json={"embeddings": [[0.1, 0.2, 0.3]] * len(body["input"]), "prompt_eval_count": 7}
        )

    provider = OllamaEmbeddingProvider(model="nomic-embed-text", client=client_with(handler))
    result = provider.embed_documents(["a", "b"])
    assert len(result.vectors) == 2 and result.prompt_tokens == 7
    provider.embed_query("q")
    assert inputs == ["search_document: a", "search_document: b", "search_query: q"]

    settings.EMBEDDING_DIMENSIONS = 768
    with pytest.raises(AIProviderError, match="768"):
        OllamaEmbeddingProvider(model="nomic-embed-text", client=client_with(handler)).embed_query("q")


def test_health_reports_missing_models(settings):
    settings.OLLAMA_CHAT_MODEL = "llama3.2:3b"
    settings.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"

    def handler(request):
        return httpx.Response(200, json={"models": [{"name": "nomic-embed-text:latest"}]})

    provider = OllamaProvider(client=client_with(handler))
    with pytest.raises(AIProviderError, match=re.escape("ollama pull llama3.2:3b")):
        provider.health()
