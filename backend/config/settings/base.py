"""Base settings shared by every environment.

All tunables come from environment variables (see the repository-level `.env.example`).
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BASE_DIR.parent

env = environ.Env()
# Load the repository-level .env for non-Docker runs. Real environment variables win.
for candidate in (REPO_ROOT / ".env", BASE_DIR / ".env"):
    if candidate.exists():
        environ.Env.read_env(str(candidate), overwrite=False)

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    # Local
    "apps.accounts",
    "apps.workspaces",
    "apps.knowledge",
    "apps.documents",
    "apps.conversations",
    "apps.ai",
    "apps.study",
    "apps.usage",
    "apps.health",
]

MIDDLEWARE = [
    "common.logging.RequestContextMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
MEDIA_URL = "/media/"

# Uploaded documents live in their own storage alias so the backend can be swapped
# (e.g. to django-storages S3) purely through configuration.
DOCUMENT_STORAGE_BACKEND = env(
    "DOCUMENT_STORAGE_BACKEND", default="django.core.files.storage.FileSystemStorage"
)
# Kept outside MEDIA_ROOT on purpose: documents are only ever served through the
# authenticated, workspace-scoped API, never as public media.
DOCUMENT_STORAGE_ROOT = Path(env("DOCUMENT_STORAGE_ROOT", default=str(BASE_DIR / "storage" / "documents")))
if DOCUMENT_STORAGE_BACKEND.endswith("FileSystemStorage"):
    DOCUMENT_STORAGE_OPTIONS = {"location": str(DOCUMENT_STORAGE_ROOT)}
else:
    DOCUMENT_STORAGE_OPTIONS = env.json("DOCUMENT_STORAGE_OPTIONS", default={})
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "documents": {"BACKEND": DOCUMENT_STORAGE_BACKEND, "OPTIONS": DOCUMENT_STORAGE_OPTIONS},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# --- Caching (throttling uses the cache) --------------------------------------
REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# --- REST framework ----------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("common.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="600/min"),
        "auth": env("THROTTLE_AUTH", default="10/min"),
        "ai": env("THROTTLE_AI", default="30/min"),
        "upload": env("THROTTLE_UPLOAD", default="30/min"),
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": SECRET_KEY,
}

# The refresh token never reaches JavaScript: it is stored in an httpOnly cookie
# scoped to the auth endpoints. The short-lived access token lives in memory only.
REFRESH_COOKIE_NAME = "recallai_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"
REFRESH_COOKIE_SECURE = env.bool("REFRESH_COOKIE_SECURE", default=not DEBUG)
REFRESH_COOKIE_SAMESITE = env("REFRESH_COOKIE_SAMESITE", default="Lax")

SPECTACULAR_SETTINGS = {
    "TITLE": "RecallAI API",
    "DESCRIPTION": (
        "Privacy-first local AI knowledge & study platform.\n\n"
        "Authenticate with `POST /api/v1/auth/login/` and send the returned access token as "
        "`Authorization: Bearer <token>`. The refresh token is set as an httpOnly cookie."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
}

# --- CORS / CSRF ---------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000"])
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# --- Uploads ----------------------------------------------------------------
MAX_UPLOAD_SIZE = env.int("MAX_UPLOAD_SIZE", default=25 * 1024 * 1024)
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# --- Celery -------------------------------------------------------------------
CELERY_BROKER_URL = REDIS_URL or "memory://"
CELERY_RESULT_BACKEND = None
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_TIME_LIMIT = env.int("CELERY_TASK_TIME_LIMIT", default=60 * 30)

# --- Local AI -------------------------------------------------------------------
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434").rstrip("/")
OLLAMA_CHAT_MODEL = env("OLLAMA_CHAT_MODEL", default="llama3.2:3b")
OLLAMA_EMBEDDING_MODEL = env("OLLAMA_EMBEDDING_MODEL", default="nomic-embed-text")
OLLAMA_REQUEST_TIMEOUT = env.float("OLLAMA_REQUEST_TIMEOUT", default=300.0)
OLLAMA_NUM_CTX = env.int("OLLAMA_NUM_CTX", default=8192)
OLLAMA_KEEP_ALIVE = env("OLLAMA_KEEP_ALIVE", default="10m")
EMBEDDING_DIMENSIONS = env.int("EMBEDDING_DIMENSIONS", default=768)
EMBEDDING_QUERY_PREFIX = env("EMBEDDING_QUERY_PREFIX", default="")
EMBEDDING_DOCUMENT_PREFIX = env("EMBEDDING_DOCUMENT_PREFIX", default="")
EMBEDDING_BATCH_SIZE = env.int("EMBEDDING_BATCH_SIZE", default=16)

# Dotted paths so alternative providers can be plugged in without code changes.
AI_LLM_PROVIDER = env("AI_LLM_PROVIDER", default="apps.ai.providers.ollama.OllamaProvider")
AI_EMBEDDING_PROVIDER = env(
    "AI_EMBEDDING_PROVIDER", default="apps.ai.providers.ollama.OllamaEmbeddingProvider"
)

# --- Chunking / retrieval --------------------------------------------------------
CHUNK_SIZE_TOKENS = env.int("CHUNK_SIZE_TOKENS", default=600)
CHUNK_OVERLAP_TOKENS = env.int("CHUNK_OVERLAP_TOKENS", default=80)
RAG_TOP_K = env.int("RAG_TOP_K", default=10)
RAG_CONTEXT_CHUNKS = env.int("RAG_CONTEXT_CHUNKS", default=5)
RAG_MIN_SCORE = env.float("RAG_MIN_SCORE", default=0.3)
RAG_RERANKER = env("RAG_RERANKER", default="apps.ai.rag.reranker.LexicalReranker")
RAG_HISTORY_MESSAGES = env.int("RAG_HISTORY_MESSAGES", default=6)
STUDY_CONTEXT_TOKENS = env.int("STUDY_CONTEXT_TOKENS", default=3500)

# --- Email (password reset). Console backend locally: no external service needed.
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="RecallAI <no-reply@recallai.local>")

# --- Logging ------------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_context": {"()": "common.logging.RequestContextFilter"}},
    "formatters": {
        "json": {"()": "common.logging.JSONFormatter"},
        "console": {
            "format": "%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s user=%(user_id)s] %(message)s"
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "filters": ["request_context"],
            "formatter": env("LOG_FORMAT", default="json"),
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
    },
}
