from django.urls import path

from .views import ApplicationDetailView, CandidateApplicationsView, CandidateJobApplicationStatusView, DashboardApplicationsView, DashboardStatsView

urlpatterns = [
    path("applications/", DashboardApplicationsView.as_view(), name="dashboard-applications"),
    path("applications/<int:pk>/", ApplicationDetailView.as_view(), name="dashboard-application-detail"),
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("my-applications/", CandidateApplicationsView.as_view(), name="candidate-applications"),
    path("my-applications/job/<int:job_id>/", CandidateJobApplicationStatusView.as_view(), name="candidate-job-status"),
]
