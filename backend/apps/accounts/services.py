from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.workspaces.services import create_workspace

User = get_user_model()
logger = logging.getLogger(__name__)


@transaction.atomic
def register_user(*, email: str, password: str, first_name: str = "", last_name: str = ""):
    user = User.objects.create_user(
        email=email, password=password, first_name=first_name, last_name=last_name
    )
    label = f"{first_name.strip()}'s Workspace" if first_name.strip() else "Personal Workspace"
    create_workspace(owner=user, name=label)
    logger.info("user registered", extra={"operation": "register", "user_id": user.pk})
    return user


def issue_tokens(user) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


def send_password_reset(email: str) -> None:
    """Email a reset link. Silently does nothing for unknown emails (no account enumeration)."""
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user is None:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    send_mail(
        subject="Reset your RecallAI password",
        message=(
            "Someone requested a password reset for your RecallAI account.\n\n"
            f"Reset your password: {link}\n\n"
            "If this wasn't you, you can ignore this email."
        ),
        from_email=None,
        recipient_list=[user.email],
    )
    logger.info("password reset requested", extra={"operation": "password_reset", "user_id": user.pk})


def confirm_password_reset(*, uid: str, token: str, new_password: str) -> None:
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        user = None
    if user is None or not default_token_generator.check_token(user, token):
        raise ValidationError({"token": "This reset link is invalid or has expired."})
    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
