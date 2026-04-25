from django.urls import path

from .views import resend_verification, verify_email

urlpatterns = [
    path("verify-email/", verify_email, name="verify-email"),
    path("resend-verification/", resend_verification, name="resend-verification"),
]
