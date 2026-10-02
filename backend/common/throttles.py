from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """Per-IP limit for credential endpoints (login, register, password reset)."""

    scope = "auth"


class AIRateThrottle(UserRateThrottle):
    """Per-user limit for LLM-backed endpoints."""

    scope = "ai"


class UploadRateThrottle(UserRateThrottle):
    scope = "upload"
