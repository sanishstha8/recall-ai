from __future__ import annotations

import re

from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.documents import services
from apps.documents.models import DocumentStatus
from apps.documents.selectors import get_document_for, scoped_documents
from apps.documents.serializers import (
    DocumentPageSerializer,
    DocumentSerializer,
    DocumentStatusSerializer,
    DocumentUploadSerializer,
    PageSearchResultSerializer,
)
from apps.documents.validators import CONTENT_TYPES
from apps.knowledge.selectors import get_knowledge_base_for
from common.permissions import CONTRIBUTE, MANAGE, VIEW, require_role
from common.storage import get_document_storage
from common.throttles import UploadRateThrottle

LIST_FILTERS = [
    OpenApiParameter("status", OpenApiTypes.STR, enum=DocumentStatus.values),
    OpenApiParameter("search", OpenApiTypes.STR, description="Filter by name"),
]


def _filter(qs, params):
    if (state := params.get("status")) in DocumentStatus.values:
        qs = qs.filter(status=state)
    if search := params.get("search"):
        qs = qs.filter(name__icontains=search.strip())
    return qs


@extend_schema(tags=["documents"])
class KnowledgeBaseDocumentsView(generics.ListCreateAPIView):
    """List documents in a knowledge base, or upload a new one (multipart/form-data)."""

    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_throttles(self):
        return [UploadRateThrottle()] if self.request.method == "POST" else super().get_throttles()

    def get_queryset(self):
        kb = get_knowledge_base_for(self.request.user, self.kwargs["kb_id"])
        qs = kb.documents.select_related("knowledge_base", "uploaded_by")
        return _filter(qs, self.request.query_params)

    @extend_schema(parameters=LIST_FILTERS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request={"multipart/form-data": DocumentUploadSerializer}, responses={201: DocumentSerializer}
    )
    def post(self, request, *args, **kwargs):
        kb = get_knowledge_base_for(request.user, kwargs["kb_id"], CONTRIBUTE)
        upload = DocumentUploadSerializer(data=request.data)
        upload.is_valid(raise_exception=True)
        document = services.upload_document(
            knowledge_base=kb,
            user=request.user,
            file=upload.validated_data["file"],
            name=upload.validated_data.get("name") or None,
        )
        document.refresh_from_db()
        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["documents"])
class DocumentViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    serializer_class = DocumentSerializer

    def get_queryset(self):
        qs = scoped_documents(self.request.user).select_related("knowledge_base", "uploaded_by")
        params = self.request.query_params
        if (workspace := params.get("workspace", "")).isdigit():
            qs = qs.filter(knowledge_base__workspace_id=workspace)
        if (kb := params.get("knowledge_base", "")).isdigit():
            qs = qs.filter(knowledge_base_id=kb)
        return _filter(qs, params)

    def get_object(self):
        return get_document_for(self.request.user, self.kwargs["pk"])

    @extend_schema(
        parameters=[
            *LIST_FILTERS,
            OpenApiParameter("workspace", OpenApiTypes.INT),
            OpenApiParameter("knowledge_base", OpenApiTypes.INT),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        is_uploader = document.uploaded_by_id == request.user.pk
        require_role(
            request.user, document.knowledge_base.workspace_id, CONTRIBUTE if is_uploader else MANAGE
        )
        services.delete_document(document)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={202: DocumentSerializer})
    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = get_document_for(request.user, pk, CONTRIBUTE)
        services.reprocess_document(document)
        document.refresh_from_db()
        return Response(DocumentSerializer(document).data, status=status.HTTP_202_ACCEPTED)

    @extend_schema(responses=DocumentStatusSerializer)
    @action(detail=True, methods=["get"], url_path="status")
    def processing_status(self, request, pk=None):
        return Response(DocumentStatusSerializer(self.get_object()).data)

    @extend_schema(
        parameters=[OpenApiParameter("page_number", OpenApiTypes.INT, description="Return one page")],
        responses=DocumentPageSerializer(many=True),
    )
    @action(detail=True, methods=["get"])
    def pages(self, request, pk=None):
        document = self.get_object()
        qs = document.pages.order_by("page_number")
        if (number := request.query_params.get("page_number", "")).isdigit():
            page = qs.filter(page_number=int(number)).first()
            if page is None:
                raise NotFound("Page not found.")
            return Response(DocumentPageSerializer(page).data)
        paginated = self.paginate_queryset(qs)
        return self.get_paginated_response(DocumentPageSerializer(paginated, many=True).data)

    @extend_schema(
        parameters=[OpenApiParameter("q", OpenApiTypes.STR, required=True)],
        responses=PageSearchResultSerializer(many=True),
    )
    @action(detail=True, methods=["get"], url_path="search-text")
    def search_text(self, request, pk=None):
        document = self.get_object()
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            raise ValidationError({"q": "Enter at least 2 characters."})
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        results = []
        for page in document.pages.filter(content__icontains=query).order_by("page_number")[:200]:
            matches = pattern.findall(page.content)
            first = pattern.search(page.content)
            start = max(0, first.start() - 80) if first else 0
            snippet = page.content[start : start + 200].replace("\n", " ")
            results.append({"page_number": page.page_number, "matches": len(matches), "snippet": snippet})
        return Response(PageSearchResultSerializer(results, many=True).data)

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        document = self.get_object()
        require_role(request.user, document.knowledge_base.workspace_id, VIEW)
        try:
            handle = get_document_storage().open(document.storage_path)
        except FileNotFoundError:
            raise NotFound("The original file is no longer available.") from None
        response = FileResponse(
            handle,
            content_type=CONTENT_TYPES[document.file_type],
            as_attachment=request.query_params.get("download") == "1",
            filename=document.original_filename,
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return response
