"""
Public endpoint for the "Book a demo" form.

POST /api/demo-requests/  — anonymous, no auth required.

Rate limit: 5 submissions / hour per IP. The DB row is the source of
truth; SES sends are best-effort and never block the 200 response so
the form stays responsive even when SES is sandboxed or rate-limited.
"""
from __future__ import annotations

import threading
from collections import defaultdict, deque
from time import monotonic
from typing import Deque

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import send_demo_emails
from .models import DemoRequest
from .serializers import DemoRequestCreateSerializer


# ─── Tiny in-process rate limiter ─────────────────────────────────────────
# Per-IP sliding window. In-memory — fine for single-droplet deployment;
# swap for django-ratelimit when we go multi-instance.

_RATE_WINDOW_SECONDS = 3600
_RATE_MAX = 5
_RATE_LOG: dict[str, Deque[float]] = defaultdict(deque)
_RATE_LOCK = threading.Lock()


def _client_ip(request: Request) -> str:
    """Trust the rightmost X-Forwarded-For hop (Vercel/Nginx in front)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _rate_check(ip: str) -> bool:
    """True if the request is allowed, False if over budget."""
    now = monotonic()
    with _RATE_LOCK:
        log = _RATE_LOG[ip]
        # Drop expired entries
        while log and now - log[0] > _RATE_WINDOW_SECONDS:
            log.popleft()
        if len(log) >= _RATE_MAX:
            return False
        log.append(now)
        return True


# ─── View ──────────────────────────────────────────────────────────────────

class DemoRequestCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        ip = _client_ip(request)

        if not _rate_check(ip):
            return Response(
                {"detail": "Too many submissions from this IP. Try again in an hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = DemoRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req = DemoRequest.objects.create(
            **serializer.validated_data,
            source_ip=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:400],
            referer=request.META.get("HTTP_REFERER", "")[:400],
        )

        # Best-effort email send. Don't block the response on SMTP latency:
        # spawn a daemon thread so the form snaps back instantly.
        def _send_in_background(pk: int) -> None:
            try:
                row = DemoRequest.objects.get(pk=pk)
                send_demo_emails(row)
            except Exception:
                # send_demo_emails already logs + writes last_email_error;
                # this except is just belt-and-braces for any setup error.
                import logging
                logging.getLogger(__name__).exception(
                    "Background email send failed for DemoRequest %s", pk,
                )

        threading.Thread(
            target=_send_in_background, args=(req.id,), daemon=True,
        ).start()

        return Response(
            {
                "id": req.id,
                "message": "Thanks — we'll be in touch within one business day.",
            },
            status=status.HTTP_201_CREATED,
        )
