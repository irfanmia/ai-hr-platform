"""
Brand font registration for reportlab — keeps PDF typography in sync with
the web app (Mulish across the board).

Mulish is shipped by Google Fonts as a *variable* font (`Mulish[wght].ttf`),
not as separate static weights, and reportlab can't render arbitrary
weights from a variable font directly. So on first use we:

  1. Download the variable Mulish + Mulish-Italic from the canonical
     Google Fonts GitHub repo into a cache dir.
  2. Use fontTools.varLib.instancer to "freeze" the variable font at
     specific weights — Regular (400), SemiBold (600), Bold (700) —
     and save each as its own static TTF.
  3. Register those static TTFs with reportlab.

Subsequent calls reuse the cached static TTFs and are instant.

If anything fails (no internet, fontTools missing, GitHub down, etc.)
we transparently fall back to Helvetica so PDF generation never breaks
because of a font problem.

Usage:

    from .fonts import brand_fonts
    F = brand_fonts()                 # {"regular": "Mulish-Regular", ...}
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

# Variable Mulish files in the canonical Google Fonts repo.
# Bracket characters are URL-encoded with %5B / %5D.
VARIABLE_SOURCES = {
    "Mulish":        "https://raw.githubusercontent.com/google/fonts/main/ofl/mulish/Mulish%5Bwght%5D.ttf",
    "Mulish-Italic": "https://raw.githubusercontent.com/google/fonts/main/ofl/mulish/Mulish-Italic%5Bwght%5D.ttf",
}

# Static instances we want to derive from the variable font, mapped to the
# weight axis value they should freeze at.
STATIC_INSTANCES = [
    # (output_name,        source,        weight)
    ("Mulish-Regular",     "Mulish",        400),
    ("Mulish-SemiBold",    "Mulish",        600),
    ("Mulish-Bold",        "Mulish",        700),
    ("Mulish-Italic",      "Mulish-Italic", 400),
]

FONTS_DIR = Path(os.getenv(
    "PDF_FONTS_DIR",
    str(Path(__file__).parent / "fonts"),
))

HELVETICA_FALLBACK = {
    "regular":  "Helvetica",
    "bold":     "Helvetica-Bold",
    "semibold": "Helvetica-Bold",
    "italic":   "Helvetica-Oblique",
}

_lock = threading.Lock()
_resolved: dict[str, str] | None = None


def _ensure_dir() -> None:
    FONTS_DIR.mkdir(parents=True, exist_ok=True)


def _download_variable(name: str, url: str, timeout_s: int = 12) -> Path | None:
    """Download a variable-font TTF into FONTS_DIR/<name>.var.ttf. Cached."""
    target = FONTS_DIR / f"{name}.var.ttf"
    if target.exists() and target.stat().st_size > 10_000:
        return target
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HireParrot-PDF/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            data = r.read()
        if len(data) < 10_000:
            logger.warning("Variable font %s download too small (%d bytes)", name, len(data))
            return None
        target.write_bytes(data)
        logger.info("Cached variable font %s (%d KB)", name, len(data) // 1024)
        return target
    except Exception as exc:  # noqa: BLE001
        logger.warning("Couldn't download variable font %s: %s", name, exc)
        return None


def _instance_static(out_name: str, source_var_path: Path, weight: int) -> Path | None:
    """Slice a static TTF out of a variable font at the given weight axis
    value. Uses fontTools.varLib.instancer (the same code used by Google
    Fonts' own pipeline)."""
    target = FONTS_DIR / f"{out_name}.ttf"
    if target.exists() and target.stat().st_size > 5_000:
        return target
    try:
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer
    except ImportError:
        logger.warning("fontTools not installed — can't slice variable fonts")
        return None
    try:
        var_font = TTFont(str(source_var_path))
        static = instancer.instantiateVariableFont(var_font, {"wght": weight})
        static.save(str(target))
        logger.info("Built static instance %s @ wght=%d", out_name, weight)
        return target
    except Exception as exc:  # noqa: BLE001
        logger.warning("Couldn't instance %s from %s: %s", out_name, source_var_path, exc)
        return None


def _try_register() -> dict[str, str]:
    """Download + instance + register Mulish. Returns the resolved
    font-name dict — Mulish-* names if successful, Helvetica fallbacks
    if anything failed."""
    _ensure_dir()
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        return dict(HELVETICA_FALLBACK)

    # 1) Pull the two variable source files
    var_paths: dict[str, Path] = {}
    for name, url in VARIABLE_SOURCES.items():
        p = _download_variable(name, url)
        if p:
            var_paths[name] = p

    if "Mulish" not in var_paths:
        logger.warning("Mulish variable font missing — falling back to Helvetica")
        return dict(HELVETICA_FALLBACK)

    # 2) Build the static instances
    role_map = {
        "regular":  ("Mulish-Regular",  400),
        "semibold": ("Mulish-SemiBold", 600),
        "bold":     ("Mulish-Bold",     700),
        "italic":   ("Mulish-Italic",   400),  # comes from Mulish-Italic var
    }
    resolved: dict[str, str] = {}
    for role, (out_name, weight) in role_map.items():
        source_key = "Mulish-Italic" if role == "italic" else "Mulish"
        source_path = var_paths.get(source_key)
        if not source_path:
            continue
        static_path = _instance_static(out_name, source_path, weight)
        if not static_path:
            continue
        try:
            pdfmetrics.registerFont(TTFont(out_name, str(static_path)))
            resolved[role] = out_name
        except Exception as exc:  # noqa: BLE001
            logger.warning("reportlab refused %s: %s", out_name, exc)

    if "regular" not in resolved or "bold" not in resolved:
        logger.warning("Mulish registration incomplete — falling back to Helvetica")
        return dict(HELVETICA_FALLBACK)

    resolved.setdefault("semibold", resolved["bold"])
    resolved.setdefault("italic",   resolved["regular"])

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

    logger.info("Registered Mulish font family for PDFs: %s", resolved)
    return resolved


def brand_fonts() -> dict[str, str]:
    """Returns the resolved font-name dict, registering on first call.
    Thread-safe and idempotent."""
    global _resolved
    if _resolved is not None:
        return _resolved
    with _lock:
        if _resolved is not None:
            return _resolved
        _resolved = _try_register()
        return _resolved


def prewarm() -> None:
    """Call at server startup so the first PDF doesn't pay the network +
    instancer cost (typically 3-8 seconds total on a fresh droplet)."""
    brand_fonts()
