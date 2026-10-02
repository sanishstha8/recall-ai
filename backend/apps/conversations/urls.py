from rest_framework.routers import SimpleRouter

from apps.conversations.views import ConversationViewSet

router = SimpleRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = router.urls
