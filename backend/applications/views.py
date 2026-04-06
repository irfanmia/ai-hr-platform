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
        from ai_engine.resume_matcher import validate_is_resume, score_resume_match
        application = self.get_object()
        parsed_resume = parse_resume_for_application(application)

        # Step 1: Validate this is actually a resume
        validation = validate_is_resume(parsed_resume)
        if not validation["is_resume"]:
            return response.Response(
                {"error": "not_a_resume", "message": validation["reason"]},
                status=400
            )

        # Step 2: Score resume match against job requirements (0-50)
        match_result = score_resume_match(parsed_resume, application.job)

        # Step 3: Pass strategy to question generator
        parsed_resume["question_strategy"] = match_result["question_strategy"]
        parsed_resume["match_result"] = match_result
        questions = generate_interview_questions(application.job, parsed_resume)

        application.custom_answers = {
            **application.custom_answers,
            "parsed_resume": parsed_resume,
            "questions": questions,
            "match_result": match_result,
        }
        application.save(update_fields=["custom_answers"])
        return response.Response(
            {
                "application_id": application.id,
                "parsed_resume": parsed_resume,
                "questions": questions,
                "resume_match": match_result,
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


class CandidateApplicationsView(views.APIView):
    """Return applications belonging to the logged-in candidate by email."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        apps = Application.objects.filter(
            email__iexact=request.user.email
        ).select_related("job").order_by("-created_at")
        serializer = ApplicationSerializer(apps, many=True, context={"request": request})
        return response.Response(serializer.data)


class CandidateJobApplicationStatusView(views.APIView):
    """Check if the logged-in candidate has applied to a specific job."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id: int):
        app = Application.objects.filter(
            email__iexact=request.user.email,
            job_id=job_id
        ).first()
        if not app:
            return response.Response({"applied": False})
        return response.Response({
            "applied": True,
            "application_id": app.id,
            "status": app.status,
            "has_report": app.ai_report is not None,
            "has_resume": bool(app.resume),
        })
