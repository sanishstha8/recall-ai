from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conversations.models import Conversation, Message
from apps.documents.models import Document, DocumentStatus
from apps.health.views import check_ai, check_broker, check_database, run_check
from apps.usage.models import Operation, UsageRecord
from apps.workspaces.models import Workspace
from common.permissions import MANAGE, member_workspace_ids, require_role

SCOPE_PARAMS = [
    OpenApiParameter("workspace", OpenApiTypes.INT),
    OpenApiParameter(
        "scope",
        OpenApiTypes.STR,
        enum=["me", "workspace"],
        description="'workspace' shows every member's usage (admins only; requires workspace).",
    ),
    OpenApiParameter("operation", OpenApiTypes.STR, enum=Operation.values),
    OpenApiParameter("days", OpenApiTypes.INT, description="Look-back window (default 30)"),
]


class UsageRecordSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None)

    class Meta:
        model = UsageRecord
        fields = [
            "id",
            "workspace",
            "user",
            "user_email",
            "operation",
            "model",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "estimated_cost",
            "latency_ms",
            "success",
            "created_at",
        ]


def scoped_usage(request):
    params = request.query_params
    workspace = params.get("workspace", "")
    qs = UsageRecord.objects.filter(workspace_id__in=member_workspace_ids(request.user))
    if workspace.isdigit():
        qs = qs.filter(workspace_id=workspace)
        if params.get("scope") == "workspace":
            require_role(request.user, workspace, MANAGE)
        else:
            qs = qs.filter(user=request.user)
    else:
        qs = qs.filter(user=request.user)
    if (operation := params.get("operation")) in Operation.values:
        qs = qs.filter(operation=operation)
    days = int(params["days"]) if params.get("days", "").isdigit() else 30
    return qs.filter(created_at__gte=timezone.now() - timedelta(days=max(1, min(days, 365))))


@extend_schema(tags=["usage"], parameters=SCOPE_PARAMS)
class UsageListView(generics.ListAPIView):
    serializer_class = UsageRecordSerializer

    def get_queryset(self):
        return scoped_usage(self.request).select_related("user").order_by("-created_at")


@extend_schema(tags=["usage"], parameters=SCOPE_PARAMS, responses={200: OpenApiTypes.OBJECT})
class UsageSummaryView(APIView):
    def get(self, request):
        qs = scoped_usage(request)
        totals = qs.aggregate(
            requests=Count("id"),
            failures=Count("id", filter=Q(success=False)),
            input_tokens=Sum("input_tokens"),
            output_tokens=Sum("output_tokens"),
            total_tokens=Sum("total_tokens"),
            estimated_cost=Sum("estimated_cost"),
            avg_latency_ms=Avg("latency_ms"),
        )
        by_operation = list(
            qs.values("operation")
            .annotate(
                requests=Count("id"), total_tokens=Sum("total_tokens"), avg_latency_ms=Avg("latency_ms")
            )
            .order_by("-requests")
        )
        by_day = list(
            qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(requests=Count("id"), total_tokens=Sum("total_tokens"))
            .order_by("day")
        )
        by_model = list(
            qs.values("model")
            .annotate(requests=Count("id"), total_tokens=Sum("total_tokens"))
            .order_by("-requests")
        )
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            totals[key] = totals[key] or 0
        totals["estimated_cost"] = float(totals["estimated_cost"] or 0)
        totals["avg_latency_ms"] = round(totals["avg_latency_ms"] or 0)
        return Response(
            {"totals": totals, "by_operation": by_operation, "by_day": by_day, "by_model": by_model}
        )


@extend_schema(tags=["admin"], responses={200: OpenApiTypes.OBJECT})
class AdminAnalyticsView(APIView):
    """Platform-wide analytics for staff users."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        User = get_user_model()
        week_ago = timezone.now() - timedelta(days=7)
        failures = (
            Document.objects.filter(status=DocumentStatus.FAILED)
            .select_related("knowledge_base__workspace")
            .order_by("-updated_at")[:10]
        )
        return Response(
            {
                "totals": {
                    "users": User.objects.count(),
                    "active_users_7d": User.objects.filter(last_login__gte=week_ago).count(),
                    "workspaces": Workspace.objects.count(),
                    "documents": Document.objects.count(),
                    "conversations": Conversation.objects.count(),
                    "messages": Message.objects.count(),
                    "ai_requests": UsageRecord.objects.count(),
                    "ai_failures": UsageRecord.objects.filter(success=False).count(),
                    "processing_failures": Document.objects.filter(status=DocumentStatus.FAILED).count(),
                },
                "documents_by_status": dict(
                    Document.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n")
                ),
                "feature_usage": list(
                    UsageRecord.objects.values("operation")
                    .annotate(requests=Count("id"), total_tokens=Sum("total_tokens"))
                    .order_by("-requests")
                ),
                "recent_failures": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "workspace": d.knowledge_base.workspace.name,
                        "error": d.processing_error[:300],
                        "updated_at": d.updated_at,
                    }
                    for d in failures
                ],
                "recent_users": list(
                    User.objects.order_by("-created_at").values("id", "email", "created_at", "last_login")[
                        :10
                    ]
                ),
                "health": {
                    "database": run_check(check_database),
                    "broker": run_check(check_broker),
                    "ai": run_check(check_ai),
                },
            }
        )
