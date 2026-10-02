from django.contrib import admin

from apps.usage.models import UsageRecord


@admin.register(UsageRecord)
class UsageRecordAdmin(admin.ModelAdmin):
    list_display = [
        "operation",
        "model",
        "workspace",
        "user",
        "total_tokens",
        "latency_ms",
        "success",
        "created_at",
    ]
    list_filter = ["operation", "success", "model"]
    search_fields = ["user__email", "workspace__name", "model"]
    list_select_related = ["workspace", "user"]
    raw_id_fields = ["workspace", "user"]
    date_hierarchy = "created_at"
