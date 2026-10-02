from __future__ import annotations

from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.workspaces.models import ROLE_RANK, Role, Workspace, WorkspaceMember


def _unique_slug(name: str) -> str:
    base = slugify(name)[:120] or "workspace"
    slug, n = base, 2
    while Workspace.objects.filter(slug=slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


@transaction.atomic
def create_workspace(*, owner, name: str) -> Workspace:
    workspace = Workspace.objects.create(name=name.strip(), slug=_unique_slug(name), owner=owner)
    WorkspaceMember.objects.create(workspace=workspace, user=owner, role=Role.OWNER)
    return workspace


def update_workspace(workspace: Workspace, *, name: str | None = None) -> Workspace:
    if name is not None and name.strip() and name.strip() != workspace.name:
        workspace.name = name.strip()
        workspace.save(update_fields=["name", "updated_at"])
    return workspace


def add_member(*, workspace: Workspace, actor: WorkspaceMember, user, role: str) -> WorkspaceMember:
    if role == Role.OWNER:
        raise ValidationError({"role": "A workspace can only have one owner."})
    if ROLE_RANK[Role(role)] > ROLE_RANK[Role(actor.role)]:
        raise PermissionDenied("You cannot grant a role higher than your own.")
    if WorkspaceMember.objects.filter(workspace=workspace, user=user).exists():
        raise ValidationError({"email": "This user is already a member of the workspace."})
    return WorkspaceMember.objects.create(workspace=workspace, user=user, role=role)


def change_member_role(*, member: WorkspaceMember, actor: WorkspaceMember, role: str) -> WorkspaceMember:
    if member.role == Role.OWNER:
        raise PermissionDenied("The owner's role cannot be changed.")
    if role == Role.OWNER:
        raise ValidationError({"role": "A workspace can only have one owner."})
    if actor.role != Role.OWNER and (
        ROLE_RANK[Role(member.role)] >= ROLE_RANK[Role(actor.role)]
        or ROLE_RANK[Role(role)] > ROLE_RANK[Role(actor.role)]
    ):
        raise PermissionDenied("You cannot change the role of a member at or above your level.")
    member.role = role
    member.save(update_fields=["role"])
    return member


def remove_member(*, member: WorkspaceMember, actor: WorkspaceMember) -> None:
    if member.role == Role.OWNER:
        raise PermissionDenied("The workspace owner cannot be removed.")
    is_self = member.pk == actor.pk
    if (
        not is_self
        and actor.role != Role.OWNER
        and (ROLE_RANK[Role(member.role)] >= ROLE_RANK[Role(actor.role)])
    ):
        raise PermissionDenied("You cannot remove a member at or above your level.")
    member.delete()
