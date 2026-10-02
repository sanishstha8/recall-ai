import re

import pytest
from django.conf import settings
from django.core import mail

from apps.workspaces.models import Role, WorkspaceMember
from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_register_creates_user_workspace_and_sets_refresh_cookie(anon_client):
    res = anon_client.post(
        "/api/v1/auth/register/",
        {"email": "Ada@Example.com", "password": PASSWORD, "first_name": "Ada"},
    )
    assert res.status_code == 201, res.data
    assert res.data["access"]
    assert res.data["user"]["email"] == "ada@example.com"
    assert "password" not in res.data["user"]

    cookie = res.cookies[settings.REFRESH_COOKIE_NAME]
    assert cookie["httponly"]
    assert cookie["path"] == settings.REFRESH_COOKIE_PATH
    # The refresh token is never exposed to JavaScript in the body.
    assert "refresh" not in res.data

    membership = WorkspaceMember.objects.get(user__email="ada@example.com")
    assert membership.role == Role.OWNER
    assert membership.workspace.name == "Ada's Workspace"


def test_register_rejects_duplicate_email_case_insensitive(anon_client, user):
    res = anon_client.post("/api/v1/auth/register/", {"email": user.email.upper(), "password": PASSWORD})
    assert res.status_code == 400
    assert res.data["error"]["code"] == "validation_error"
    assert "email" in res.data["error"]["details"]


def test_register_rejects_weak_password(anon_client):
    res = anon_client.post("/api/v1/auth/register/", {"email": "x@example.com", "password": "123"})
    assert res.status_code == 400


def test_password_is_hashed(user):
    assert user.password != PASSWORD
    assert user.check_password(PASSWORD)


def test_login_and_me(anon_client, user):
    res = anon_client.post("/api/v1/auth/login/", {"email": user.email, "password": PASSWORD})
    assert res.status_code == 200
    anon_client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    me = anon_client.get("/api/v1/auth/me/")
    assert me.status_code == 200
    assert me.data["email"] == user.email


def test_login_wrong_password(anon_client, user):
    res = anon_client.post("/api/v1/auth/login/", {"email": user.email, "password": "nope-nope"})
    assert res.status_code == 401
    assert res.data["error"]["message"] == "Invalid email or password."


def test_me_requires_auth(anon_client):
    res = anon_client.get("/api/v1/auth/me/")
    assert res.status_code == 401
    assert res.data["error"]["code"] == "not_authenticated"


def test_refresh_uses_cookie_and_rotates(anon_client, user):
    login = anon_client.post("/api/v1/auth/login/", {"email": user.email, "password": PASSWORD})
    old_refresh = login.cookies[settings.REFRESH_COOKIE_NAME].value
    res = anon_client.post("/api/v1/auth/refresh/")
    assert res.status_code == 200
    assert res.data["access"]
    new_refresh = res.cookies[settings.REFRESH_COOKIE_NAME].value
    assert new_refresh != old_refresh
    # The rotated-out token is blacklisted.
    reuse = anon_client.post("/api/v1/auth/refresh/", {"refresh": old_refresh})
    assert reuse.status_code == 401


def test_refresh_without_token(anon_client):
    res = anon_client.post("/api/v1/auth/refresh/")
    assert res.status_code == 401


def test_logout_blacklists_refresh_token(anon_client, user):
    login = anon_client.post("/api/v1/auth/login/", {"email": user.email, "password": PASSWORD})
    refresh = login.cookies[settings.REFRESH_COOKIE_NAME].value
    res = anon_client.post("/api/v1/auth/logout/")
    assert res.status_code == 204
    assert res.cookies[settings.REFRESH_COOKIE_NAME].value == ""
    assert anon_client.post("/api/v1/auth/refresh/", {"refresh": refresh}).status_code == 401


def test_update_profile(client):
    res = client.patch("/api/v1/auth/me/", {"first_name": "Grace", "email": "evil@example.com"})
    assert res.status_code == 200
    assert res.data["first_name"] == "Grace"
    assert res.data["email"] != "evil@example.com"  # email is read-only


def test_change_password(client, user):
    res = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": PASSWORD, "new_password": "An0ther-Strong-Pass"},
    )
    assert res.status_code == 204
    user.refresh_from_db()
    assert user.check_password("An0ther-Strong-Pass")


def test_password_reset_flow(anon_client, user):
    res = anon_client.post("/api/v1/auth/password-reset/", {"email": user.email})
    assert res.status_code == 202
    assert len(mail.outbox) == 1
    match = re.search(r"uid=([\w-]+)&token=([\w-]+)", mail.outbox[0].body)
    uid, token = match.groups()
    res = anon_client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "Brand-New-Pass-9"},
    )
    assert res.status_code == 204
    user.refresh_from_db()
    assert user.check_password("Brand-New-Pass-9")
    # Tokens are single-use.
    again = anon_client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "Brand-New-Pass-10"},
    )
    assert again.status_code == 400


def test_password_reset_unknown_email_does_not_leak(anon_client):
    res = anon_client.post("/api/v1/auth/password-reset/", {"email": "nobody@example.com"})
    assert res.status_code == 202
    assert len(mail.outbox) == 0
