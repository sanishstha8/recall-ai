from rest_framework.exceptions import NotFound

from apps.documents.models import Document
from common.permissions import VIEW, member_workspace_ids, require_role


def scoped_documents(user):
    """Documents in workspaces the user belongs to. The single source of document scoping."""
    return Document.objects.filter(knowledge_base__workspace_id__in=member_workspace_ids(user))


def get_document_for(user, pk, minimum=VIEW) -> Document:
    document = (
        scoped_documents(user).select_related("knowledge_base").filter(pk=pk).first()
        if str(pk).isdigit()
        else None
    )
    if document is None:
        raise NotFound("Document not found.")
    require_role(user, document.knowledge_base.workspace_id, minimum)
    return document
