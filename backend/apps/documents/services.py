"""Document lifecycle: upload, asynchronous processing, reprocessing and deletion."""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.ai.providers import AIProviderError, get_embedding_provider
from apps.documents.models import (
    Document,
    DocumentChunk,
    DocumentPage,
    DocumentStatus,
    ProcessingStage,
)
from apps.documents.parsers import DocumentParsingError, get_parser
from apps.documents.processing.chunking import chunk_pages
from apps.documents.processing.cleaning import clean_text
from apps.documents.validators import validate_upload
from apps.knowledge.models import KnowledgeBase
from apps.usage.models import Operation
from apps.usage.services import record_usage
from common.exceptions import Conflict
from common.storage import get_document_storage
from common.utils import sanitize_filename

logger = logging.getLogger(__name__)

# A document stuck in PROCESSING longer than this may be reprocessed (worker crash etc.).
STALE_PROCESSING_AFTER = timedelta(minutes=30)


def _sha256(file) -> str:
    digest = hashlib.sha256()
    file.seek(0)
    for block in iter(lambda: file.read(1024 * 1024), b""):
        digest.update(block)
    file.seek(0)
    return digest.hexdigest()


def enqueue_processing(document: Document) -> None:
    from apps.documents.tasks import process_document_task

    transaction.on_commit(lambda: process_document_task.delay(document.pk))


def upload_document(*, knowledge_base: KnowledgeBase, user, file, name: str | None = None) -> Document:
    original = sanitize_filename(getattr(file, "name", "") or "document")
    file_type = validate_upload(file, original)
    content_hash = _sha256(file)

    storage = get_document_storage()
    storage_path = storage.save(
        file,
        workspace_id=knowledge_base.workspace_id,
        knowledge_base_id=knowledge_base.pk,
        extension=file_type,
    )
    try:
        with transaction.atomic():
            document = Document.objects.create(
                knowledge_base=knowledge_base,
                uploaded_by=user,
                name=sanitize_filename(name) if name else original,
                original_filename=original,
                file_type=file_type,
                file_size=file.size,
                content_hash=content_hash,
                storage_path=storage_path,
                status=DocumentStatus.UPLOADED,
                processing_stage=ProcessingStage.QUEUED,
            )
            KnowledgeBase.objects.filter(pk=knowledge_base.pk).update(updated_at=timezone.now())
            enqueue_processing(document)
    except Exception:
        storage.delete(storage_path)
        raise
    logger.info(
        "document uploaded",
        extra={"operation": "document_upload", "document_id": document.pk, "file_type": file_type},
    )
    return document


def reprocess_document(document: Document) -> Document:
    is_fresh = timezone.now() - document.updated_at < STALE_PROCESSING_AFTER
    if document.status == DocumentStatus.PROCESSING and is_fresh:
        raise Conflict("This document is already being processed.")
    document.status = DocumentStatus.UPLOADED
    document.processing_stage = ProcessingStage.QUEUED
    document.processing_error = ""
    with transaction.atomic():
        document.save(update_fields=["status", "processing_stage", "processing_error", "updated_at"])
        enqueue_processing(document)
    return document


def delete_document(document: Document) -> None:
    storage_path = document.storage_path
    with transaction.atomic():
        document.delete()
        transaction.on_commit(lambda: get_document_storage().delete(storage_path))


def _set_stage(document: Document, stage: str, status: str = DocumentStatus.PROCESSING) -> None:
    document.status = status
    document.processing_stage = stage
    document.save(update_fields=["status", "processing_stage", "updated_at"])


def _embed_chunks(contents: list[str]):
    provider = get_embedding_provider()
    vectors: list[list[float]] = []
    prompt_tokens = 0
    started = time.perf_counter()
    batch = max(1, settings.EMBEDDING_BATCH_SIZE)
    for start in range(0, len(contents), batch):
        result = provider.embed_documents(contents[start : start + batch])
        vectors.extend(result.vectors)
        prompt_tokens += result.prompt_tokens
    latency_ms = int((time.perf_counter() - started) * 1000)
    return provider, vectors, prompt_tokens, latency_ms


