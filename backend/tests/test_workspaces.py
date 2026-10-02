import pytest

from apps.workspaces.models import Role, WorkspaceMember
from tests.conftest import client_for, workspace_of

pytestmark = pytest.mark.django_db


def test_list_only_own_workspaces(client, workspace, other_user):
    res = client.get("/api/v1/workspaces/")
    assert res.status_code == 200
    ids = [w["id"] for w in res.data["results"]]
    assert ids == [workspace.id]
    assert res.data["results"][0]["role"] == Role.OWNER
    assert res.data["results"][0]["member_count"] == 1


def test_create_workspace_makes_creator_owner(client, user):
    res = client.post("/api/v1/workspaces/", {"name": "Study Group"})
    assert res.status_code == 201
    assert res.data["role"] == Role.OWNER
    assert res.data["slug"] == "study-group"
    assert WorkspaceMember.objects.filter(workspace_id=res.data["id"], user=user, role=Role.OWNER).exists()


def test_cannot_read_other_users_workspace(client, other_user):
    other_ws = workspace_of(other_user)
    assert client.get(f"/api/v1/workspaces/{other_ws.id}/").status_code == 404
    assert client.patch(f"/api/v1/workspaces/{other_ws.id}/", {"name": "pwned"}).status_code == 404
    assert client.delete(f"/api/v1/workspaces/{other_ws.id}/").status_code == 404


def test_member_management_and_roles(client, workspace, other_user, make_user):
    res = client.post(
        f"/api/v1/workspaces/{workspace.id}/members/", {"email": other_user.email, "role": "VIEWER"}
    )
    assert res.status_code == 201
    member_id = res.data["id"]

    viewer = client_for(other_user)
    # Viewer can see the workspace and its members...
    assert viewer.get(f"/api/v1/workspaces/{workspace.id}/").status_code == 200
    assert viewer.get(f"/api/v1/workspaces/{workspace.id}/members/").status_code == 200
    # ...but cannot rename it or manage members.
    assert viewer.patch(f"/api/v1/workspaces/{workspace.id}/", {"name": "x"}).status_code == 403
    third = make_user()
    assert (
        viewer.post(f"/api/v1/workspaces/{workspace.id}/members/", {"email": third.email}).status_code == 403
    )

    # Promote to admin; admin may add members but never grant OWNER.
    assert (
        client.patch(f"/api/v1/workspaces/{workspace.id}/members/{member_id}/", {"role": "ADMIN"}).status_code
        == 200
    )
    res = viewer.post(f"/api/v1/workspaces/{workspace.id}/members/", {"email": third.email, "role": "OWNER"})
    assert res.status_code == 400

    # The owner cannot be removed or demoted.
    owner_member = WorkspaceMember.objects.get(workspace=workspace, role=Role.OWNER)
    assert viewer.delete(f"/api/v1/workspaces/{workspace.id}/members/{owner_member.id}/").status_code == 403
    assert (
        viewer.patch(
            f"/api/v1/workspaces/{workspace.id}/members/{owner_member.id}/", {"role": "VIEWER"}
        ).status_code
        == 403
    )


def test_member_can_leave(client, workspace, other_user):
    member = WorkspaceMember.objects.create(workspace=workspace, user=other_user, role=Role.VIEWER)
    res = client_for(other_user).delete(f"/api/v1/workspaces/{workspace.id}/members/{member.id}/")
    assert res.status_code == 204


def test_only_owner_can_delete_workspace(client, workspace, other_user):
    WorkspaceMember.objects.create(workspace=workspace, user=other_user, role=Role.ADMIN)
    assert client_for(other_user).delete(f"/api/v1/workspaces/{workspace.id}/").status_code == 403
    assert client.delete(f"/api/v1/workspaces/{workspace.id}/").status_code == 204


def test_add_unknown_email(client, workspace):
    res = client.post(f"/api/v1/workspaces/{workspace.id}/members/", {"email": "ghost@example.com"})
    assert res.status_code == 400
