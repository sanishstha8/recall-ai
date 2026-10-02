from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.study import views

router = SimpleRouter()
router.register("study/sets", views.StudySetViewSet, basename="study-set")

urlpatterns = [
    path("study/summary/", views.SummaryView.as_view(), name="study-summary"),
    path("study/flashcards/", views.FlashcardsView.as_view(), name="study-flashcards"),
    path("study/quiz/", views.QuizView.as_view(), name="study-quiz"),
    path("study/questions/", views.QuestionsView.as_view(), name="study-questions"),
    path("study/mock-exam/", views.MockExamView.as_view(), name="study-mock-exam"),
    *router.urls,
]
