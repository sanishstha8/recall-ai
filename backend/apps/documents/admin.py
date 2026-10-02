from django.contrib import admin

from apps.documents.models import Document, DocumentChunk, DocumentPage


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "knowledge_base",
        "file_type",
        "status",
        "page_count",
        "chunk_count",
        "created_at",
    ]
    list_filter = ["status", "file_type", "processing_stage"]
    search_fields = ["name", "original_filename", "knowledge_base__name"]
    list_select_related = ["knowledge_base"]
    raw_id_fields = ["knowledge_base", "uploaded_by"]
    readonly_fields = ["content_hash", "storage_path", "processed_at", "created_at", "updated_at"]


@admin.register(DocumentPage)
class DocumentPageAdmin(admin.ModelAdmin):
    list_display = ["document", "page_number"]
    raw_id_fields = ["document"]


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ["document", "chunk_index", "token_count", "embedding_model"]
    raw_id_fields = ["document", "page", "knowledge_base"]
    exclude = ["embedding"]
