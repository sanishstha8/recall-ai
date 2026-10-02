from rest_framework import serializers

from apps.documents.models import Document, DocumentPage


class DocumentSerializer(serializers.ModelSerializer):
    knowledge_base_name = serializers.CharField(source="knowledge_base.name", read_only=True)
    workspace = serializers.IntegerField(source="knowledge_base.workspace_id", read_only=True)
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True, default=None)

    class Meta:
        model = Document
        fields = [
            "id",
            "knowledge_base",
            "knowledge_base_name",
            "workspace",
            "uploaded_by",
            "uploaded_by_email",
            "name",
            "original_filename",
            "file_type",
            "file_size",
            "status",
            "processing_stage",
            "page_count",
            "word_count",
            "chunk_count",
            "processing_error",
            "created_at",
            "updated_at",
            "processed_at",
        ]
        read_only_fields = fields


class DocumentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "id",
            "status",
            "processing_stage",
            "page_count",
            "chunk_count",
            "processing_error",
            "processed_at",
            "updated_at",
        ]
        read_only_fields = fields


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="PDF, DOCX, TXT or Markdown file.")
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)


class DocumentPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentPage
        fields = ["id", "page_number", "content"]


class PageSearchResultSerializer(serializers.Serializer):
    page_number = serializers.IntegerField()
    matches = serializers.IntegerField()
    snippet = serializers.CharField()
