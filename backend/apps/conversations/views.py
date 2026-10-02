from __future__ import annotations

import json

from django.db.models import Count, OuterRef, Prefetch, Subquery
from django.db.models.functions import Left
from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.ai.services import ChatService
from apps.conversations.models import Citation, Conversation, Message
from apps.conversations.serializers import (
    ChatTurnSerializer,
    ConversationSerializer,
    MessageSerializer,
    SendMessageSerializer,
)
from common.logging import bind_log_context
from common.permissions import VIEW, member_workspace_ids, require_role
from common.throttles import AIRateThrottle

MAX_MESSAGES = 500


class ServerSentEventRenderer(renderers.BaseRenderer):
    """Lets clients send ``Accept: text/event-stream``; pre-stream errors become an SSE error frame."""

    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return f"event: error\ndata: {json.dumps(data)}\n\n".encode()


def sse_frame(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def messages_with_citations(conversation):
    return conversation.messages.prefetch_related(
        Prefetch("citations", queryset=Citation.objects.select_related("document").order_by("source_index"))
    ).order_by("created_at", "id")


@extend_schema(tags=["conversations"])
class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.none()  # for schema generation; see get_queryset
    serializer_class = ConversationSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        last_message = Message.objects.filter(conversation=OuterRef("pk")).order_by("-id")
        qs = (
            Conversation.objects.filter(
                user=self.request.user, workspace_id__in=member_workspace_ids(self.request.user)
            )
            .select_related("knowledge_base")
            .annotate(
                message_count=Count("messages", distinct=True),
                last_message_preview=Subquery(last_message.values(preview=Left("content", 140))[:1]),
            )
        )
        params = self.request.query_params
        if (workspace := params.get("workspace", "")).isdigit():
            qs = qs.filter(workspace_id=workspace)
        if (kb := params.get("knowledge_base", "")).isdigit():
            qs = qs.filter(knowledge_base_id=kb)
        if search := params.get("search", "").strip():
            qs = qs.filter(title__icontains=search)
        return qs.order_by("-updated_at")

    def get_object(self):
        conversation = self.get_queryset().filter(pk=self.kwargs["pk"]).first()
        if conversation is None:
            raise NotFound("Conversation not found.")
        bind_log_context(workspace_id=conversation.workspace_id)
        return conversation

    @extend_schema(
        parameters=[
            OpenApiParameter("workspace", OpenApiTypes.INT),
            OpenApiParameter("knowledge_base", OpenApiTypes.INT),
            OpenApiParameter("search", OpenApiTypes.STR),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        require_role(request.user, serializer.validated_data["workspace"].pk, VIEW)
        conversation = serializer.save(
            user=request.user, title=serializer.validated_data.get("title") or "New conversation"
        )
        return Response(
            self.get_serializer(self.get_queryset().get(pk=conversation.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        conversation = self.get_object()
        serializer = self.get_serializer(conversation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(self.get_queryset().get(pk=conversation.pk)).data)

    @extend_schema(
        methods=["GET"],
        responses=MessageSerializer(many=True),
        description="Full message history with citations, oldest first.",
    )
    @extend_schema(
        methods=["POST"],
        request=SendMessageSerializer,
        responses={201: ChatTurnSerializer},
        description="Ask a question and wait for the complete answer (non-streaming).",
    )
    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            data = MessageSerializer(messages_with_citations(conversation)[:MAX_MESSAGES], many=True).data
            return Response(data)

        self.check_throttles_for_ai(request)
        payload = SendMessageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user_message, assistant = ChatService(conversation, request.user).ask(
            payload.validated_data.get("content"), regenerate=payload.validated_data["regenerate"]
        )
        assistant = messages_with_citations(conversation).get(pk=assistant.pk)
        return Response(
            {
                "user_message": MessageSerializer(user_message).data,
                "assistant_message": MessageSerializer(assistant).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=SendMessageSerializer,
        responses={
            (200, "text/event-stream"): OpenApiResponse(
                response=OpenApiTypes.STR,
                description=(
                    "Server-Sent Events stream. Events, in order:\n\n"
                    "- `start` — `{user_message}` the stored question\n"
                    "- `sources` — retrieved sources `[{index, document_id, document_name, page_number, "
                    "chunk_id, score, excerpt}]`\n"
                    "- `token` — `{delta}` incremental answer text (many)\n"
                    "- `done` — `{message}` the stored answer with citations\n"
                    "- `error` — `{code, message}` if generation fails\n"
                ),
                examples=[
                    OpenApiExample(
                        "stream",
                        value='event: token\ndata: {"delta": "Normalization"}\n\n',
                        media_type="text/event-stream",
                    )
                ],
            )
        },
    )
    @action(
        detail=True,
        methods=["post"],
        renderer_classes=[renderers.JSONRenderer, ServerSentEventRenderer],
    )
    def stream(self, request, pk=None):
        conversation = self.get_object()
        self.check_throttles_for_ai(request)
        payload = SendMessageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        service = ChatService(conversation, request.user)
        user_message = service.start_turn(
            payload.validated_data.get("content"), regenerate=payload.validated_data["regenerate"]
        )

        def events():
            yield sse_frame("start", {"user_message": MessageSerializer(user_message).data})
            for event in service.stream(user_message):
                if event["event"] == "done":
                    message = messages_with_citations(conversation).get(pk=event["data"]["message_id"])
                    yield sse_frame("done", {"message": MessageSerializer(message).data})
                else:
                    yield sse_frame(event["event"], event["data"])

        response = StreamingHttpResponse(events(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache, no-transform"
        response["X-Accel-Buffering"] = "no"  # disable proxy buffering (nginx)
        return response

    def check_throttles_for_ai(self, request):
        throttle = AIRateThrottle()
        if not throttle.allow_request(request, self):
            self.throttled(request, throttle.wait())