class RetryableProcessingError(Exception):
    """Raised for transient failures (e.g. Ollama not reachable) so the task can retry."""


def process_document(document_id: int, *, final_attempt: bool = True) -> Document:
    """Extract -> clean -> chunk -> embed -> store. Idempotent: safe to run again."""
    document = Document.objects.select_related("knowledge_base").get(pk=document_id)
    started = time.perf_counter()
    document.processing_error = ""
    document.save(update_fields=["processing_error"])
    try:
        _set_stage(document, ProcessingStage.EXTRACTING)
        with get_document_storage().open(document.storage_path) as handle:
            parsed = get_parser(document.file_type).parse(handle)

        pages = [(p.page_number, clean_text(p.text)) for p in parsed.pages]
        if not any(text for _, text in pages):
            raise DocumentParsingError(
                "No extractable text was found. Scanned/image-only PDFs need OCR, which is not supported yet."
            )

        _set_stage(document, ProcessingStage.CHUNKING)
        chunks = chunk_pages([(n, t) for n, t in pages if t])

        _set_stage(document, ProcessingStage.EMBEDDING)
        provider, vectors, embed_tokens, embed_latency = _embed_chunks([c.content for c in chunks])

        with transaction.atomic():
            # Rebuild from scratch so reprocessing never leaves stale pages/chunks behind.
            document.pages.all().delete()
            page_objs = DocumentPage.objects.bulk_create(
                [DocumentPage(document=document, page_number=n, content=t) for n, t in pages]
            )
            page_by_number = {p.page_number: p for p in page_objs}
            DocumentChunk.objects.bulk_create(
                [
                    DocumentChunk(
                        document=document,
                        page=page_by_number[chunk.page_number],
                        knowledge_base_id=document.knowledge_base_id,
                        content=chunk.content,
                        chunk_index=chunk.chunk_index,
                        token_count=chunk.token_count,
                        embedding=vector,
                        embedding_model=provider.model,
                        embedding_dimensions=len(vector),
                        metadata={
                            "document_id": document.pk,
                            "page_number": chunk.page_number,
                            "chunk_index": chunk.chunk_index,
                            "document_name": document.name,
                        },
                    )
                    for chunk, vector in zip(chunks, vectors, strict=True)
                ],
                batch_size=500,
            )
            document.status = DocumentStatus.READY
            document.processing_stage = ProcessingStage.DONE
            document.page_count = len(pages)
            document.word_count = sum(len(t.split()) for _, t in pages)
            document.chunk_count = len(chunks)
            document.processed_at = timezone.now()
            document.save(
                update_fields=[
                    "status",
                    "processing_stage",
                    "page_count",
                    "word_count",
                    "chunk_count",
                    "processed_at",
                    "updated_at",
                ]
            )

        record_usage(
            workspace_id=document.knowledge_base.workspace_id,
            user_id=document.uploaded_by_id,
            operation=Operation.EMBEDDING,
            model=provider.model,
            input_tokens=embed_tokens or sum(c.token_count for c in chunks),
            latency_ms=embed_latency,
        )
        logger.info(
            "document processed",
            extra={
                "operation": "document_processing",
                "document_id": document.pk,
                "pages": len(pages),
                "chunks": len(chunks),
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "success": True,
            },
        )
        return document
    except AIProviderError as exc:
        if exc.retryable and not final_attempt:
            raise RetryableProcessingError(str(exc)) from exc
        _fail(document, f"Embedding failed: {exc}")
    except DocumentParsingError as exc:
        _fail(document, str(exc))
    except Exception as exc:
        logger.exception("document processing crashed", extra={"document_id": document.pk})
        _fail(document, f"Unexpected processing error: {exc.__class__.__name__}: {exc}")
    return document


def _fail(document: Document, message: str) -> None:
    document.status = DocumentStatus.FAILED
    document.processing_error = message[:2000]
    document.save(update_fields=["status", "processing_error", "updated_at"])
    logger.warning(
        "document processing failed",
        extra={
            "operation": "document_processing",
            "document_id": document.pk,
            "success": False,
            "error": message[:300],
        },
    )
