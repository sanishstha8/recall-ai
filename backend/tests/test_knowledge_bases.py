import pytest

from apps.knowledge.models import KnowledgeBase
from apps.workspaces.models import Role, WorkspaceMember
from tests.conftest import client_for, workspace_of

pytestmark = pytest.mark.django_db


def test_create_and_list_knowledge_base(client, workspace):
    res = client.post(
        "/api/v1/knowledge-bases/",
        {
            "workspace": workspace.id,
            "name": "BSc CSIT",
            "description": "Semester notes",
            "icon": "graduation-cap",
        },
    )
    assert res.status_code == 201, res.data
    assert res.data["document_count"] == 0
    listing = client.get("/api/v1/knowledge-bases/", {"workspace": workspace.id})
    assert [kb["name"] for kb in listing.data["results"]] == ["BSc CSIT"]


def test_cannot_create_in_foreign_workspace(client, other_user):
    res = client.post(
        "/api/v1/knowledge-bases/", {"workspace": workspace_of(other_user).id, "name": "Sneaky"}
    )
    assert res.status_code == 404
    assert not KnowledgeBase.objects.filter(name="Sneaky").exists()


def test_cross_workspace_isolation(client, other_client, workspace):
    kb = KnowledgeBase.objects.create(workspace=workspace, name="Private")
    assert other_client.get("/api/v1/knowledge-bases/").data["results"] == []
    assert other_client.get(f"/api/v1/knowledge-bases/{kb.id}/").status_code == 404
    assert other_client.patch(f"/api/v1/knowledge-bases/{kb.id}/", {"name": "x"}).status_code == 404
    assert other_client.delete(f"/api/v1/knowledge-bases/{kb.id}/").status_code == 404
    kb.refresh_from_db()
    assert kb.name == "Private"


def test_workspace_cannot_be_changed(client, workspace, make_user):
    kb = KnowledgeBase.objects.create(workspace=workspace, name="Pinned")
    mine_too = client.post("/api/v1/workspaces/", {"name": "Second"}).data["id"]
    client.patch(f"/api/v1/knowledge-bases/{kb.id}/", {"workspace": mine_too})
    kb.refresh_from_db()
    assert kb.workspace_id == workspace.id


def test_role_permissions(workspace, other_user):
    kb = KnowledgeBase.objects.create(workspace=workspace, name="Shared")
    membership = WorkspaceMember.objects.create(workspace=workspace, user=other_user, role=Role.VIEWER)
    c = client_for(other_user)
    assert c.get(f"/api/v1/knowledge-bases/{kb.id}/").status_code == 200
    assert c.post("/api/v1/knowledge-bases/", {"workspace": workspace.id, "name": "n"}).status_code == 403
    assert c.patch(f"/api/v1/knowledge-bases/{kb.id}/", {"name": "n"}).status_code == 403

    membership.role = Role.MEMBER
    membership.save()
    assert c.patch(f"/api/v1/knowledge-bases/{kb.id}/", {"name": "Renamed"}).status_code == 200
    assert c.delete(f"/api/v1/knowledge-bases/{kb.id}/").status_code == 403

    membership.role = Role.ADMIN
    membership.save()
    assert c.delete(f"/api/v1/knowledge-bases/{kb.id}/").status_code == 204


def test_invalid_icon_rejected(client, workspace):
    res = client.post(
        "/api/v1/knowledge-bases/", {"workspace": workspace.id, "name": "x", "icon": "<script>"}
    )
    assert res.status_code == 400
