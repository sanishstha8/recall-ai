"""Consistent API error envelope.

Every error response has the shape::

    {"error": {"code": "not_found", "message": "Not found.", "details": {...}, "request_id": "..."}}
"""

from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from common.logging import get_request_id

logger = logging.getLogger(__name__)


class ServiceError(exceptions.APIException):
    """Base class for domain errors raised from the service layer."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The request could not be completed."
    default_code = "service_error"


class AIServiceUnavailable(ServiceError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The local AI service is unavailable. Make sure Ollama is running."
    default_code = "ai_unavailable"


class AIServiceError(ServiceError):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "The local AI model returned an error."
    default_code = "ai_error"


class Conflict(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The resource is not in a valid state for this operation."
    default_code = "conflict"


def _first_message(detail) -> str:
    if isinstance(detail, list) and detail:
        return _first_message(detail[0])
    if isinstance(detail, dict) and detail:
        key, value = next(iter(detail.items()))
        message = _first_message(value)
        return message if key in ("non_field_errors", "detail") else f"{key}: {message}"
    return str(detail)


def api_exception_handler(exc, context):
    from apps.ai.providers.base import AIProviderError, AIProviderUnavailable

    if isinstance(exc, AIProviderUnavailable):
        exc = AIServiceUnavailable(f"{exc} Make sure Ollama is running.")
    elif isinstance(exc, AIProviderError):
        exc = AIServiceError(str(exc))
    elif isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("unhandled API error", extra={"operation": "api", "success": False})
        return Response(
            {
                "error": {
                    "code": "server_error",
                    "message": "An unexpected error occurred.",
                    "details": None,
                    "request_id": get_request_id(),
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, exceptions.ValidationError):
        code, details = "validation_error", response.data
        message = _first_message(response.data)
    else:
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        code = codes if isinstance(codes, str) else "error"
        details = None
        message = _first_message(response.data)

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": get_request_id(),
        }
    }
    return response
