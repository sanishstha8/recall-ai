from django.conf import settings
from django.db import models

from apps.workspaces.models import Workspace
from common.models import TimeStampedModel


class KnowledgeBase(TimeStampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="knowledge_bases")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=2000)
    # Name of a lucide icon rendered by the frontend (e.g. "book-open").
    icon = models.CharField(max_length=40, default="book-open")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_knowledge_bases",
    )

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["workspace", "-updated_at"])]

    def __str__(self) -> str:
        return self.name
