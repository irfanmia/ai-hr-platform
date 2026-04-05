from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import Job
from .serializers import JobSerializer


class IsAuthenticatedOrReadOnlyForListDetail(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticatedOrReadOnlyForListDetail]

    def get_queryset(self):
        queryset = Job.objects.all()

        if not self.request.user.is_authenticated:
            queryset = queryset.filter(is_active=True)

        search = self.request.query_params.get("search")
        location_types = self.request.query_params.getlist("location_type")
        min_experience = self.request.query_params.get("min_experience")
        max_experience = self.request.query_params.get("max_experience")
        skills = self.request.query_params.get("skills")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(department__icontains=search)
                | Q(description__icontains=search)
            )
        if location_types:
            queryset = queryset.filter(location_type__in=location_types)
        if min_experience:
            queryset = queryset.filter(experience_years_max__gte=min_experience)
        if max_experience:
            queryset = queryset.filter(experience_years_min__lte=max_experience)
        if skills:
            for skill in [item.strip() for item in skills.split(",") if item.strip()]:
                queryset = queryset.filter(skills__icontains=skill)

        return queryset
