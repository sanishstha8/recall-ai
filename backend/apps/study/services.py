from __future__ import annotations

import logging
import time

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.ai.providers import AIProviderError, ChatMessage
from apps.ai.rag.pipeline import RAGPipeline
from apps.documents.models import DocumentStatus
from apps.study.generation import (
    InvalidGeneration,
    format_sources,
    parse_output,
    select_context,
    source_summary,
)
from apps.study.models import QuizAttempt, StudyKind, StudySet, StudySetStatus
from apps.study.prompts import SCHEMAS, SYSTEM_PROMPT, build_user_prompt
from apps.usage.models import Operation
from apps.usage.services import record_usage

logger = logging.getLogger(__name__)

OPERATION_FOR_KIND = {
    StudyKind.SUMMARY: Operation.SUMMARY,
    StudyKind.FLASHCARDS: Operation.FLASHCARD,
    StudyKind.QUIZ: Operation.QUIZ,
    StudyKind.QUESTIONS: Operation.QUESTIONS,
    StudyKind.MOCK_EXAM: Operation.MOCK_EXAM,
}
KIND_LABEL = {
    StudyKind.SUMMARY: "Summary",
    StudyKind.FLASHCARDS: "Flashcards",
    StudyKind.QUIZ: "Quiz",
    StudyKind.QUESTIONS: "Practice questions",
    StudyKind.MOCK_EXAM: "Mock exam",
}
MAX_ATTEMPTS = 2


def default_title(kind: str, *, knowledge_base, document=None, topic: str = "") -> str:
    subject = topic or (document.name if document else knowledge_base.name)
    return f"{KIND_LABEL[StudyKind(kind)]} · {subject}"[:200]


def request_study_set(
    *,
    kind: str,
    user,
    knowledge_base,
    document=None,
    topic: str = "",
    count: int = 10,
    difficulty: str = "MEDIUM",
    time_limit_minutes: int | None = None,
    title: str = "",
) -> StudySet:
    has_material = knowledge_base.documents.filter(status=DocumentStatus.READY)
    if document is not None:
        has_material = has_material.filter(pk=document.pk)
    if not has_material.exists():
        message = "Add at least one processed (READY) document before generating study material."
        raise ValidationError({"knowledge_base": message})

    from apps.study.tasks import generate_study_set_task

    with transaction.atomic():
        study_set = StudySet.objects.create(
            workspace_id=knowledge_base.workspace_id,
            knowledge_base=knowledge_base,
            document=document,
            user=user,
            kind=kind,
            title=title.strip()
            or default_title(kind, knowledge_base=knowledge_base, document=document, topic=topic),
            topic=topic.strip(),
            item_count=count,
            difficulty=difficulty,
            time_limit_minutes=time_limit_minutes if kind == StudyKind.MOCK_EXAM else None,
        )
        transaction.on_commit(lambda: generate_study_set_task.delay(study_set.pk))
    return study_set


def generate_study_set(study_set_id: int, pipeline: RAGPipeline | None = None) -> StudySet:
    study_set = StudySet.objects.select_related("knowledge_base").get(pk=study_set_id)
    study_set.status = StudySetStatus.GENERATING
    study_set.error = ""
    study_set.save(update_fields=["status", "error", "updated_at"])

    pipeline = pipeline or RAGPipeline()
    llm = pipeline.llm
    started = time.perf_counter()
    prompt_tokens = completion_tokens = 0
    try:
        chunks = select_context(study_set, pipeline)
        if not chunks:
            raise InvalidGeneration("No processed document content is available for this selection.")
        messages = [
            ChatMessage("system", SYSTEM_PROMPT),
            ChatMessage(
                "user",
                build_user_prompt(
                    study_set.kind,
                    sources_text=format_sources(chunks),
                    count=study_set.item_count,
                    difficulty=study_set.difficulty,
                    topic=study_set.topic,
                ),
            ),
        ]
        last_error: InvalidGeneration | None = None
        for _ in range(MAX_ATTEMPTS):
            result = llm.generate(messages, json_schema=SCHEMAS[study_set.kind], temperature=0.3)
            prompt_tokens += result.prompt_tokens
            completion_tokens += result.completion_tokens
            try:
                content = parse_output(study_set.kind, result.content, count=study_set.item_count)
                break
            except InvalidGeneration as exc:
                last_error = exc
                logger.warning("study output invalid, retrying", extra={"error": str(exc)})
        else:
            raise last_error or InvalidGeneration("Generation failed")

        study_set.content = content
        study_set.sources = source_summary(chunks)
        study_set.model = result.model
        study_set.status = StudySetStatus.READY
        if study_set.kind == StudyKind.SUMMARY and content.get("title") and not study_set.topic:
            study_set.title = f"Summary · {content['title']}"[:200]
        study_set.save(update_fields=["content", "sources", "model", "status", "title", "updated_at"])
        success = True
    except (AIProviderError, InvalidGeneration) as exc:
        study_set.status = StudySetStatus.FAILED
        study_set.error = str(exc)[:2000]
        study_set.save(update_fields=["status", "error", "updated_at"])
        success = False
    except Exception as exc:
        logger.exception("study generation crashed", extra={"study_set_id": study_set.pk})
        study_set.status = StudySetStatus.FAILED
        study_set.error = f"Unexpected error: {exc.__class__.__name__}"
        study_set.save(update_fields=["status", "error", "updated_at"])
        success = False

    record_usage(
        workspace_id=study_set.workspace_id,
        user_id=study_set.user_id,
        operation=OPERATION_FOR_KIND[StudyKind(study_set.kind)],
        model=study_set.model or llm.model,
        input_tokens=prompt_tokens,
        output_tokens=completion_tokens,
        latency_ms=int((time.perf_counter() - started) * 1000),
        success=success,
    )
    return study_set


def score_attempt(*, study_set: StudySet, user, answers: dict, duration_seconds: int) -> QuizAttempt:
    if study_set.kind not in (StudyKind.QUIZ, StudyKind.MOCK_EXAM):
        raise ValidationError({"detail": "Only quizzes and mock exams can be attempted."})
    if study_set.status != StudySetStatus.READY:
        raise ValidationError({"detail": "This study set is not ready yet."})

    questions = study_set.content.get("questions", [])
    normalized = {str(k): str(v).strip().upper()[:1] for k, v in (answers or {}).items()}
    results = []
    score = 0
    for q in questions:
        chosen = normalized.get(str(q["id"])) or None
        correct = chosen == q["answer"]
        score += int(correct)
        results.append(
            {
                "question_id": q["id"],
                "selected": chosen,
                "correct_answer": q["answer"],
                "is_correct": correct,
                "explanation": q.get("explanation", ""),
            }
        )
    return QuizAttempt.objects.create(
        study_set=study_set,
        user=user,
        answers=normalized,
        results=results,
        score=score,
        total=len(questions),
        duration_seconds=max(0, duration_seconds),
    )
