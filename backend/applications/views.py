from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, response, status, views, viewsets
from rest_framework.decorators import action

from ai_engine.answer_evaluator import evaluate_answers
from ai_engine.question_generator import generate_interview_questions
from ai_engine.report_generator import compile_ai_report
from ai_engine.resume_parser import parse_resume_for_application
from .models import Application
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationSerializer,
    ApplicationStatusSerializer,
    SubmitAnswersSerializer,
)


class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.select_related("job").all()

    def get_permissions(self):
        if self.action in {"create", "generate_questions", "submit_answers"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return ApplicationCreateSerializer
        if self.action == "partial_update":
            return ApplicationStatusSerializer
        return ApplicationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        job_id = self.request.query_params.get("job")
        status_value = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if job_id:
            queryset = queryset.filter(job_id=job_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset

    @action(detail=True, methods=["get"], url_path="generate-questions")
    def generate_questions(self, request, pk=None):
        application = self.get_object()
        parsed_resume = parse_resume_for_application(application)
        questions = generate_interview_questions(application.job, parsed_resume)
        application.custom_answers = {
            **application.custom_answers,
            "parsed_resume": parsed_resume,
            "questions": questions,
        }
        application.save(update_fields=["custom_answers"])
        return response.Response(
            {
                "application_id": application.id,
                "parsed_resume": parsed_resume,
                "questions": questions,
            }
        )

    @action(detail=True, methods=["post"], url_path="submit-answers")
    def submit_answers(self, request, pk=None):
        application = self.get_object()
        serializer = SubmitAnswersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        stored = application.custom_answers or {}
        questions = stored.get("questions", [])
        parsed_resume = stored.get("parsed_resume", parse_resume_for_application(application))
        evaluation = evaluate_answers(
            application=application,
            questions=questions,
            answers=serializer.validated_data["answers"],
            parsed_resume=parsed_resume,
        )
        report = compile_ai_report(application.job, parsed_resume, evaluation)

        application.custom_answers = {
            **stored,
            "submitted_answers": serializer.validated_data["answers"],
            "evaluation": evaluation,
        }
        application.ai_report = report
        application.ai_score = report["overall_score"]
        application.status = Application.Status.SCREENING
        application.save(update_fields=["custom_answers", "ai_report", "ai_score", "status"])

        return response.Response({"application_id": application.id, "report": report})


class DashboardApplicationsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        queryset = Application.objects.select_related("job").all()
        job_id = request.query_params.get("job")
        status_value = request.query_params.get("status")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if job_id:
            queryset = queryset.filter(job_id=job_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        serializer = ApplicationSerializer(queryset, many=True, context={"request": request})
        return response.Response(serializer.data)


class DashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        queryset = Application.objects.all()
        stats = queryset.aggregate(
            total_applications=Count("id"),
            shortlisted=Count("id", filter=Q(status=Application.Status.SHORTLISTED)),
            average_score=Avg("ai_score"),
        )
        new_today = queryset.filter(created_at__date=today).count()
        recent = Application.objects.select_related("job").all()[:5]

        return response.Response(
            {
                "total_applications": stats["total_applications"] or 0,
                "new_today": new_today,
                "shortlisted": stats["shortlisted"] or 0,
                "average_score": round(stats["average_score"] or 0),
                "recent_applications": ApplicationSerializer(
                    recent, many=True, context={"request": request}
                ).data,
            }
        )


class ApplicationDetailView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk: int):
        application = get_object_or_404(Application.objects.select_related("job"), pk=pk)
        serializer = ApplicationSerializer(application, context={"request": request})
        return response.Response(serializer.data)

    def patch(self, request, pk: int):
        application = get_object_or_404(Application, pk=pk)
        serializer = ApplicationStatusSerializer(application, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(ApplicationSerializer(application, context={"request": request}).data)
