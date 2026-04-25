"""DRF serializer for the demo-request public submission form."""
from __future__ import annotations

import re

from rest_framework import serializers

from .models import DemoRequest

# Loose international phone regex — allows +, spaces, dashes, parentheses,
# 7–20 digits total. We only validate format, not deliverability.
_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,25}$")


class DemoRequestCreateSerializer(serializers.ModelSerializer):
    """
    Public-facing serializer. Only the form fields are writable; everything
    else (status, send flags, IP, etc.) is set server-side or by admin.
    """

    class Meta:
        model = DemoRequest
        fields = ["name", "email", "company", "designation", "phone", "message"]
        extra_kwargs = {
            "message": {"required": False, "allow_blank": True},
        }

    def validate_name(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Please enter your full name.")
        return v

    def validate_company(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Please enter your company name.")
        return v

    def validate_designation(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Please enter your role / designation.")
        return v

    def validate_phone(self, value: str) -> str:
        v = value.strip()
        if not _PHONE_RE.match(v):
            raise serializers.ValidationError(
                "Please enter a valid phone number with country code.",
            )
        return v
