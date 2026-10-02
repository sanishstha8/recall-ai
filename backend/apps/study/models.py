from django.conf import settings
from django.db import models

from apps.documents.models import Document
from apps.knowledge.models import KnowledgeBase
from apps.workspaces.models import Workspace
from common.models import TimeStampedModel


class StudyKind(models.TextChoices):
    SUMMARY = "SUMMARY", "Summary"
    FLASHCARDS = "FLASHCARDS", "Flashcards"
    QUIZ = "QUIZ", "Multiple-choice quiz"
    QUESTIONS = "QUESTIONS", "Practice questions"
    MOCK_EXAM = "MOCK_EXAM", "Mock exam"


class StudySetStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    GENERATING = "GENERATING", "Generating"
    READY = "READY", "Ready"
    FAILED = "FAILED", "Failed"


class Difficulty(models.TextChoices):
    EASY = "EASY", "Easy"
    MEDIUM = "MEDIUM", "Medium"
    HARD = "HARD", "Hard"


class StudySet(TimeStampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="study_sets")
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name="study_sets")
    document = models.ForeignKey(
        Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="study_sets"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_sets")

    kind = models.CharField(max_length=12, choices=StudyKind.choices, db_index=True)
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=12, choices=StudySetStatus.choices, default=StudySetStatus.PENDING)
    difficulty = models.CharField(max_length=8, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    topic = models.CharField(max_length=300, blank=True)
    item_count = models.PositiveSmallIntegerField(default=10)
    # Mock exams only. Null = untimed.
    time_limit_minutes = models.PositiveSmallIntegerField(null=True, blank=True)

    content = models.JSONField(default=dict, blank=True)
    sources = models.JSONField(default=list, blank=True)
    model = models.CharField(max_length=120, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "workspace", "kind", "-created_at"])]

    def __str__(self) -> str:
        return self.title


class QuizAttempt(models.Model):
    study_set = models.ForeignKey(StudySet, on_delete=models.CASCADE, related_name="attempts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts")
    answers = models.JSONField(default=dict)
    results = models.JSONField(default=list)
    score = models.PositiveSmallIntegerField()
    total = models.PositiveSmallIntegerField()
    duration_seconds = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.study_set_id}: {self.score}/{self.total}"

    @property
    def percentage(self) -> float:
        return round(100 * self.score / self.total, 1) if self.total else 0.0
