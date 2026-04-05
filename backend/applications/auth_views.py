from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
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
