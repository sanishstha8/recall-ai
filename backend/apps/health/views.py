from __future__ import annotations

import time

from django.conf import settings
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.providers import get_llm_provider


def run_check(fn) -> dict:
    started = time.perf_counter()
    try:
        detail = fn()
        ok = True
    except Exception as exc:
        detail, ok = str(exc)[:300], False
    return {"ok": ok, "latency_ms": round((time.perf_counter() - started) * 1000, 1), "detail": detail}


def check_database() -> str:
    with connection.cursor() as cursor:
        cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        row = cursor.fetchone()
    if row is None:
        raise RuntimeError("pgvector extension is not installed")
    return f"pgvector {row[0]}"


def check_broker() -> str:
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return "eager mode (tasks run inline)"
    import redis

    redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2).ping()
    return "redis reachable"


def check_ai() -> dict:
    return get_llm_provider().health()


class HealthView(APIView):
    """Liveness probe: the process is up and serving requests."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes: list = []

    @extend_schema(tags=["health"], responses={200: dict})
    def get(self, request):
        return Response({"status": "ok", "service": "recallai-backend"})


class ReadinessView(APIView):
    """Readiness probe: database, broker and local AI dependencies."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes: list = []

    @extend_schema(tags=["health"], responses={200: dict, 503: dict})
    def get(self, request):
        checks = {
            "database": run_check(check_database),
            "broker": run_check(check_broker),
            "ai": run_check(check_ai),
        }
        ready = all(c["ok"] for c in checks.values())
        return Response(
            {"status": "ready" if ready else "degraded", "checks": checks},
            status=200 if ready else 503,
        )
