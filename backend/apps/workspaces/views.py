from django.db.models import Count, OuterRef, Subquery
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from apps.workspaces import services
from apps.workspaces.models import Workspace, WorkspaceMember
from apps.workspaces.serializers import (
    AddMemberSerializer,
    UpdateMemberSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)
from common.permissions import MANAGE, OWN, VIEW, member_workspace_ids, require_role


@extend_schema(tags=["workspaces"])
class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        user = self.request.user
        role = WorkspaceMember.objects.filter(workspace=OuterRef("pk"), user=user).values("role")[:1]
        return (
            Workspace.objects.filter(pk__in=member_workspace_ids(user))
            .annotate(
                role=Subquery(role),
                member_count=Count("memberships", distinct=True),
                knowledge_base_count=Count("knowledge_bases", distinct=True),
            )
            .order_by("created_at")
        )

    def perform_create(self, serializer):
        serializer.instance = services.create_workspace(
            owner=self.request.user, name=serializer.validated_data["name"]
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.get_queryset().get(pk=serializer.instance.pk)
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        workspace = self.get_object()
        require_role(request.user, workspace.pk, MANAGE)
        serializer = self.get_serializer(workspace, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_workspace(workspace, name=serializer.validated_data.get("name"))
        return Response(self.get_serializer(self.get_queryset().get(pk=workspace.pk)).data)

    def destroy(self, request, *args, **kwargs):
        workspace = self.get_object()
        require_role(request.user, workspace.pk, OWN)
        workspace.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["workspaces"])
class WorkspaceMemberViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = WorkspaceMemberSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def _actor(self, minimum=VIEW) -> WorkspaceMember:
        return require_role(self.request.user, self.kwargs["workspace_pk"], minimum)

    def get_queryset(self):
        self._actor()
        return WorkspaceMember.objects.filter(workspace_id=self.kwargs["workspace_pk"]).select_related("user")

    @extend_schema(request=AddMemberSerializer, responses={201: WorkspaceMemberSerializer})
    def create(self, request, *args, **kwargs):
        actor = self._actor(MANAGE)
        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = services.add_member(
            workspace=actor.workspace,
            actor=actor,
            user=serializer.validated_data["email"],
            role=serializer.validated_data["role"],
        )
        return Response(WorkspaceMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=UpdateMemberSerializer, responses=WorkspaceMemberSerializer)
    def partial_update(self, request, *args, **kwargs):
        actor = self._actor(MANAGE)
        member = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        serializer = UpdateMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = services.change_member_role(
            member=member, actor=actor, role=serializer.validated_data["role"]
        )
        return Response(WorkspaceMemberSerializer(member).data)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        actor = self._actor()
        member = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        if member.pk != actor.pk:
            actor = self._actor(MANAGE)
        services.remove_member(member=member, actor=actor)
        return Response(status=status.HTTP_204_NO_CONTENT)
