from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.workspaces.views import WorkspaceMemberViewSet, WorkspaceViewSet

router = SimpleRouter()
router.register("workspaces", WorkspaceViewSet, basename="workspace")

member_list = WorkspaceMemberViewSet.as_view({"get": "list", "post": "create"})
member_detail = WorkspaceMemberViewSet.as_view({"patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    *router.urls,
    path("workspaces/<int:workspace_pk>/members/", member_list, name="workspace-member-list"),
    path(
        "workspaces/<int:workspace_pk>/members/<int:pk>/",
        member_detail,
        name="workspace-member-detail",
    ),
]
