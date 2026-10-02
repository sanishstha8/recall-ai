from django.conf import settings
from django.db import models

from apps.workspaces.models import Workspace


class Operation(models.TextChoices):
    CHAT = "CHAT", "Chat"
    EMBEDDING = "EMBEDDING", "Embedding"
    SUMMARY = "SUMMARY", "Summary"
    FLASHCARD = "FLASHCARD", "Flashcards"
    QUIZ = "QUIZ", "Quiz"
    QUESTIONS = "QUESTIONS", "Questions"
    MOCK_EXAM = "MOCK_EXAM", "Mock exam"


class UsageRecord(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="usage_records")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="usage_records"
    )

    operation = models.CharField(max_length=12, choices=Operation.choices, db_index=True)
    model = models.CharField(max_length=120)

    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)

    # Local inference is free; the column exists so paid providers can be added later.
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    success = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.operation} {self.model} ({self.total_tokens} tokens)"
