from django.contrib.auth import get_user_model
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()


class HRTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["username"] = user.get_username()
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser
        return token

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and "@" in username:
            try:
                user = User.objects.get(email__iexact=username)
                attrs["username"] = getattr(user, User.USERNAME_FIELD)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError("No HR user found for this email.") from exc

        return super().validate(attrs)


class HRTokenObtainPairView(TokenObtainPairView):
    serializer_class = HRTokenObtainPairSerializer


def _client_ip(request) -> str:
    """Trust the rightmost X-Forwarded-For hop (Vercel/Nginx in front)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


@api_view(["POST"])
@permission_classes([AllowAny])
def candidate_register(request):
    """Register a candidate account and email a verification link.

    The user is created with `is_active=False` so SimpleJWT blocks login
    until they click the link in the verification email. Returns
    `verification_required: True` (no JWT tokens) — the frontend swaps
    the form for a "check your email" message.

    If the user already exists but is unverified, we treat the call as a
    resend-verification — generate a fresh token and email it. Avoids
    the dead-end where someone signs up, ignores the email, and comes
    back to a "this email already exists" wall.
    """
    from accounts.emails import send_verification_email
    from accounts.models import EmailVerificationToken

    User = get_user_model()
    name = request.data.get("name", "").strip()
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not name or not email or not password:
        return Response({"error": "Name, email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 6:
        return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

    existing = User.objects.filter(email__iexact=email).first()
    if existing:
        if existing.is_active:
            return Response(
                {"error": "An account with this email already exists. Please sign in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Resend the verification email instead of bouncing the user
        token = EmailVerificationToken.objects.create(
            user=existing, source_ip=_client_ip(request),
        )
        send_verification_email(existing, token)
        return Response(
            {
                "verification_required": True,
                "email": email,
                "message": "We've re-sent the verification link to your email.",
            },
            status=status.HTTP_200_OK,
        )

    # Build a unique username from email
    base_username = email.split("@")[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    parts = name.split()
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=parts[0],
        last_name=" ".join(parts[1:]),
    )
    # Lock the account until the email is verified. HR/admin accounts
    # are created via createsuperuser / Django admin and bypass this.
    user.is_active = False
    user.save(update_fields=["is_active"])

    token = EmailVerificationToken.objects.create(
        user=user, source_ip=_client_ip(request),
    )
    send_verification_email(user, token)

    return Response(
        {
            "verification_required": True,
            "email": email,
            "message": "We've sent a verification link to your email. "
                       "Click it to finish setting up your account.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def candidate_profile(request):
    """Return current user profile info."""
    user = request.user
    return Response({
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}".strip() or user.username,
        "email": user.email,
        "username": user.username,
        "is_staff": user.is_staff,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update current user name and/or password."""
    user = request.user
    name = request.data.get("name", "").strip()
    password = request.data.get("password", "").strip()

    if name:
        parts = name.split()
        user.first_name = parts[0]
        user.last_name = " ".join(parts[1:])
    if password:
        if len(password) < 6:
            return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
    user.save()
    return Response({"success": True, "name": f"{user.first_name} {user.last_name}".strip()})
