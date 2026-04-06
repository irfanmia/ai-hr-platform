from django.contrib.auth import get_user_model
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
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
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {"name": name, "email": email},
    }, status=status.HTTP_201_CREATED)
