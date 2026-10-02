from django.urls import path

from apps.usage.views import AdminAnalyticsView, UsageListView, UsageSummaryView

urlpatterns = [
    path("usage/", UsageListView.as_view(), name="usage-list"),
    path("usage/summary/", UsageSummaryView.as_view(), name="usage-summary"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
]
