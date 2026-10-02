"""Structured logging with per-request context (request_id, user_id, workspace_id).

Context is stored in ``contextvars`` so it follows the request through services,
including streaming generators executed after the view returns.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from contextvars import ContextVar
from typing import Any

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id: ContextVar[str | None] = ContextVar("user_id", default=None)
_workspace_id: ContextVar[str | None] = ContextVar("workspace_id", default=None)

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9\-]{8,64}$")
_RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}

logger = logging.getLogger("recallai.request")


def bind_log_context(*, user_id: Any = None, workspace_id: Any = None) -> None:
    if user_id is not None:
        _user_id.set(str(user_id))
    if workspace_id is not None:
        _workspace_id.set(str(workspace_id))


def get_request_id() -> str | None:
    return _request_id.get()


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get() or "-"
        record.user_id = _user_id.get() or "-"
        record.workspace_id = _workspace_id.get() or "-"
        return True


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in vars(record).items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class RequestContextMiddleware:
    """Assigns a request id, echoes it in ``X-Request-ID`` and logs request completion."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if _REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        tokens = (
            _request_id.set(request_id),
            _user_id.set(None),
            _workspace_id.set(None),
        )
        request.request_id = request_id
        started = time.perf_counter()
        try:
            response = self.get_response(request)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
        response["X-Request-ID"] = request_id
        if not request.path.startswith(("/static/", "/media/")):
            logger.info(
                "request completed",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "success": response.status_code < 400,
                },
            )
        if not getattr(response, "streaming", False):
            for var, token in zip((_request_id, _user_id, _workspace_id), tokens, strict=True):
                var.reset(token)
        return response
