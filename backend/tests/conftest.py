from __future__ import annotations

import itertools

import pytest
from rest_framework.test import APIClient

from apps.accounts.services import issue_tokens, register_user
from apps.workspaces.models import Role, WorkspaceMember
from tests.fakes import ScriptedLLMProvider

_counter = itertools.count()
PASSWORD = "Correct-Horse-42!"


@pytest.fixture(autouse=True)
def _isolate(settings, tmp_path):
    settings.DOCUMENT_STORAGE_ROOT = tmp_path / "documents"
    settings.STORAGES = {
        **settings.STORAGES,
        "documents": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(tmp_path / "documents")},
        },
    }
    settings.MEDIA_ROOT = tmp_path / "media"
    ScriptedLLMProvider.reset()
    yield


@pytest.fixture
def make_user(db):
    def _make(email: str | None = None, first_name: str = "Test"):
        email = email or f"user{next(_counter)}@example.com"
        return register_user(email=email, password=PASSWORD, first_name=first_name)

    return _make


@pytest.fixture
def user(make_user):
    return make_user()


@pytest.fixture
def other_user(make_user):
    return make_user(first_name="Mallory")


def workspace_of(user):
    return WorkspaceMember.objects.get(user=user, role=Role.OWNER).workspace


@pytest.fixture
def workspace(user):
    return workspace_of(user)


def client_for(user) -> APIClient:
    client = APIClient()
    access, _ = issue_tokens(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client


@pytest.fixture
def client(user):
    return client_for(user)


@pytest.fixture
def other_client(other_user):
    return client_for(other_user)


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def llm():
    return ScriptedLLMProvider
