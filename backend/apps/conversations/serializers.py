from rest_framework import serializers

from apps.conversations.models import Citation, Conversation, Message
from apps.knowledge.models import KnowledgeBase
from apps.knowledge.selectors import scoped_knowledge_bases
from apps.workspaces.models import Workspace
from common.permissions import member_workspace_ids


class CitationSerializer(serializers.ModelSerializer):
    document_name = serializers.CharField(source="document.name", read_only=True)
    knowledge_base = serializers.IntegerField(source="document.knowledge_base_id", read_only=True)

    class Meta:
        model = Citation
        fields = [
            "id",
            "source_index",
            "document",
            "document_name",
            "knowledge_base",
            "chunk",
            "page_number",
            "quoted_content",
            "relevance_score",
            "cited",
        ]


class MessageSerializer(serializers.ModelSerializer):
    citations = CitationSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "role",
            "content",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "citations",
            "created_at",
        ]


class ConversationSerializer(serializers.ModelSerializer):
    workspace = serializers.PrimaryKeyRelatedField(queryset=Workspace.objects.all())
    knowledge_base = serializers.PrimaryKeyRelatedField(
        queryset=KnowledgeBase.objects.all(), required=False, allow_null=True
    )
    knowledge_base_name = serializers.CharField(source="knowledge_base.name", read_only=True, default=None)
    message_count = serializers.IntegerField(read_only=True)
    last_message_preview = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "workspace",
            "knowledge_base",
            "knowledge_base_name",
            "title",
            "model",
            "message_count",
            "last_message_preview",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "model", "created_at", "updated_at"]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            # Only offer the user's own workspaces/knowledge bases as valid choices.
            fields["workspace"].queryset = Workspace.objects.filter(pk__in=member_workspace_ids(request.user))
            fields["knowledge_base"].queryset = scoped_knowledge_bases(request.user)
        if self.instance is not None:
            fields["workspace"].read_only = True
        return fields

    def validate_title(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Title cannot be blank.")
        return value.strip()[:200]

    def validate(self, attrs):
        workspace = attrs.get("workspace") or getattr(self.instance, "workspace", None)
        kb = attrs.get("knowledge_base")
        if kb is not None and workspace is not None and kb.workspace_id != workspace.pk:
            raise serializers.ValidationError({"knowledge_base": "Knowledge base not found."})
        return attrs


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    regenerate = serializers.BooleanField(
        default=False, help_text="Discard the last answer and answer the last question again."
    )

    def validate(self, attrs):
        if not attrs.get("regenerate") and not attrs.get("content", "").strip():
            raise serializers.ValidationError({"content": "Message cannot be empty."})
        return attrs


class ChatTurnSerializer(serializers.Serializer):
    user_message = MessageSerializer()
    assistant_message = MessageSerializer()
