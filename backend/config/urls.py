from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from applications.auth_views import HRTokenObtainPairView, candidate_register

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/jobs/", include("jobs.urls")),
    path("api/applications/", include("applications.urls")),
    path("api/dashboard/", include("applications.dashboard_urls")),
    path("api/auth/login/", HRTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/register/", candidate_register, name="candidate_register"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
