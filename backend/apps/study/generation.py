"""Context selection and validation of model output for study material."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from apps.ai.rag.pipeline import RAGPipeline
from apps.documents.models import DocumentChunk, DocumentStatus
from apps.study.models import StudyKind, StudySet
from common.utils import estimate_tokens


class InvalidGeneration(ValueError):
    """The model returned output that does not satisfy the expected structure."""


@dataclass
class StudyChunk:
    document_id: int
    document_name: str
    page_number: int
    content: str


def select_context(study_set: StudySet, pipeline: RAGPipeline) -> list[StudyChunk]:
    """Pick source chunks: semantic retrieval for a topic, otherwise an even spread of the material."""
    budget = settings.STUDY_CONTEXT_TOKENS
    document_ids = [study_set.document_id] if study_set.document_id else None

    if study_set.topic:
        context, _ = pipeline.retrieve_context(
            study_set.topic,
            knowledge_base_ids=[study_set.knowledge_base_id],
            document_ids=document_ids,
            top_k=20,
            max_chunks=12,
        )
        picked = [
            StudyChunk(s.chunk.document_id, s.chunk.document_name, s.chunk.page_number, s.chunk.content)
            for s in context.sources
        ]
        if picked:
            return _within_budget(picked, budget)

    qs = DocumentChunk.objects.filter(
        knowledge_base_id=study_set.knowledge_base_id, document__status=DocumentStatus.READY
    )
    if document_ids:
        qs = qs.filter(document_id__in=document_ids)
    rows = list(
        qs.order_by("document_id", "chunk_index").values(
            "document_id", "document__name", "page__page_number", "content", "token_count"
        )
    )
    if not rows:
        return []
    total = sum(r["token_count"] for r in rows)
    # Evenly sample across the material so long documents are covered end to end.
    step = max(1.0, total / budget)
    picked, cursor = [], 0.0
    for index, row in enumerate(rows):
        if index >= cursor:
            picked.append(
                StudyChunk(
                    row["document_id"], row["document__name"], row["page__page_number"], row["content"]
                )
            )
            cursor += step
    return _within_budget(picked, budget)


def _within_budget(chunks: list[StudyChunk], budget: int) -> list[StudyChunk]:
    kept, used = [], 0
    for chunk in chunks:
        cost = estimate_tokens(chunk.content) + 15
        if kept and used + cost > budget:
            break
        kept.append(chunk)
        used += cost
    return kept


def format_sources(chunks: list[StudyChunk]) -> str:
    return "\n\n---\n\n".join(
        f"SOURCE {i}\nDocument: {c.document_name}\nPage: {c.page_number}\n\n{c.content.strip()}"
        for i, c in enumerate(chunks, start=1)
    )


def source_summary(chunks: list[StudyChunk]) -> list[dict[str, Any]]:
    seen: dict[tuple[int, int], dict[str, Any]] = {}
    for c in chunks:
        seen.setdefault(
            (c.document_id, c.page_number),
            {"document_id": c.document_id, "document_name": c.document_name, "page_number": c.page_number},
        )
    return sorted(seen.values(), key=lambda s: (s["document_name"], s["page_number"]))


# -- output validation ---------------------------------------------------------------


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise InvalidGeneration(f"'{field}' must be a non-empty string")
    return value.strip()


def _items(data: dict, key: str) -> list:
    items = data.get(key)
    if not isinstance(items, list) or not items:
        raise InvalidGeneration(f"'{key}' must be a non-empty list")
    return items


def _dedupe(items: list[dict], key: str) -> list[dict]:
    seen, out = set(), []
    for item in items:
        marker = item[key].lower()
        if marker not in seen:
            seen.add(marker)
            out.append(item)
    return out


def parse_output(kind: str, raw: str, *, count: int) -> dict[str, Any]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InvalidGeneration(f"Model did not return valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise InvalidGeneration("Model output must be a JSON object")

    if kind == StudyKind.SUMMARY:
        points = [p.strip() for p in data.get("key_points") or [] if isinstance(p, str) and p.strip()]
        return {
            "title": _text(data.get("title"), "title"),
            "short_summary": _text(data.get("short_summary"), "short_summary"),
            "detailed_summary": _text(data.get("detailed_summary"), "detailed_summary"),
            "key_points": points,
        }

    if kind == StudyKind.FLASHCARDS:
        cards = [
            {"question": _text(c.get("question"), "question"), "answer": _text(c.get("answer"), "answer")}
            for c in _items(data, "cards")
            if isinstance(c, dict)
        ]
        cards = _dedupe(cards, "question")[:count]
        return {"cards": [{"id": i, **c} for i, c in enumerate(cards, start=1)]}

    if kind in (StudyKind.QUIZ, StudyKind.MOCK_EXAM):
        questions = []
        for q in _items(data, "questions"):
            if not isinstance(q, dict):
                continue
            options = q.get("options") or {}
            if not isinstance(options, dict) or any(not str(options.get(k, "")).strip() for k in "ABCD"):
                continue  # drop malformed questions rather than failing the whole set
            answer = str(q.get("answer", "")).strip().upper()[:1]
            if answer not in "ABCD" or not answer:
                continue
            questions.append(
                {
                    "question": _text(q.get("question"), "question"),
                    "options": {k: str(options[k]).strip() for k in "ABCD"},
                    "answer": answer,
                    "explanation": str(q.get("explanation", "")).strip(),
                }
            )
        questions = _dedupe(questions, "question")[:count]
        if not questions:
            raise InvalidGeneration("No valid multiple-choice questions were generated")
        return {"questions": [{"id": i, **q} for i, q in enumerate(questions, start=1)]}

    if kind == StudyKind.QUESTIONS:
        result = {}
        for group in ("short_answer", "long_answer"):
            entries = [
                {
                    "question": _text(e.get("question"), "question"),
                    "model_answer": _text(e.get("model_answer"), "model_answer"),
                }
                for e in data.get(group) or []
                if isinstance(e, dict)
            ]
            result[group] = _dedupe(entries, "question")
        if not result["short_answer"] and not result["long_answer"]:
            raise InvalidGeneration("No questions were generated")
        n = 0
        for group in ("short_answer", "long_answer"):
            for entry in result[group]:
                n += 1
                entry["id"] = n
        return result

    raise InvalidGeneration(f"Unknown study kind: {kind}")
