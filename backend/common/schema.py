"""drf-spectacular extensions (imported from AccountsConfig.ready)."""

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class RecallJWTScheme(SimpleJWTScheme):
    target_class = "common.authentication.JWTAuthentication"
    name = "jwtAuth"
