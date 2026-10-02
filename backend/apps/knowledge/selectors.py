from rest_framework.exceptions import NotFound

from apps.knowledge.models import KnowledgeBase
from common.permissions import VIEW, member_workspace_ids, require_role


def scoped_knowledge_bases(user):
    """Knowledge bases in workspaces the user belongs to. The single source of KB scoping."""
    return KnowledgeBase.objects.filter(workspace_id__in=member_workspace_ids(user))


def get_knowledge_base_for(user, pk, minimum=VIEW) -> KnowledgeBase:
    """Resolve a knowledge base by id, enforcing membership and role (404 for outsiders)."""
    kb = scoped_knowledge_bases(user).filter(pk=pk).first() if str(pk).isdigit() else None
    if kb is None:
        raise NotFound("Knowledge base not found.")
    require_role(user, kb.workspace_id, minimum)
    return kb
