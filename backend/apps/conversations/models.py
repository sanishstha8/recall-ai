from django.conf import settings
from django.db import models

from apps.documents.models import Document, DocumentChunk
from apps.knowledge.models import KnowledgeBase
from apps.workspaces.models import Workspace
from common.models import TimeStampedModel


class Conversation(TimeStampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="conversations")
    knowledge_base = models.ForeignKey(
        KnowledgeBase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=200, default="New conversation")
    model = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "workspace", "-updated_at"])]

    def __str__(self) -> str:
        return self.title


class MessageRole(models.TextChoices):
    SYSTEM = "SYSTEM", "System"
    USER = "USER", "User"
    ASSISTANT = "ASSISTANT", "Assistant"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=MessageRole.choices)
    content = models.TextField()

    model = models.CharField(max_length=120, blank=True)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["conversation", "created_at"])]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:40]}"


class Citation(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="citations")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="citations")
    # Chunks are rebuilt when a document is reprocessed; the citation keeps its page and quote.
    chunk = models.ForeignKey(
        DocumentChunk, on_delete=models.SET_NULL, null=True, blank=True, related_name="citations"
    )
    # The [n] marker used for this source in the answer text.
    source_index = models.PositiveSmallIntegerField()
    page_number = models.PositiveIntegerField()
    quoted_content = models.TextField()
    relevance_score = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["source_index"]

    def __str__(self) -> str:
        return f"[{self.source_index}] {self.document_id} p{self.page_number}"
