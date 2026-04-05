from rest_framework import serializers

from applications.models import Application
from .models import Job


class JobSerializer(serializers.ModelSerializer):
    applications_count = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = "__all__"

    def get_applications_count(self, obj: Job) -> int:
        return Application.objects.filter(job=obj).count()
