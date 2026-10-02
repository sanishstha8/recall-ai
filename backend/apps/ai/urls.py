from django.urls import path

from apps.ai.views import KnowledgeBaseSearchView

urlpatterns = [
    path(
        "knowledge-bases/<int:kb_id>/search/", KnowledgeBaseSearchView.as_view(), name="knowledge-base-search"
    ),
]
