from celery import shared_task

from apps.documents import services
from apps.documents.models import Document

MAX_RETRIES = 3


@shared_task(bind=True, max_retries=MAX_RETRIES, acks_late=True)
def process_document_task(self, document_id: int) -> str:
    if not Document.objects.filter(pk=document_id).exists():
        return "deleted"
    final_attempt = self.request.retries >= MAX_RETRIES or self.request.is_eager
    try:
        document = services.process_document(document_id, final_attempt=final_attempt)
    except services.RetryableProcessingError as exc:
        # e.g. Ollama still starting up: back off and try again before failing the document.
        raise self.retry(exc=exc, countdown=15 * (2**self.request.retries)) from exc
    return document.status
