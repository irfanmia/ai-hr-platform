"""
Public endpoints for the email-verification flow.

  GET  /api/auth/verify-email/?token=xxx          — confirm signup, log user in
  POST /api/auth/resend-verification/             — body: {email}; sends a fresh link
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import send_verification_email
from .models import EmailVerificationToken

User = get_user_model()


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _build_jwt_response(user) -> dict:
    """Mint JWT access + refresh tokens for a freshly-verified candidate."""
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    access["is_staff"] = user.is_staff
    access["is_superuser"] = user.is_superuser
    access["email"] = user.email
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    access["name"] = name
    return {
        "access": str(access),
        "refresh": str(refresh),
        "user": {"name": name, "email": user.email},
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email(request):
    """Mark the user as verified (is_active=True) and return JWT tokens.

    Idempotent for already-verified users: returns 200 with a fresh JWT
    so the verify-email page can finalise the auto-login flow even if
    the user clicked the link twice.
    """
    token_str = request.GET.get("token", "").strip()
    if not token_str:
        return Response({"detail": "Missing token."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        token = EmailVerificationToken.objects.select_related("user").get(token=token_str)
    except EmailVerificationToken.DoesNotExist:
        return Response(
            {"detail": "This verification link is invalid. Try requesting a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = token.user

    # Already verified earlier — return success + a fresh JWT so the page
    # still completes the auto-login UX.
    if user.is_active and token.used_at is not None:
        return Response(
            {"already_verified": True, **_build_jwt_response(user)},
            status=status.HTTP_200_OK,
        )

    if not token.is_valid:
        return Response(
            {"detail": "This verification link has expired. Request a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.is_active = True
    user.save(update_fields=["is_active"])
    token.mark_used()

    return Response(
        {"verified": True, **_build_jwt_response(user)},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification(request):
    """Send a fresh verification link if the user exists and isn't verified yet.

    Always returns 200 with a generic success message — never confirms
    whether an email is registered (avoids account-enumeration leak).
    """
    email = (request.data.get("email") or "").strip().lower()
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    generic_ok = Response(
        {"detail": "If an account exists for that email, we've sent a fresh verification link."},
        status=status.HTTP_200_OK,
    )

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return generic_ok

    # Already verified — silently succeed without firing another email
    if user.is_active:
        return generic_ok

    # Issue a fresh token (don't revoke the old ones — they expire on their own)
    token = EmailVerificationToken.objects.create(
        user=user,
        source_ip=_client_ip(request),
    )
    send_verification_email(user, token)

    return generic_ok
