import pytest

from apps.ai.providers import ChatMessage
from apps.ai.rag.context_builder import build_context
from apps.ai.rag.pipeline import RAGPipeline
from apps.ai.rag.prompt_builder import SYSTEM_PROMPT, build_messages, extract_cited_indices
from apps.ai.rag.reranker import LexicalReranker
from apps.ai.rag.retriever import HybridRetriever, RetrievedChunk, VectorRetriever
from apps.knowledge.models import KnowledgeBase
from tests.conftest import workspace_of

pytestmark = pytest.mark.django_db

DB_PAGES = [
    "Normalization organizes relational tables to reduce redundancy and update anomalies.",
    "First normal form 1NF requires atomic attribute values and no repeating groups.",
    "Second normal form 2NF removes partial dependencies on a composite primary key.",
    "Third normal form 3NF removes transitive dependencies between non key attributes.",
    "Transactions follow ACID: atomicity, consistency, isolation and durability.",
    "B-tree indexes accelerate range queries; hash indexes accelerate equality lookups.",
]


@pytest.fixture
def kb(workspace):
    return KnowledgeBase.objects.create(workspace=workspace, name="BSc CSIT")


@pytest.fixture
def document(kb, make_document):
    return make_document(kb, DB_PAGES)


def test_vector_retrieval_returns_relevant_pages_ranked(kb, document):
    result = VectorRetriever().retrieve(
        "What is third normal form transitive dependency?", knowledge_base_ids=[kb.id], top_k=3
    )
    assert result.chunks, "expected hits"
    assert result.chunks[0].page_number == 4
    assert result.chunks[0].document_name == "Advanced Database.pdf"
    scores = [c.score for c in result.chunks]
    assert scores == sorted(scores, reverse=True)
    assert len(result.chunks) <= 3


def test_retrieval_is_scoped_to_knowledge_bases(kb, document, other_user, make_document):
    foreign_kb = KnowledgeBase.objects.create(workspace=workspace_of(other_user), name="Other")
    make_document(foreign_kb, ["Third normal form secrets from another workspace."], user=other_user)
    sibling_kb = KnowledgeBase.objects.create(workspace=kb.workspace, name="Sibling")
    make_document(sibling_kb, ["Third normal form notes in a sibling knowledge base."])

    result = VectorRetriever().retrieve("third normal form", knowledge_base_ids=[kb.id], top_k=20)
    assert {c.document_id for c in result.chunks} == {document.id}


def test_retrieval_ignores_unready_documents_and_other_embedding_models(kb, document):
    document.chunks.update(embedding_model="some-other-model")
    assert VectorRetriever().retrieve("normal form", knowledge_base_ids=[kb.id]).chunks == []
    document.chunks.update(embedding_model="test-hashing-embedder")
    document.status = "PROCESSING"
    document.save()
    assert VectorRetriever().retrieve("normal form", knowledge_base_ids=[kb.id]).chunks == []


def test_hybrid_retriever_fuses_text_and_vector_hits(kb, document):
    result = HybridRetriever().retrieve("hash indexes equality", knowledge_base_ids=[kb.id], top_k=3)
    assert result.chunks[0].page_number == 6
    assert result.extra["text_hits"] >= 1


def _chunk(i, score, page=1, content=None, doc=1):
    return RetrievedChunk(
        chunk_id=i,
        document_id=doc,
        document_name="Doc.pdf",
        page_number=page,
        chunk_index=i,
        content=content or f"chunk {i}",
        score=score,
    )


def test_reranker_boosts_term_coverage_and_drops_overlapping_chunks():
    a = _chunk(1, 0.70, page=1, content="Unrelated words about cooking pasta and sauces")
    b = _chunk(2, 0.65, page=2, content="Third normal form removes transitive dependencies")
    c = _chunk(
        3, 0.64, page=2, content="Third normal form removes transitive dependencies between attributes"
    )
    ranked = LexicalReranker().rerank("third normal form transitive", [a, b, c])
    assert ranked[0].chunk_id in (2, 3)
    assert len([r for r in ranked if r.page_number == 2]) == 1


def test_context_builder_numbers_sources_and_applies_threshold(settings):
    chunks = [_chunk(1, 0.9, page=42), _chunk(2, 0.8, page=43), _chunk(3, 0.1, page=44)]
    context = build_context(chunks, max_chunks=5, min_score=0.3)
    assert [s.index for s in context.sources] == [1, 2]
    assert "SOURCE 1\nDocument: Doc.pdf\nPage: 42" in context.text
    assert "SOURCE 2\nDocument: Doc.pdf\nPage: 43" in context.text
    assert "Page: 44" not in context.text


def test_prompt_builder_enforces_grounding_rules():
    context = build_context([_chunk(1, 0.9, page=42, content="1NF means atomic values.")], min_score=0)
    history = [ChatMessage("user", "hi"), ChatMessage("assistant", "hello")]
    messages = build_messages("What is 1NF?", context, history)
    assert messages[0].role == "system" and messages[0].content == SYSTEM_PROMPT
    for rule in (
        "Never invent facts",
        "do not contain the answer",
        "square brackets",
        "General knowledge",
        "Never reveal",
    ):
        assert rule in SYSTEM_PROMPT
    assert messages[1:3] == history
    assert "SOURCE 1" in messages[-1].content and messages[-1].content.rstrip().endswith(
        "cite them with [n]."
    )

    empty = build_messages("What is 1NF?", build_context([]), [])
    assert "No relevant passages were found" in empty[-1].content


def test_extract_cited_indices():
    text = "1NF is atomic [1]. 2NF [2, 3] and again [1]. Bogus [9]. Year [2024]"
    assert extract_cited_indices(text, {1, 2, 3}) == [1, 2, 3]


def test_pipeline_end_to_end_prompt_contains_retrieved_context(kb, document, llm):
    llm.queue("3NF removes transitive dependencies [1].")
    pipeline = RAGPipeline()
    prepared = pipeline.prepare("Explain third normal form", knowledge_base_ids=[kb.id])
    answer = pipeline.generate(prepared)
    assert answer.content.startswith("3NF")
    sent = llm.calls[-1][-1].content
    assert "Third normal form 3NF removes transitive dependencies" in sent
    assert "Document: Advanced Database.pdf" in sent


def test_search_endpoint(client, other_client, kb, document):
    res = client.post(f"/api/v1/knowledge-bases/{kb.id}/search/", {"query": "ACID transactions", "top_k": 2})
    assert res.status_code == 200
    assert res.data["results"][0]["page_number"] == 5
    assert len(res.data["results"]) <= 2
    assert other_client.post(f"/api/v1/knowledge-bases/{kb.id}/search/", {"query": "ACID"}).status_code == 404
