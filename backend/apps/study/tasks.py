from celery import shared_task

from apps.study import services
from apps.study.models import StudySet


@shared_task(acks_late=True)
def generate_study_set_task(study_set_id: int) -> str:
    if not StudySet.objects.filter(pk=study_set_id).exists():
        return "deleted"
    return services.generate_study_set(study_set_id).status
