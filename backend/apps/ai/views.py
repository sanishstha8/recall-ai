from dataclasses import asdict

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.rag.reranker import get_reranker
from apps.ai.rag.retriever import get_retriever
from apps.ai.serializers import SearchRequestSerializer, SearchResponseSerializer
from apps.knowledge.selectors import get_knowledge_base_for
from common.throttles import AIRateThrottle


class KnowledgeBaseSearchView(APIView):
    """Semantic search over a knowledge base's READY documents (no LLM call)."""

    throttle_classes = [AIRateThrottle]

    @extend_schema(request=SearchRequestSerializer, responses=SearchResponseSerializer, tags=["search"])
    def post(self, request, kb_id: int):
        kb = get_knowledge_base_for(request.user, kb_id)
        payload = SearchRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        query = payload.validated_data["query"].strip()
        top_k = payload.validated_data.get("top_k") or settings.RAG_TOP_K
        retrieval = get_retriever().retrieve(
            query,
            knowledge_base_ids=[kb.pk],
            document_ids=payload.validated_data.get("document_ids") or None,
            top_k=top_k,
        )
        ranked = get_reranker().rerank(query, retrieval.chunks)
        return Response(
            {
                "query": query,
                "embedding_model": retrieval.embedding_model,
                "latency_ms": retrieval.latency_ms,
                "results": [asdict(chunk) for chunk in ranked],
            }
        )
