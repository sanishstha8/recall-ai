import json

import pytest

from apps.conversations.models import Citation, Conversation, Message
from apps.knowledge.models import KnowledgeBase
from apps.usage.models import Operation, UsageRecord
from tests.conftest import workspace_of

pytestmark = pytest.mark.django_db

PAGES = [
    "Normalization organizes relational tables to reduce redundancy and update anomalies.",
    "First normal form 1NF requires atomic attribute values and no repeating groups.",
    "Second normal form 2NF removes partial dependencies on a composite primary key.",
    "Third normal form 3NF removes transitive dependencies between non key attributes.",
]


@pytest.fixture
def kb(workspace):
    return KnowledgeBase.objects.create(workspace=workspace, name="BSc CSIT")


@pytest.fixture
def document(kb, make_document):
    return make_document(kb, PAGES)


@pytest.fixture
def conversation(client, workspace, kb):
    res = client.post("/api/v1/conversations/", {"workspace": workspace.id, "knowledge_base": kb.id})
    assert res.status_code == 201, res.data
    return Conversation.objects.get(pk=res.data["id"])


def parse_sse(response) -> list[tuple[str, dict]]:
    body = b"".join(response.streaming_content).decode()
    events = []
    for frame in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in frame.split("\n"))
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_conversation_crud(client, workspace, kb):
    created = client.post("/api/v1/conversations/", {"workspace": workspace.id, "knowledge_base": kb.id})
    assert created.status_code == 201
    cid = created.data["id"]
    assert created.data["knowledge_base_name"] == "BSc CSIT"
    renamed = client.patch(f"/api/v1/conversations/{cid}/", {"title": "Exam prep"})
    assert renamed.data["title"] == "Exam prep"
    assert [c["id"] for c in client.get("/api/v1/conversations/").data["results"]] == [cid]
    assert client.delete(f"/api/v1/conversations/{cid}/").status_code == 204
    assert not Conversation.objects.filter(pk=cid).exists()


def test_conversation_isolation(conversation, other_client, other_user, kb):
    base = f"/api/v1/conversations/{conversation.id}"
    assert other_client.get(f"{base}/").status_code == 404
    assert other_client.get(f"{base}/messages/").status_code == 404
    assert other_client.post(f"{base}/messages/", {"content": "hi"}).status_code == 404
    assert other_client.post(f"{base}/stream/", {"content": "hi"}).status_code == 404
    assert other_client.delete(f"{base}/").status_code == 404
    # Cannot create a conversation pointing at someone else's knowledge base or workspace.
    own_ws = workspace_of(other_user)
    res = other_client.post("/api/v1/conversations/", {"workspace": own_ws.id, "knowledge_base": kb.id})
    assert res.status_code == 400
    res = other_client.post("/api/v1/conversations/", {"workspace": kb.workspace_id})
    assert res.status_code == 400


def test_ask_persists_answer_citations_and_usage(client, conversation, document, llm):
    llm.queue("3NF removes transitive dependencies [1]. Compare with 2NF [2].")
    res = client.post(
        f"/api/v1/conversations/{conversation.id}/messages/",
        {"content": "Explain normalization and give examples of 1NF, 2NF and 3NF."},
    )
    assert res.status_code == 201, res.data
    answer = res.data["assistant_message"]
    assert answer["role"] == "ASSISTANT"
    assert answer["content"].startswith("3NF")
    assert answer["total_tokens"] > 0

    cited = [c for c in answer["citations"] if c["cited"]]
    assert [c["source_index"] for c in cited] == [1, 2]
    for citation in answer["citations"]:
        assert citation["document"] == document.id
        assert citation["document_name"] == "Advanced Database.pdf"
        page = document.pages.get(page_number=citation["page_number"])
        assert citation["quoted_content"] in page.content

    conversation.refresh_from_db()
    assert conversation.title.startswith("Explain normalization")
    assert conversation.model == "test-scripted-llm"
    usage = UsageRecord.objects.get(operation=Operation.CHAT)
    assert usage.input_tokens > 0 and usage.output_tokens > 0 and usage.success

    history = client.get(f"/api/v1/conversations/{conversation.id}/messages/").data
    assert [m["role"] for m in history] == ["USER", "ASSISTANT"]
    assert history[1]["citations"]


