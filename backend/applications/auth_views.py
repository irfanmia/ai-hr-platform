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


@api_view(["POST"])
@permission_classes([AllowAny])
def candidate_register(request):
    """Register a candidate account and return JWT tokens."""
    User = get_user_model()
    name = request.data.get("name", "").strip()
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not name or not email or not password:
        return Response({"error": "Name, email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 6:
        return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    # Build a unique username from email
    base_username = email.split("@")[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    user = User.objects.create_user(username=username, email=email, password=password, first_name=name.split()[0], last_name=" ".join(name.split()[1:]))

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    # Embed is_staff in token
    access["is_staff"] = user.is_staff
    access["is_superuser"] = user.is_superuser
    access["email"] = email
    return Response({
        "access": str(access),
        "refresh": str(refresh),
        "user": {"name": name, "email": email},
    }, status=status.HTTP_201_CREATED)


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
