from rest_framework import serializers

from jobs.models import Job
from jobs.serializers import JobSerializer
from .models import Application


class ApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "candidate_name",
            "email",
            "phone",
            "resume",
            "portfolio_url",
            "github_url",
            "linkedin_url",
            "custom_answers",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "status", "created_at")

    def validate_job(self, value: Job) -> Job:
        if not value.is_active:
            raise serializers.ValidationError("Applications are closed for this role.")
        return value

    def validate_custom_answers(self, value):
        if isinstance(value, str):
            try:
                import json

                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("custom_answers must be valid JSON.") from exc
        return value


class ApplicationSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    resume_url = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = "__all__"

    def get_resume_url(self, obj: Application):
        request = self.context.get("request")
        if not obj.resume:
            return None
        if request:
            return request.build_absolute_uri(obj.resume.url)
        return obj.resume.url


class ApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ("status",)


class SubmitAnswersSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())
