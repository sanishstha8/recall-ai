from __future__ import annotations

from django.conf import settings
from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import services
from apps.accounts.serializers import (
    AccessTokenSerializer,
    AuthResponseSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RefreshRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from common.logging import bind_log_context
from common.throttles import AuthRateThrottle


class PublicAuthView(APIView):
    """Credential endpoints: no JWT required, but auth failures are still proper 401s."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'


def _set_refresh_cookie(response: Response, refresh: str) -> None:
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _auth_response(request, user, status_code=status.HTTP_200_OK) -> Response:
    access, refresh = services.issue_tokens(user)
    response = Response(
        {"access": access, "user": UserSerializer(user, context={"request": request}).data},
        status=status_code,
    )
    _set_refresh_cookie(response, refresh)
    return response


def _refresh_token_from(request) -> str | None:
    if body_token := request.data.get("refresh"):
        return body_token
    token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
    origin = request.headers.get("Origin")
    # Defence in depth on top of SameSite: a cookie may only be used from an allowed origin.
    if token and origin and origin not in settings.CORS_ALLOWED_ORIGINS:
        raise PermissionDenied("Origin not allowed.")
    return token


class RegisterView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=RegisterSerializer, responses={201: AuthResponseSerializer}, tags=["auth"])
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(**serializer.validated_data)
        return _auth_response(request, user, status.HTTP_201_CREATED)


class LoginView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=LoginSerializer, responses={200: AuthResponseSerializer}, tags=["auth"])
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"].strip().lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise AuthenticationFailed("Invalid email or password.")
        bind_log_context(user_id=user.pk)
        return _auth_response(request, user)


class RefreshView(PublicAuthView):
    @extend_schema(request=RefreshRequestSerializer, responses={200: AccessTokenSerializer}, tags=["auth"])
    def post(self, request):
        token = _refresh_token_from(request)
        if not token:
            raise AuthenticationFailed("No refresh token provided.", code="token_missing")
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise AuthenticationFailed(str(exc), code="token_not_valid") from exc
        response = Response({"access": serializer.validated_data["access"]})
        if new_refresh := serializer.validated_data.get("refresh"):
            _set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(PublicAuthView):
    @extend_schema(request=RefreshRequestSerializer, responses={204: None}, tags=["auth"])
    def post(self, request):
        token = _refresh_token_from(request)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # Already invalid or expired: logging out is still successful.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses=UserSerializer, tags=["auth"])
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer, tags=["auth"])
    def patch(self, request):
        serializer = UserSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=ChangePasswordSerializer, responses={204: None}, tags=["auth"])
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=PasswordResetRequestSerializer, responses={202: None}, tags=["auth"])
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.send_password_reset(serializer.validated_data["email"])
        return Response(
            {"detail": "If an account exists for that email, a reset link has been sent."},
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetConfirmView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=PasswordResetConfirmSerializer, responses={204: None}, tags=["auth"])
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm_password_reset(**serializer.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)
