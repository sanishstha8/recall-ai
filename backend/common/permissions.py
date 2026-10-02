"""Workspace authorization helpers.

Every workspace-scoped resource is authorized through the same chain::

    request.user -> workspace membership -> resource belongs to workspace -> role check

Non-members get 404 (not 403) so the existence of other workspaces' resources is
never revealed. Members with an insufficient role get 403.
"""

from __future__ import annotations

from django.db.models import QuerySet
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.workspaces.models import Role, WorkspaceMember
from common.logging import bind_log_context

# Capability -> minimum role.
VIEW = Role.VIEWER  # read workspace content, chat, search, study
CONTRIBUTE = Role.MEMBER  # create knowledge bases, upload documents
MANAGE = Role.ADMIN  # edit/delete any content, manage members
OWN = Role.OWNER  # delete workspace, transfer ownership


def member_workspace_ids(user) -> QuerySet:
    """Subquery of workspace ids the user belongs to. Use to scope every queryset."""
    return WorkspaceMember.objects.filter(user=user).values("workspace_id")


def get_membership(user, workspace_id) -> WorkspaceMember | None:
    if not user or not user.is_authenticated or workspace_id is None:
        return None
    return (
        WorkspaceMember.objects.select_related("workspace")
        .filter(user=user, workspace_id=workspace_id)
        .first()
    )


def require_role(user, workspace_id, minimum: str = VIEW) -> WorkspaceMember:
    membership = get_membership(user, workspace_id)
    if membership is None:
        raise NotFound("Workspace not found.")
    bind_log_context(workspace_id=workspace_id)
    if not membership.has_role(minimum):
        raise PermissionDenied("Your workspace role does not allow this action.")
    return membership
