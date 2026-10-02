from .base import *  # noqa: F403
from .base import REST_FRAMEWORK

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = "memory://"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
REFRESH_COOKIE_SECURE = False
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {k: "10000/min" for k in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]},
}
# Deterministic, offline providers for automated tests. The real Ollama providers are
# exercised separately in tests/test_ollama_provider.py against a mocked HTTP transport.
AI_LLM_PROVIDER = "tests.fakes.ScriptedLLMProvider"
AI_EMBEDDING_PROVIDER = "tests.fakes.HashingEmbeddingProvider"
LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"level": "WARNING"}}
# The hashing test embedder yields lower cosine scores than real embedding models.
RAG_MIN_SCORE = 0.05
