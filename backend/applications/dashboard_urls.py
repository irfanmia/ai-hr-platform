from django.urls import path

from .views import ApplicationDetailView, DashboardApplicationsView, DashboardStatsView

urlpatterns = [
    path("applications/", DashboardApplicationsView.as_view(), name="dashboard-applications"),
    path("applications/<int:pk>/", ApplicationDetailView.as_view(), name="dashboard-application-detail"),
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
]
