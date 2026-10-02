"""Chat orchestration: conversation persistence around the RAG pipeline."""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Iterator
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.ai.providers import AIProviderError, ChatMessage
from apps.ai.rag.pipeline import PreparedPrompt, RAGPipeline
from apps.ai.rag.prompt_builder import extract_cited_indices
from apps.conversations.models import Citation, Conversation, Message, MessageRole
from apps.knowledge.models import KnowledgeBase
from apps.usage.models import Operation
from apps.usage.services import record_usage

logger = logging.getLogger(__name__)

MAX_QUESTION_CHARS = 8000
SHORT_FOLLOW_UP_WORDS = 8
FOLLOW_UP_MARKERS = frozenset(
    [
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "them",
        "they",
        "he",
        "she",
        "example",
        "examples",
        "more",
        "elaborate",
        "further",
        "why",
        "how",
        "else",
        "another",
        "again",
        "also",
        "previous",
        "above",
    ]
)


def make_title(text: str, limit: int = 60) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def serialize_source(source) -> dict[str, Any]:
    chunk = source.chunk
    return {
        "index": source.index,
        "document_id": chunk.document_id,
        "document_name": chunk.document_name,
        "page_number": chunk.page_number,
        "chunk_id": chunk.chunk_id,
        "score": chunk.score,
        "excerpt": chunk.content[:400],
    }


