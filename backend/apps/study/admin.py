from django.contrib import admin

from apps.study.models import QuizAttempt, StudySet


@admin.register(StudySet)
class StudySetAdmin(admin.ModelAdmin):
    list_display = ["title", "kind", "status", "user", "knowledge_base", "created_at"]
    list_filter = ["kind", "status", "difficulty"]
    search_fields = ["title", "user__email"]
    raw_id_fields = ["workspace", "knowledge_base", "document", "user"]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ["study_set", "user", "score", "total", "created_at"]
    raw_id_fields = ["study_set", "user"]
