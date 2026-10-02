from rest_framework.routers import SimpleRouter

from apps.knowledge.views import KnowledgeBaseViewSet

router = SimpleRouter()
router.register("knowledge-bases", KnowledgeBaseViewSet, basename="knowledge-base")

urlpatterns = router.urls
