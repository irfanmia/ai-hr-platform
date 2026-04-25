from django.urls import path

from .views import (
    ApplicationCombinedPDFView,
    ApplicationDetailView,
    ApplicationReportPDFView,
    ApplicationResponsesPDFView,
    CandidateApplicationsView,
    CandidateJobApplicationStatusView,
    DashboardApplicationsView,
    DashboardStatsView,
)

urlpatterns = [
    path("applications/", DashboardApplicationsView.as_view(), name="dashboard-applications"),
    path("applications/<int:pk>/", ApplicationDetailView.as_view(), name="dashboard-application-detail"),
    # PDF download endpoints (HR only)
    path("applications/<int:pk>/pdf/responses/",
         ApplicationResponsesPDFView.as_view(), name="application-pdf-responses"),
    path("applications/<int:pk>/pdf/report/",
         ApplicationReportPDFView.as_view(), name="application-pdf-report"),
    path("applications/<int:pk>/pdf/combined/",
         ApplicationCombinedPDFView.as_view(), name="application-pdf-combined"),
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("my-applications/", CandidateApplicationsView.as_view(), name="candidate-applications"),
    path("my-applications/job/<int:job_id>/", CandidateJobApplicationStatusView.as_view(), name="candidate-job-status"),
]
