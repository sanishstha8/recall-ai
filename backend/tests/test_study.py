import json

import pytest

from apps.knowledge.models import KnowledgeBase
from apps.study.generation import InvalidGeneration, parse_output
from apps.study.models import StudyKind, StudySet
from apps.usage.models import Operation, UsageRecord
from tests.conftest import workspace_of

pytestmark = pytest.mark.django_db

PAGES = [
    "First normal form 1NF requires atomic attribute values and no repeating groups.",
    "Second normal form 2NF removes partial dependencies on a composite primary key.",
    "Third normal form 3NF removes transitive dependencies between non key attributes.",
]

MCQ = {
    "questions": [
        {
            "question": "Which normal form removes transitive dependencies?",
            "options": {"A": "1NF", "B": "2NF", "C": "3NF", "D": "BCNF"},
            "answer": "C",
            "explanation": "3NF removes transitive dependencies.",
        },
        {
            "question": "1NF requires...",
            "options": {"A": "atomic values", "B": "foreign keys", "C": "indexes", "D": "views"},
            "answer": "A",
            "explanation": "Atomic attribute values.",
        },
        {  # malformed: missing option D -> dropped
            "question": "Broken?",
            "options": {"A": "x", "B": "y", "C": "z"},
            "answer": "A",
            "explanation": "",
        },
    ]
}


@pytest.fixture
def kb(workspace):
    return KnowledgeBase.objects.create(workspace=workspace, name="BSc CSIT")


@pytest.fixture
def document(kb, make_document):
    return make_document(kb, PAGES)


@pytest.fixture
def generate(client, django_capture_on_commit_callbacks):
    def _generate(endpoint, payload):
        with django_capture_on_commit_callbacks(execute=True):
            res = client.post(f"/api/v1/study/{endpoint}/", payload)
        assert res.status_code == 202, res.data
        return client.get(f"/api/v1/study/sets/{res.data['id']}/")

    return _generate


def test_quiz_generation_attempt_and_scoring(client, kb, document, llm, generate):
    llm.queue(MCQ)
    res = generate("quiz", {"knowledge_base": kb.id, "count": 5, "difficulty": "HARD"})
    assert res.data["status"] == "READY", res.data["error"]
    questions = res.data["content"]["questions"]
    assert [q["id"] for q in questions] == [1, 2]
    assert questions[0]["answer"] == "C"  # practice quizzes include answers
    assert {s["page_number"] for s in res.data["sources"]} == {1, 2, 3}

    # The prompt was grounded in the document and asked for the right shape.
    prompt = llm.calls[-1][-1].content
    assert "Third normal form 3NF" in prompt and "exactly 5 multiple-choice" in prompt
    assert "Hard:" in prompt

    attempt = client.post(
        f"/api/v1/study/sets/{res.data['id']}/attempts/",
        {"answers": {"1": "C", "2": "B"}, "duration_seconds": 42},
    )
    assert attempt.status_code == 201
    assert attempt.data["score"] == 1 and attempt.data["total"] == 2 and attempt.data["percentage"] == 50.0
    assert attempt.data["results"][1] == {
        "question_id": 2,
        "selected": "B",
        "correct_answer": "A",
        "is_correct": False,
        "explanation": "Atomic attribute values.",
    }
    listing = client.get("/api/v1/study/sets/", {"kind": "QUIZ"}).data["results"]
    assert listing[0]["attempt_count"] == 1 and listing[0]["best_score"] == 50.0
    assert UsageRecord.objects.filter(operation=Operation.QUIZ, success=True).exists()


def test_mock_exam_hides_answers_until_submitted(client, kb, document, llm, generate):
    llm.queue(MCQ)
    res = generate("mock-exam", {"knowledge_base": kb.id, "count": 10})
    assert res.data["time_limit_minutes"] == 15
    for q in res.data["content"]["questions"]:
        assert "answer" not in q and "explanation" not in q
        assert set(q["options"]) == set("ABCD")
    attempt = client.post(f"/api/v1/study/sets/{res.data['id']}/attempts/", {"answers": {"1": "c", "2": "A"}})
    assert attempt.data["score"] == 2
    assert attempt.data["results"][0]["correct_answer"] == "C"


def test_flashcards_summary_and_questions(client, kb, document, llm, generate):
    llm.queue({"cards": [{"question": "What is 1NF?", "answer": "Atomic values."}] * 2})
    cards = generate("flashcards", {"knowledge_base": kb.id, "document": document.id, "count": 5})
    assert cards.data["content"]["cards"] == [
        {"id": 1, "question": "What is 1NF?", "answer": "Atomic values."}
    ]

    llm.queue(
        {
            "title": "Normal forms",
            "short_summary": "Normalization levels.",
            "detailed_summary": "## 1NF\n...",
            "key_points": ["1NF atomic", "3NF transitive"],
        }
    )
    summary = generate("summary", {"knowledge_base": kb.id})
    assert summary.data["title"] == "Summary · Normal forms"
    assert summary.data["content"]["key_points"] == ["1NF atomic", "3NF transitive"]

    llm.queue(
        {
            "short_answer": [{"question": "Define 2NF.", "model_answer": "No partial dependencies."}],
            "long_answer": [{"question": "Compare 2NF and 3NF.", "model_answer": "..."}],
        }
    )
    questions = generate("questions", {"knowledge_base": kb.id, "count": 4})
    assert [
        q["id"] for q in questions.data["content"]["short_answer"] + questions.data["content"]["long_answer"]
    ] == [1, 2]


