from django.contrib import admin

from apps.knowledge.models import KnowledgeBase


@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ["name", "workspace", "created_by", "updated_at"]
    search_fields = ["name", "workspace__name"]
    list_select_related = ["workspace", "created_by"]
    raw_id_fields = ["workspace", "created_by"]
