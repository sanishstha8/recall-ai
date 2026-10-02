import re

from rest_framework import serializers

from apps.knowledge.models import KnowledgeBase
from apps.workspaces.models import Workspace

ICON_RE = re.compile(r"^[a-z0-9-]{1,40}$")


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    workspace = serializers.PrimaryKeyRelatedField(queryset=Workspace.objects.all())
    document_count = serializers.IntegerField(read_only=True)
    ready_document_count = serializers.IntegerField(read_only=True)
    last_activity_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = KnowledgeBase
        fields = [
            "id",
            "workspace",
            "name",
            "description",
            "icon",
            "document_count",
            "ready_document_count",
            "last_activity_at",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:
            # A knowledge base can never be moved to another workspace.
            fields["workspace"].read_only = True
        return fields

    def validate_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_icon(self, value: str) -> str:
        if not ICON_RE.match(value):
            raise serializers.ValidationError("Invalid icon name.")
        return value
