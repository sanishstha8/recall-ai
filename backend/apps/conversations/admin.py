from django.contrib import admin

from apps.conversations.models import Citation, Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ["role", "content", "model", "total_tokens", "created_at"]
    readonly_fields = fields


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "workspace", "knowledge_base", "model", "updated_at"]
    search_fields = ["title", "user__email"]
    list_select_related = ["user", "workspace", "knowledge_base"]
    raw_id_fields = ["user", "workspace", "knowledge_base"]
    inlines = [MessageInline]


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ["message", "source_index", "document", "page_number", "relevance_score", "cited"]
    raw_id_fields = ["message", "document", "chunk"]
