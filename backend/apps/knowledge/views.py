from django.db.models import Count, Max, Q
from django.db.models.functions import Greatest
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.knowledge.selectors import scoped_knowledge_bases
from apps.knowledge.serializers import KnowledgeBaseSerializer
from common.permissions import CONTRIBUTE, MANAGE, VIEW, require_role


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("workspace", OpenApiTypes.INT, description="Filter by workspace id"),
            OpenApiParameter("search", OpenApiTypes.STR, description="Filter by name"),
        ]
    )
)
@extend_schema(tags=["knowledge-bases"])
class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    serializer_class = KnowledgeBaseSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = scoped_knowledge_bases(self.request.user).annotate(
            document_count=Count("documents", distinct=True),
            ready_document_count=Count("documents", filter=Q(documents__status="READY"), distinct=True),
            last_activity_at=Greatest("updated_at", Max("documents__updated_at")),
        )
        if workspace := self.request.query_params.get("workspace"):
            qs = qs.filter(workspace_id=workspace) if workspace.isdigit() else qs.none()
        if search := self.request.query_params.get("search"):
            qs = qs.filter(name__icontains=search.strip())
        return qs.order_by("-updated_at")

    def get_object(self):
        obj = super().get_object()
        minimum = {"PATCH": CONTRIBUTE, "DELETE": MANAGE}.get(self.request.method, VIEW)
        require_role(self.request.user, obj.workspace_id, minimum)
        return obj

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        require_role(request.user, serializer.validated_data["workspace"].pk, CONTRIBUTE)
        kb = serializer.save(created_by=request.user)
        return Response(
            self.get_serializer(self.get_queryset().get(pk=kb.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        kb = self.get_object()
        serializer = self.get_serializer(kb, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(self.get_queryset().get(pk=kb.pk)).data)