def test_stream_emits_sse_events_in_order(client, conversation, document, llm):
    llm.queue("Normalization reduces redundancy [1].")
    res = client.post(
        f"/api/v1/conversations/{conversation.id}/stream/", {"content": "What is normalization?"}
    )
    assert res.status_code == 200
    assert res["Content-Type"] == "text/event-stream"
    assert res["Cache-Control"].startswith("no-cache")
    events = parse_sse(res)
    names = [e for e, _ in events]
    assert names[0] == "start" and names[1] == "sources" and names[-1] == "done"
    assert names.count("token") > 1

    streamed = "".join(d["delta"] for e, d in events if e == "token")
    assert streamed == "Normalization reduces redundancy [1]."
    sources = events[1][1]
    assert sources and sources[0]["document_name"] == "Advanced Database.pdf"

    done = events[-1][1]["message"]
    assert done["content"] == streamed
    assert done["citations"][0]["cited"] is True
    assert Message.objects.filter(conversation=conversation).count() == 2


def test_regenerate_replaces_last_answer(client, conversation, document, llm):
    llm.queue("First answer [1].", "Second answer [1].")
    client.post(f"/api/v1/conversations/{conversation.id}/messages/", {"content": "What is 1NF?"})
    res = client.post(f"/api/v1/conversations/{conversation.id}/stream/", {"regenerate": True})
    events = parse_sse(res)
    assert events[-1][1]["message"]["content"] == "Second answer [1]."
    contents = list(conversation.messages.values_list("content", flat=True))
    assert contents == ["What is 1NF?", "Second answer [1]."]


def test_history_and_follow_up_retrieval(client, conversation, document, llm):
    llm.queue("1NF means atomic values [1].", "An example table ... [1]")
    client.post(
        f"/api/v1/conversations/{conversation.id}/messages/", {"content": "Explain first normal form 1NF"}
    )
    client.post(f"/api/v1/conversations/{conversation.id}/messages/", {"content": "Give an example"})
    second_prompt = llm.calls[-1]
    roles = [m.role for m in second_prompt]
    assert roles == ["system", "user", "assistant", "user"]
    # The short follow-up still retrieved 1NF context thanks to the previous question.
    assert "First normal form 1NF" in second_prompt[-1].content


def test_no_relevant_context_is_explicit(client, workspace, llm):
    empty_kb = KnowledgeBase.objects.create(workspace=workspace, name="Empty")
    conv = client.post(
        "/api/v1/conversations/", {"workspace": workspace.id, "knowledge_base": empty_kb.id}
    ).data
    llm.queue("Your documents don't cover this.")
    res = client.post(
        f"/api/v1/conversations/{conv['id']}/messages/", {"content": "What is quantum gravity?"}
    )
    assert res.data["assistant_message"]["citations"] == []
    assert "No relevant passages were found" in llm.calls[-1][-1].content


def test_conversation_without_kb_searches_whole_workspace(client, workspace, document, llm):
    conv = client.post("/api/v1/conversations/", {"workspace": workspace.id}).data
    llm.queue("Answer [1].")
    res = client.post(f"/api/v1/conversations/{conv['id']}/messages/", {"content": "third normal form"})
    assert res.data["assistant_message"]["citations"]


def test_stream_reports_ai_errors_as_event(client, conversation, document, settings):
    settings.AI_LLM_PROVIDER = "tests.test_chat.BrokenLLM"
    res = client.post(f"/api/v1/conversations/{conversation.id}/stream/", {"content": "What is 1NF?"})
    events = parse_sse(res)
    assert events[-1][0] == "error"
    assert "Cannot reach Ollama" in events[-1][1]["message"]
    assert not conversation.messages.filter(role="ASSISTANT").exists()
    assert UsageRecord.objects.filter(operation=Operation.CHAT, success=False).exists()


def test_blocking_ask_maps_ai_outage_to_503(client, conversation, document, settings):
    settings.AI_LLM_PROVIDER = "tests.test_chat.BrokenLLM"
    res = client.post(f"/api/v1/conversations/{conversation.id}/messages/", {"content": "What is 1NF?"})
    assert res.status_code == 503
    assert res.data["error"]["code"] == "ai_unavailable"


def test_empty_message_rejected(client, conversation):
    res = client.post(f"/api/v1/conversations/{conversation.id}/stream/", {"content": "   "})
    assert res.status_code == 400


def test_citation_survives_document_reprocessing(
    client, conversation, document, llm, django_capture_on_commit_callbacks
):
    client.post(f"/api/v1/conversations/{conversation.id}/messages/", {"content": "third normal form"})
    with django_capture_on_commit_callbacks(execute=True):
        client.post(f"/api/v1/documents/{document.id}/reprocess/")
    citation = Citation.objects.first()
    assert citation.chunk_id is None  # old chunk replaced
    assert citation.page_number and citation.quoted_content


class BrokenLLM:
    model = "broken"

    def _raise(self, *args, **kwargs):
        from apps.ai.providers import AIProviderUnavailable

        raise AIProviderUnavailable("Cannot reach Ollama at http://ollama:11434.")

    generate = _raise

    def stream(self, *args, **kwargs):
        self._raise()
        yield  # pragma: no cover