def test_invalid_json_is_retried_then_fails_cleanly(client, kb, document, llm, generate):
    llm.queue("not json", {"questions": []})
    res = generate("quiz", {"knowledge_base": kb.id})
    assert res.data["status"] == "FAILED"
    assert "No valid multiple-choice" in res.data["error"] or "non-empty list" in res.data["error"]
    assert len(llm.calls) == 2
    assert UsageRecord.objects.filter(operation=Operation.QUIZ, success=False).exists()


def test_invalid_json_then_valid_succeeds(client, kb, document, llm, generate):
    llm.queue("{broken", MCQ)
    assert generate("quiz", {"knowledge_base": kb.id}).data["status"] == "READY"


def test_topic_uses_semantic_retrieval(client, kb, document, llm, generate):
    llm.queue({"cards": [{"question": "q", "answer": "a"}]})
    generate("flashcards", {"knowledge_base": kb.id, "topic": "transitive dependencies third normal form"})
    prompt = llm.calls[-1][-1].content
    assert prompt.index("Third normal form") < prompt.index("TASK")
    assert 'Focus on: "transitive dependencies third normal form"' in prompt


def test_requires_ready_documents(client, kb):
    res = client.post("/api/v1/study/quiz/", {"knowledge_base": kb.id})
    assert res.status_code == 400
    assert "processed" in res.data["error"]["message"]


def test_count_limits(client, kb, document):
    assert client.post("/api/v1/study/mock-exam/", {"knowledge_base": kb.id, "count": 2}).status_code == 400
    assert client.post("/api/v1/study/flashcards/", {"knowledge_base": kb.id, "count": 31}).status_code == 400


def test_study_isolation(client, other_client, other_user, kb, document, llm, generate):
    llm.queue(MCQ)
    set_id = generate("quiz", {"knowledge_base": kb.id}).data["id"]
    assert other_client.get(f"/api/v1/study/sets/{set_id}/").status_code == 404
    assert other_client.post(f"/api/v1/study/sets/{set_id}/attempts/", {"answers": {}}).status_code == 404
    assert other_client.post("/api/v1/study/quiz/", {"knowledge_base": kb.id}).status_code == 400
    # A document from another workspace cannot be smuggled in either.
    foreign_kb = KnowledgeBase.objects.create(workspace=workspace_of(other_user), name="Theirs")
    res = client.post("/api/v1/study/quiz/", {"knowledge_base": foreign_kb.id})
    assert res.status_code == 400
    assert not StudySet.objects.filter(knowledge_base=foreign_kb).exists()


def test_parse_output_normalizes_and_rejects():
    raw = json.dumps({"questions": [{**MCQ["questions"][0], "answer": "c"}]})
    assert parse_output(StudyKind.QUIZ, raw, count=5)["questions"][0]["answer"] == "C"
    with pytest.raises(InvalidGeneration):
        parse_output(StudyKind.FLASHCARDS, json.dumps({"cards": []}), count=5)
    with pytest.raises(InvalidGeneration):
        parse_output(StudyKind.SUMMARY, "[]", count=1)


def test_usage_endpoints(client, kb, document, llm, generate, workspace, other_user):
    llm.queue(MCQ)
    generate("quiz", {"knowledge_base": kb.id})
    summary = client.get("/api/v1/usage/summary/").data
    operations = {row["operation"] for row in summary["by_operation"]}
    assert {"EMBEDDING", "QUIZ"} <= operations
    assert summary["totals"]["requests"] >= 2
    assert summary["totals"]["estimated_cost"] == 0
    records = client.get("/api/v1/usage/", {"operation": "QUIZ"}).data["results"]
    assert len(records) == 1 and records[0]["model"] == "test-scripted-llm"
    # Workspace-wide usage requires admin rights.
    from apps.workspaces.models import Role, WorkspaceMember
    from tests.conftest import client_for

    WorkspaceMember.objects.create(workspace=workspace, user=other_user, role=Role.MEMBER)
    member = client_for(other_user)
    assert member.get("/api/v1/usage/", {"workspace": workspace.id, "scope": "workspace"}).status_code == 403
    assert member.get("/api/v1/usage/", {"workspace": workspace.id}).data["results"] == []
