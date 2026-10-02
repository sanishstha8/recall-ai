from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector, SearchVectorField
from django.db import models
from pgvector.django import HnswIndex, VectorField

from apps.knowledge.models import KnowledgeBase
from common.models import TimeStampedModel


class DocumentStatus(models.TextChoices):
    UPLOADED = "UPLOADED", "Uploaded"
    PROCESSING = "PROCESSING", "Processing"
    READY = "READY", "Ready"
    FAILED = "FAILED", "Failed"


class ProcessingStage(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    EXTRACTING = "EXTRACTING", "Extracting text"
    CHUNKING = "CHUNKING", "Chunking"
    EMBEDDING = "EMBEDDING", "Indexing"
    DONE = "DONE", "Done"


class FileType(models.TextChoices):
    PDF = "pdf", "PDF"
    TXT = "txt", "Plain text"
    MARKDOWN = "md", "Markdown"
    DOCX = "docx", "Word document"


class Document(TimeStampedModel):
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name="documents")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="documents"
    )

    name = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    file_size = models.PositiveBigIntegerField()
    content_hash = models.CharField(max_length=64, db_index=True)

    # Path inside the "documents" storage. Generated server-side, never from user input.
    storage_path = models.CharField(max_length=500)

    status = models.CharField(
        max_length=12, choices=DocumentStatus.choices, default=DocumentStatus.UPLOADED, db_index=True
    )
    processing_stage = models.CharField(
        max_length=12, choices=ProcessingStage.choices, default=ProcessingStage.QUEUED
    )

    page_count = models.PositiveIntegerField(default=0)
    word_count = models.PositiveIntegerField(default=0)
    chunk_count = models.PositiveIntegerField(default=0)

    processing_error = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["knowledge_base", "-created_at"]),
            models.Index(fields=["knowledge_base", "status"]),
        ]

    def __str__(self) -> str:
        return self.name


class DocumentPage(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="pages")
    page_number = models.PositiveIntegerField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["page_number"]
        constraints = [
            models.UniqueConstraint(fields=["document", "page_number"], name="unique_document_page")
        ]

    def __str__(self) -> str:
        return f"{self.document_id}:p{self.page_number}"


class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    page = models.ForeignKey(DocumentPage, on_delete=models.CASCADE, related_name="chunks")
    # Denormalized from document for fast, index-friendly scoping of vector search.
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name="chunks")

    content = models.TextField()
    chunk_index = models.PositiveIntegerField()
    token_count = models.PositiveIntegerField()

    embedding = VectorField(dimensions=settings.EMBEDDING_DIMENSIONS, null=True)
    embedding_model = models.CharField(max_length=120, blank=True)
    embedding_dimensions = models.PositiveIntegerField(null=True)

    # Full-text vector, maintained by Postgres. Ready for future hybrid retrieval.
    search_vector = models.GeneratedField(
        expression=SearchVector("content", config="english"),
        output_field=SearchVectorField(),
        db_persist=True,
    )

    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document_id", "chunk_index"]
        constraints = [
            models.UniqueConstraint(fields=["document", "chunk_index"], name="unique_document_chunk")
        ]
        indexes = [
            models.Index(fields=["knowledge_base", "embedding_model"]),
            HnswIndex(
                name="chunk_embedding_hnsw",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
            GinIndex(fields=["search_vector"], name="chunk_search_vector_gin"),
        ]

    def __str__(self) -> str:
        return f"{self.document_id}#{self.chunk_index}"
