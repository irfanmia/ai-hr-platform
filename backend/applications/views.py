import os
import uuid
from datetime import datetime, timezone as tz
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, response, status, views, viewsets
from rest_framework.decorators import action

from ai_engine.answer_evaluator import evaluate_answers
from ai_engine.audio_transcriber import TranscriptionError, transcribe_audio
from ai_engine.question_generator import generate_interview_questions
from ai_engine.report_generator import compile_ai_report
from ai_engine.resume_parser import parse_resume_for_application
from pdf_engine import (
    PdfMetadata,
    build_combined_pdf,
    build_report_pdf,
    build_responses_pdf,
    parse_verify_token,
)
from .models import Application
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationSerializer,
    ApplicationStatusSerializer,
    SubmitAnswersSerializer,
)


def _safe_filename(s: str) -> str:
    return "".join(c if c.isalnum() or c in "._- " else "_" for c in (s or "candidate")).strip().replace(" ", "_")[:60] or "candidate"


def _build_pdf_metadata(app: Application, doc_type: str, doc_title: str) -> PdfMetadata:
    return PdfMetadata(
        candidate_name=app.candidate_name or "",
        candidate_email=app.email or "",
        job_title=(app.job.title if app.job else ""),
        job_department=(app.job.department if app.job else ""),
        application_id=app.id,
        doc_type=doc_type,
        doc_title=doc_title,
        generated_at=datetime.now(tz=tz.utc),
    )


