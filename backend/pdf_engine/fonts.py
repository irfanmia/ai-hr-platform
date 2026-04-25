"""
Brand font registration for reportlab — keeps PDF typography in sync with
the web app (Mulish across the board).

Mulish isn't bundled with reportlab the way Helvetica is. We download the
TTF files from the canonical Google Fonts GitHub repo on first use and
cache them under backend/pdf_engine/fonts/. Subsequent calls are instant.

If the download fails (no internet, GitHub down, etc.) we transparently
fall back to Helvetica so PDF generation never breaks because of a font
problem. The visual difference between Mulish and Helvetica is small
enough that an HR user gets a passable document either way.

Usage in PDF builders:

    from .fonts import brand_fonts
    F = brand_fonts()                 # {"regular": "Mulish", "bold": ...}
    ParagraphStyle("X", fontName=F["bold"], ...)
    canvas.setFont(F["regular"], 9)
"""

from __future__ import annotations

import logging
import os
import threading
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Source of truth ─────────────────────────────────────────────────────
# Variable-weight static TTFs from Google's official fonts repo.
# `?raw=true` ensures GitHub serves the binary, not the rendered HTML page.
MULISH_BASE = (
    "https://github.com/google/fonts/raw/main/ofl/mulish/static/"
)
MULISH_FILES = {
    "Mulish":          MULISH_BASE + "Mulish-Regular.ttf",
    "Mulish-Bold":     MULISH_BASE + "Mulish-Bold.ttf",
    "Mulish-SemiBold": MULISH_BASE + "Mulish-SemiBold.ttf",
    "Mulish-Italic":   MULISH_BASE + "Mulish-Italic.ttf",
}

# Where the cached TTFs live. Override via env if your droplet has a
# read-only filesystem at the package path.
FONTS_DIR = Path(os.getenv(
    "PDF_FONTS_DIR",
    str(Path(__file__).parent / "fonts"),
))

# Helvetica fallback names — these are the PostScript fonts that ship with
# reportlab and never need registration.
HELVETICA_FALLBACK = {
    "regular": "Helvetica",
    "bold":    "Helvetica-Bold",
    "semibold": "Helvetica-Bold",  # Helvetica has no semibold; reuse Bold
    "italic":  "Helvetica-Oblique",
}

_lock = threading.Lock()
_resolved: dict[str, str] | None = None  # cached after first call


def _ensure_dir() -> None:
    FONTS_DIR.mkdir(parents=True, exist_ok=True)


def _download(name: str, url: str, timeout_s: int = 8) -> Path | None:
    """Fetch one TTF into FONTS_DIR. Returns the path on success, None
    otherwise. Existing valid files (>1 KB) are reused, no network call."""
    target = FONTS_DIR / f"{name}.ttf"
    if target.exists() and target.stat().st_size > 1000:
        return target
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HireParrot-PDF/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            data = r.read()
        if len(data) < 1000:
            logger.warning("Downloaded font %s seems tiny (%d bytes) — skipping", name, len(data))
            return None
        target.write_bytes(data)
        logger.info("Cached brand font %s (%d KB)", name, len(data) // 1024)
        return target
    except Exception as exc:  # noqa: BLE001 — network is allowed to fail
        logger.warning("Couldn't download brand font %s: %s", name, exc)
        return None


def _try_register() -> dict[str, str]:
    """Attempt to register Mulish with reportlab. Returns the resolved
    font-name dict — Mulish names if successful, Helvetica fallbacks if
    anything went wrong."""
    _ensure_dir()
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        return dict(HELVETICA_FALLBACK)

    resolved: dict[str, str] = {}
    role_to_name = {
        "regular":  "Mulish",
        "bold":     "Mulish-Bold",
        "semibold": "Mulish-SemiBold",
        "italic":   "Mulish-Italic",
    }
    for role, name in role_to_name.items():
        path = _download(name, MULISH_FILES[name])
        if not path:
            continue
        try:
            pdfmetrics.registerFont(TTFont(name, str(path)))
            resolved[role] = name
        except Exception as exc:  # noqa: BLE001
            logger.warning("reportlab refused to register %s: %s", name, exc)

    # If we got at least Regular + Bold, the document looks correct.
    # Anything missing falls back to Helvetica equivalents.
    if "regular" not in resolved or "bold" not in resolved:
        logger.warning("Mulish registration incomplete — falling back to Helvetica")
        return dict(HELVETICA_FALLBACK)

    # Fill in any missing roles with Mulish substitutes
    resolved.setdefault("semibold", resolved["bold"])
    resolved.setdefault("italic",   resolved["regular"])

    # Set up a friendly font family name so existing styles that expect
    # one bold/italic family also work.
    try:
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily(
            "Mulish",
            normal=resolved["regular"],
            bold=resolved["bold"],
            italic=resolved["italic"],
            boldItalic=resolved["bold"],
        )
    except Exception:
        pass

    return resolved


def brand_fonts() -> dict[str, str]:
    """Returns the resolved font-name dict, registering on first call.
    Thread-safe and idempotent — subsequent calls return the cache."""
    global _resolved
    if _resolved is not None:
        return _resolved
    with _lock:
        if _resolved is not None:
            return _resolved
        _resolved = _try_register()
        return _resolved


def prewarm() -> None:
    """Call at server startup to download + register fonts up front so the
    first user-triggered PDF doesn't pay the network cost."""
    brand_fonts()