class ChatService:
    def __init__(self, conversation: Conversation, user, pipeline: RAGPipeline | None = None):
        self.conversation = conversation
        self.user = user
        self.pipeline = pipeline or RAGPipeline()

    # -- helpers ------------------------------------------------------------------
    def knowledge_base_ids(self) -> list[int]:
        if self.conversation.knowledge_base_id:
            return [self.conversation.knowledge_base_id]
        # No knowledge base selected: search every knowledge base in the workspace.
        return list(
            KnowledgeBase.objects.filter(workspace_id=self.conversation.workspace_id).values_list(
                "id", flat=True
            )
        )

    def history(self, before: Message) -> list[ChatMessage]:
        previous = self.conversation.messages.filter(
            role__in=[MessageRole.USER, MessageRole.ASSISTANT], id__lt=before.id
        ).order_by("-id")[: settings.RAG_HISTORY_MESSAGES]
        return [
            ChatMessage("user" if m.role == MessageRole.USER else "assistant", m.content)
            for m in reversed(previous)
        ]

    def retrieval_query(self, question: str, history: list[ChatMessage]) -> str:
        # Short follow-ups that refer back ("give an example", "why is that?") need the
        # previous question to retrieve well; unrelated short questions must not inherit it.
        words = set(re.findall(r"[a-z]+", question.lower()))
        if len(question.split()) < SHORT_FOLLOW_UP_WORDS and words & FOLLOW_UP_MARKERS:
            previous = next((m.content for m in reversed(history) if m.role == "user"), None)
            if previous:
                return f"{previous}\n{question}"
        return question

    # -- turn lifecycle -------------------------------------------------------------
    def start_turn(self, content: str | None = None, *, regenerate: bool = False) -> Message:
        with transaction.atomic():
            if regenerate:
                user_message = (
                    self.conversation.messages.filter(role=MessageRole.USER).order_by("-id").first()
                )
                if user_message is None:
                    raise ValidationError({"regenerate": "There is no question to regenerate."})
                self.conversation.messages.filter(id__gt=user_message.id).delete()
                return user_message

            content = (content or "").strip()
            if not content:
                raise ValidationError({"content": "Message cannot be empty."})
            if len(content) > MAX_QUESTION_CHARS:
                raise ValidationError(
                    {"content": f"Messages are limited to {MAX_QUESTION_CHARS} characters."}
                )
            user_message = Message.objects.create(
                conversation=self.conversation, role=MessageRole.USER, content=content
            )
            if not self.conversation.messages.exclude(pk=user_message.pk).exists():
                self.conversation.title = make_title(content)
            self.conversation.save(update_fields=["title", "updated_at"])
            return user_message

    def prepare(self, user_message: Message) -> PreparedPrompt:
        history = self.history(user_message)
        return self.pipeline.prepare(
            user_message.content,
            knowledge_base_ids=self.knowledge_base_ids(),
            history=history,
            retrieval_query=self.retrieval_query(user_message.content, history),
        )

    @transaction.atomic
    def finish_turn(
        self,
        prepared: PreparedPrompt,
        *,
        content: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int,
    ) -> Message:
        assistant = Message.objects.create(
            conversation=self.conversation,
            role=MessageRole.ASSISTANT,
            content=content,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )
        cited = set(extract_cited_indices(content, {s.index for s in prepared.context.sources}))
        Citation.objects.bulk_create(
            [
                Citation(
                    message=assistant,
                    document_id=s.chunk.document_id,
                    chunk_id=s.chunk.chunk_id,
                    source_index=s.index,
                    page_number=s.chunk.page_number,
                    quoted_content=s.chunk.content,
                    relevance_score=s.chunk.final_score,
                    cited=s.index in cited,
                )
                for s in prepared.context.sources
            ]
        )
        self.conversation.model = model
        self.conversation.updated_at = timezone.now()
        self.conversation.save(update_fields=["model", "updated_at"])
        record_usage(
            workspace_id=self.conversation.workspace_id,
            user_id=self.user.pk,
            operation=Operation.CHAT,
            model=model,
            input_tokens=prompt_tokens,
            output_tokens=completion_tokens,
            latency_ms=latency_ms,
        )
        return assistant

    def _record_failure(self, model: str, latency_ms: int) -> None:
        record_usage(
            workspace_id=self.conversation.workspace_id,
            user_id=self.user.pk,
            operation=Operation.CHAT,
            model=model,
            latency_ms=latency_ms,
            success=False,
        )

    # -- public API -------------------------------------------------------------------
    def ask(self, content: str | None = None, *, regenerate: bool = False) -> tuple[Message, Message]:
        user_message = self.start_turn(content, regenerate=regenerate)
        started = time.perf_counter()
        try:
            prepared = self.prepare(user_message)
            result = self.pipeline.generate(prepared)
        except AIProviderError:
            self._record_failure(self.pipeline.llm.model, int((time.perf_counter() - started) * 1000))
            raise
        assistant = self.finish_turn(
            prepared,
            content=result.content.strip(),
            model=result.model,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        return user_message, assistant

    def stream(self, user_message: Message) -> Iterator[dict[str, Any]]:
        """Yield SSE events: sources, token*, done | error."""
        started = time.perf_counter()
        model = self.pipeline.llm.model
        parts: list[str] = []
        prompt_tokens = completion_tokens = 0
        prepared: PreparedPrompt | None = None
        try:
            prepared = self.prepare(user_message)
            yield {"event": "sources", "data": [serialize_source(s) for s in prepared.context.sources]}
            for chunk in self.pipeline.stream(prepared):
                if chunk.delta:
                    parts.append(chunk.delta)
                    yield {"event": "token", "data": {"delta": chunk.delta}}
                if chunk.done:
                    model = chunk.model or model
                    prompt_tokens, completion_tokens = chunk.prompt_tokens, chunk.completion_tokens
        except AIProviderError as exc:
            self._record_failure(model, int((time.perf_counter() - started) * 1000))
            logger.warning("chat generation failed", extra={"operation": "chat", "error": str(exc)})
            yield {"event": "error", "data": {"code": "ai_error", "message": str(exc)}}
            return
        except GeneratorExit:
            # Client disconnected mid-answer: keep what was generated so history stays coherent.
            if parts and prepared is not None:
                self.finish_turn(
                    prepared,
                    content="".join(parts).strip(),
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    latency_ms=int((time.perf_counter() - started) * 1000),
                )
            raise
        except Exception:
            logger.exception("chat stream crashed", extra={"operation": "chat"})
            yield {
                "event": "error",
                "data": {"code": "server_error", "message": "Generation failed unexpectedly."},
            }
            return

        assistant = self.finish_turn(
            prepared,
            content="".join(parts).strip(),
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        yield {"event": "done", "data": {"message_id": assistant.pk}}