class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.select_related("job").all()

    def get_permissions(self):
        if self.action in {"create", "generate_questions", "submit_answers", "transcribe", "identity_snapshot"}:
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
        import os
        application = self.get_object()
        parsed_resume = parse_resume_for_application(application)

        # Step 1: AI validates the document is actually a resume
        # Pass the actual file path so Groq vision can inspect the document
        pdf_path = None
        if application.resume:
            try:
                pdf_path = application.resume.path
            except Exception:
                pass

        validation = validate_is_resume(parsed_resume, pdf_path=pdf_path)
        if not validation["is_resume"]:
            return response.Response(
                {"error": "not_a_resume", "message": validation["reason"]},
                status=400
            )

        # Step 2: Score resume match against job requirements (0-50)
        match_result = score_resume_match(parsed_resume, application.job)

        # Step 3: Generate interview questions based on match strategy
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

    @action(detail=True, methods=["post"], url_path="transcribe")
    def transcribe(self, request, pk=None):
        """
        Accept a short audio blob (the candidate's spoken answer to ONE
        interview question) and return the transcribed text.

        Audio is transcribed via Groq Whisper, biased with the job + resume
        skills so technical vocabulary survives intact. The audio bytes
        are NEVER persisted — they live in memory just long enough to call
        the Whisper API and are released immediately.

        Multipart form expected:
          file:           the audio Blob (webm/opus or mp4/aac)
          question_index: optional, for client-side correlation only
        """
        application = self.get_object()
        audio_file = request.FILES.get("file") or request.FILES.get("audio")
        if not audio_file:
            return response.Response(
                {"error": "missing_audio", "message": "No audio file in request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Surface the job & resume skill list to bias Whisper toward correct
        # technical vocabulary (React, Kubernetes, etc.) instead of common
        # English homophones ("communities" for "Kubernetes" is real).
        job_skills = list(application.job.skills or [])
        stored = application.custom_answers or {}
        parsed_resume = stored.get("parsed_resume") or {}
        resume_skills = list(parsed_resume.get("skills") or [])

        # Read all bytes once. The browser blob is small (Opus ~80 KB/min).
        try:
            audio_bytes = audio_file.read()
        finally:
            # Best-effort: drop reference. Django won't write to /tmp because
            # the upload is small enough to live in memory; if it did, the
            # InMemoryUploadedFile / TemporaryUploadedFile is GC'd here.
            try:
                audio_file.close()
            except Exception:
                pass

        try:
            result = transcribe_audio(
                audio_bytes=audio_bytes,
                filename=getattr(audio_file, "name", "answer.webm") or "answer.webm",
                job_skills=job_skills,
                resume_skills=resume_skills,
            )
        except TranscriptionError as exc:
            code = str(exc)

            # ── "Silent answer" — return 200 with empty text so the frontend
            #    can show a friendly retry/I-don't-know prompt instead of an
            #    error toast. Counts as no-response in scoring downstream.
            if code in ("empty_audio", "empty_transcription", "audio_too_short"):
                return response.Response(
                    {
                        "text": "",
                        "duration_ms": 0,
                        "language": "en",
                        "model": "silent",
                        "silent": True,
                    }
                )

            # Real errors below — keep the user-facing toast pathway.
            user_messages = {
                "audio_too_large": "That recording was too large. Keep answers under 3 minutes.",
                "audio_too_long": "That recording was too long. Keep answers under 3 minutes.",
                "faster_whisper_not_installed": "Server transcription engine is not installed.",
                "whisper_inference_error": "Transcription failed on the server — please try again.",
            }
            infra = {"faster_whisper_not_installed", "whisper_inference_error"}
            http_status = (
                status.HTTP_503_SERVICE_UNAVAILABLE
                if code in infra
                else status.HTTP_400_BAD_REQUEST
            )
            return response.Response(
                {"error": code, "message": user_messages.get(code, "Transcription failed.")},
                status=http_status,
            )
        finally:
            # Release the bytes immediately. We don't persist audio anywhere.
            audio_bytes = b""  # noqa: F841 — explicit clear

        return response.Response(
            {
                "text": result.text,
                "duration_ms": result.duration_ms,
                "language": result.language,
                "model": result.model,
            }
        )

    @action(detail=True, methods=["post"], url_path="identity-snapshot")
    def identity_snapshot(self, request, pk=None):
        """
        Accept ONE still frame (JPEG) captured from the candidate's camera
        during the interview, save under media/identity_snapshots/<id>/, and
        append metadata to application.identity_snapshots.

        Per design we capture 3 random frames per interview; this endpoint
        is called once per frame from the browser.

        We silently no-op (200 with skipped=true) if the candidate's job
        has snapshots disabled — keeps the frontend simpler. Real failures
        (no file, oversized, IO error) return 400.
        """
        application = self.get_object()
        job = application.job
        if not job or not getattr(job, "identity_snapshots_enabled", True):
            return response.Response({"skipped": True, "reason": "disabled_for_job"}, status=200)

        upload = request.FILES.get("file") or request.FILES.get("snapshot")
        if not upload:
            return response.Response(
                {"error": "missing_file", "message": "No snapshot in request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cap at 1 MB — JPEGs from a 480×360 webcam frame are ~30-80 KB
        if upload.size > 1_000_000:
            return response.Response(
                {"error": "snapshot_too_large", "message": "Snapshot exceeded the 1 MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cap captures at 6 per application as a hard ceiling — design says
        # 3, this protects against a buggy / malicious client spamming uploads.
        existing = application.identity_snapshots or []
        if len(existing) >= 6:
            return response.Response(
                {"skipped": True, "reason": "limit_reached"}, status=200,
            )

        captured_at = datetime.now(tz=tz.utc)
        # File path: identity_snapshots/<app_id>/<iso-utc>-<short_uuid>.jpg
        # short uuid avoids collisions if two browser timers fire on the
        # same UTC second.
        filename = f"{captured_at.strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
        rel_path = f"identity_snapshots/{application.id}/{filename}"
        try:
            saved_path = default_storage.save(rel_path, upload)
        except Exception as exc:  # noqa: BLE001
            return response.Response(
                {"error": "storage_error", "message": f"Couldn't save snapshot: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        application.identity_snapshots = existing + [{
            "path": saved_path,
            "captured_at": captured_at.isoformat(),
        }]
        application.save(update_fields=["identity_snapshots"])
        return response.Response({
            "ok": True,
            "path": saved_path,
            "captured_at": captured_at.isoformat(),
            "count": len(application.identity_snapshots),
        })


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
        prev_status = application.status
        serializer = ApplicationStatusSerializer(application, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Auto-delete identity snapshots when the application reaches a
        # terminal "rejected" state — per design (smallest legal/biometric
        # footprint). The DB record's `identity_snapshots` field is cleared
        # so the HR detail page no longer surfaces stale references.
        if (
            prev_status != Application.Status.REJECTED
            and application.status == Application.Status.REJECTED
            and application.identity_snapshots
        ):
            for snap in application.identity_snapshots:
                rel = snap.get("path") or ""
                if not rel:
                    continue
                try:
                    if default_storage.exists(rel):
                        default_storage.delete(rel)
                except Exception:
                    # Don't block the status change if a stray file is gone
                    pass
            application.identity_snapshots = []
            application.save(update_fields=["identity_snapshots"])

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


# ─── PDF download endpoints (HR only) ─────────────────────────────────────

class _ApplicationPdfBase(views.APIView):
    """Common helper: load the application + ensure HR access + extract Q/A.

    All three PDF endpoints inherit from this. Each subclass produces a
    different PDF body via _build_pdf().
    """
    permission_classes = [permissions.IsAdminUser]
    DOC_TYPE: str = "responses"
    DOC_TITLE: str = "Document"
    FILENAME_SUFFIX: str = "responses"

    def _build_pdf(self, app: Application, metadata: PdfMetadata, questions, answers, scores):
        raise NotImplementedError

    def get(self, request, pk: int):
        app = get_object_or_404(Application.objects.select_related("job"), pk=pk)
        stored = app.custom_answers or {}
        questions = stored.get("questions", []) or []
        answers = stored.get("submitted_answers", {}) or {}
        # Pull per-question scores out of the cached evaluation if present
        evaluation = stored.get("evaluation") or {}
        scored_answers = evaluation.get("scored_answers") or []
        scores = {s.get("question_id"): s.get("score") for s in scored_answers if s.get("question_id")}

        # Resolve identity snapshot paths to absolute disk locations so the
        # PDF builders (which are decoupled from Django settings) can embed
        # them. Stale entries are silently dropped at render time.
        snaps_for_pdf = []
        for snap in (app.identity_snapshots or []):
            rel = snap.get("path") or ""
            if not rel:
                continue
            abs_path = os.path.join(settings.MEDIA_ROOT, rel.lstrip("/"))
            snaps_for_pdf.append({
                "abs_path": abs_path,
                "captured_at": snap.get("captured_at"),
            })
        # Stash on the app instance for subclass _build_pdf overrides to read
        app._snaps_for_pdf = snaps_for_pdf

        metadata = _build_pdf_metadata(app, self.DOC_TYPE, self.DOC_TITLE)

        try:
            pdf_bytes = self._build_pdf(app, metadata, questions, answers, scores)
        except Exception as exc:  # noqa: BLE001
            return response.Response(
                {"error": "pdf_generation_failed", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        filename = f"{_safe_filename(app.candidate_name)}_{self.FILENAME_SUFFIX}_app{app.id}.pdf"
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        resp["Content-Length"] = str(len(pdf_bytes))
        return resp


class ApplicationResponsesPDFView(_ApplicationPdfBase):
    DOC_TYPE = "responses"
    DOC_TITLE = "Interview Responses"
    FILENAME_SUFFIX = "responses"

    def _build_pdf(self, app, metadata, questions, answers, scores):
        return build_responses_pdf(
            metadata, questions, answers, scores,
            identity_snapshots=getattr(app, "_snaps_for_pdf", None),
        )


class ApplicationReportPDFView(_ApplicationPdfBase):
    DOC_TYPE = "report"
    DOC_TITLE = "AI Evaluation Report"
    FILENAME_SUFFIX = "report"

    def _build_pdf(self, app, metadata, questions, answers, scores):
        return build_report_pdf(metadata, app.ai_report or {})


class ApplicationCombinedPDFView(_ApplicationPdfBase):
    DOC_TYPE = "combined"
    DOC_TITLE = "Document Pack"
    FILENAME_SUFFIX = "documentpack"

    def _build_pdf(self, app, metadata, questions, answers, scores):
        return build_combined_pdf(
            app, metadata, questions, answers, scores,
            identity_snapshots=getattr(app, "_snaps_for_pdf", None),
        )


# ─── Public verification endpoint ─────────────────────────────────────────

class VerifyDocumentView(views.APIView):
    """Public — anyone with a token (e.g. someone who scanned the QR on the
    PDF) can call this to confirm the document was issued by us. Returns
    minimal metadata so HR can sanity-check the doc against what they see
    in their dashboard, without leaking any extra PII."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        parsed = parse_verify_token(token)
        if not parsed:
            return response.Response(
                {"valid": False, "error": "invalid_or_tampered_token"},
                status=status.HTTP_200_OK,
            )
        try:
            app = Application.objects.select_related("job").get(pk=parsed["application_id"])
        except Application.DoesNotExist:
            return response.Response(
                {"valid": False, "error": "application_not_found"},
                status=status.HTTP_200_OK,
            )
        return response.Response({
            "valid": True,
            "candidate_name": app.candidate_name,
            "candidate_email": app.email,
            "job_title": (app.job.title if app.job else None),
            "application_id": app.id,
            "doc_type": parsed["doc_type"],
            "issued_at": parsed["generated_at"].isoformat(),
            "current_status": app.status,
        })
