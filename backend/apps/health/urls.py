from django.urls import path

from apps.health.views import HealthView, ReadinessView

urlpatterns = [
    path("", HealthView.as_view(), name="health"),
    path("ready/", ReadinessView.as_view(), name="health-ready"),
]
