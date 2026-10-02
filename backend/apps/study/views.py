from django.db.models import Count, F, FloatField, Max, Q
from django.db.models.functions import Cast
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.study import services
from apps.study.models import QuizAttempt, StudyKind, StudySet
from apps.study.serializers import (
    AttemptRequestSerializer,
    QuizAttemptSerializer,
    StudyRequestSerializer,
    StudySetListSerializer,
    StudySetSerializer,
)
from common.permissions import VIEW, member_workspace_ids, require_role
from common.throttles import AIRateThrottle


class StudyGenerateView(APIView):
    """Queue generation of study material. Poll ``GET /study/sets/{id}/`` until READY or FAILED."""

    kind: str = ""
    throttle_classes = [AIRateThrottle]

    def post(self, request):
        payload = StudyRequestSerializer(data=request.data, context={"request": request, "kind": self.kind})
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        require_role(request.user, data["knowledge_base"].workspace_id, VIEW)
        study_set = services.request_study_set(
            kind=self.kind,
            user=request.user,
            knowledge_base=data["knowledge_base"],
            document=data.get("document"),
            topic=data["topic"],
            count=data["count"],
            difficulty=data["difficulty"],
            time_limit_minutes=data.get("time_limit_minutes"),
            title=data["title"],
        )
        study_set.refresh_from_db()
        return Response(StudySetSerializer(study_set).data, status=status.HTTP_202_ACCEPTED)


def _generate_view(kind: str, description: str):
    class View(StudyGenerateView):
        @extend_schema(
            request=StudyRequestSerializer,
            responses={202: StudySetSerializer},
            tags=["study"],
            description=description + " Generation runs in the background.",
            operation_id=f"study_generate_{kind.lower()}",
        )
        def post(self, request):
            return super().post(request)

    View.kind = kind
    View.__name__ = View.__qualname__ = f"{kind.title().replace('_', '')}GenerateView"
    View.__doc__ = description
    return View


SummaryView = _generate_view(StudyKind.SUMMARY, "Generate a short summary, detailed summary and key points.")
FlashcardsView = _generate_view(StudyKind.FLASHCARDS, "Generate question/answer flashcards.")
QuizView = _generate_view(StudyKind.QUIZ, "Generate a multiple-choice quiz (A-D, answer, explanation).")
QuestionsView = _generate_view(StudyKind.QUESTIONS, "Generate short- and long-answer questions.")
MockExamView = _generate_view(
    StudyKind.MOCK_EXAM, "Generate a timed mock exam. Answers are revealed only after submission."
)


@extend_schema(tags=["study"])
class StudySetViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = StudySet.objects.none()
    http_method_names = ["get", "post", "patch", "delete"]

    def get_serializer_class(self):
        return StudySetListSerializer if self.action == "list" else StudySetSerializer

    def get_queryset(self):
        qs = (
            StudySet.objects.filter(
                user=self.request.user, workspace_id__in=member_workspace_ids(self.request.user)
            )
            .select_related("knowledge_base", "document")
            .annotate(
                attempt_count=Count("attempts", distinct=True),
                best_score=Max(
                    100.0
                    * Cast(F("attempts__score"), FloatField())
                    / Cast(F("attempts__total"), FloatField()),
                    filter=Q(attempts__total__gt=0),
                ),
            )
        )
        params = self.request.query_params
        if (kind := params.get("kind")) in StudyKind.values:
            qs = qs.filter(kind=kind)
        if (kb := params.get("knowledge_base", "")).isdigit():
            qs = qs.filter(knowledge_base_id=kb)
        if (workspace := params.get("workspace", "")).isdigit():
            qs = qs.filter(workspace_id=workspace)
        return qs.order_by("-created_at")

    def get_object(self):
        study_set = self.get_queryset().filter(pk=self.kwargs["pk"]).first()
        if study_set is None:
            raise NotFound("Study set not found.")
        return study_set

    @extend_schema(
        parameters=[
            OpenApiParameter("kind", OpenApiTypes.STR, enum=StudyKind.values),
            OpenApiParameter("knowledge_base", OpenApiTypes.INT),
            OpenApiParameter("workspace", OpenApiTypes.INT),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(methods=["GET"], responses=QuizAttemptSerializer(many=True))
    @extend_schema(
        methods=["POST"],
        request=AttemptRequestSerializer,
        responses={201: QuizAttemptSerializer},
        description="Submit answers for a quiz or mock exam. Scored on the server.",
    )
    @action(detail=True, methods=["get", "post"])
    def attempts(self, request, pk=None):
        study_set = self.get_object()
        if request.method == "GET":
            attempts = QuizAttempt.objects.filter(study_set=study_set, user=request.user)
            return Response(QuizAttemptSerializer(attempts, many=True).data)
        payload = AttemptRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        attempt = services.score_attempt(
            study_set=study_set,
            user=request.user,
            answers=payload.validated_data["answers"],
            duration_seconds=payload.validated_data["duration_seconds"],
        )
        return Response(QuizAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={202: StudySetSerializer})
    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        study_set = self.get_object()
        new_set = services.request_study_set(
            kind=study_set.kind,
            user=request.user,
            knowledge_base=study_set.knowledge_base,
            document=study_set.document,
            topic=study_set.topic,
            count=study_set.item_count,
            difficulty=study_set.difficulty,
            time_limit_minutes=study_set.time_limit_minutes,
            title=study_set.title,
        )
        new_set.refresh_from_db()
        return Response(StudySetSerializer(new_set).data, status=status.HTTP_202_ACCEPTED)
