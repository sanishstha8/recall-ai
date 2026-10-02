from __future__ import annotations

import logging

from apps.usage.models import UsageRecord

logger = logging.getLogger("recallai.ai")


def record_usage(
    *,
    workspace_id: int,
    user_id: int | None,
    operation: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
    success: bool = True,
) -> UsageRecord:
    """Persist an AI usage record and emit a structured AI-operation log line."""
    record = UsageRecord.objects.create(
        workspace_id=workspace_id,
        user_id=user_id,
        operation=operation,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        estimated_cost=0,  # local inference
        latency_ms=latency_ms,
        success=success,
    )
    logger.info(
        "ai operation",
        extra={
            "operation": operation,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "latency_ms": latency_ms,
            "success": success,
            "workspace_id": workspace_id,
        },
    )
    return record
