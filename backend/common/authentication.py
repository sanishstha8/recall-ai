from rest_framework_simplejwt.authentication import JWTAuthentication as _JWTAuthentication

from common.logging import bind_log_context


class JWTAuthentication(_JWTAuthentication):
    """SimpleJWT authentication that also binds the user id to the log context."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            bind_log_context(user_id=result[0].pk)
        return result
