from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.documents.views import DocumentViewSet, KnowledgeBaseDocumentsView

router = SimpleRouter()
router.register("documents", DocumentViewSet, basename="document")

urlpatterns = [
    path(
        "knowledge-bases/<int:kb_id>/documents/",
        KnowledgeBaseDocumentsView.as_view(),
        name="knowledge-base-documents",
    ),
    *router.urls,
]
