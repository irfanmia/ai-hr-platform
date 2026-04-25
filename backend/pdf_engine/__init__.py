"""PDF generation pipeline for the HR document pack.

Three flavours of download:
    - responses PDF   (just Q&A)
    - report PDF      (just AI evaluation)
    - combined PDF    (resume + responses + report, in that order)

Every page carries a branded header (candidate + job + doc type), a footer
(page X/Y, timestamp, verify URL), and a QR code anchored to a public
verification endpoint so HR can confirm the PDF wasn't fabricated.
"""

from .branding import (  # noqa: F401  (re-export public API)
    PdfMetadata,
    make_verify_token,
    parse_verify_token,
    verify_url_for_token,
)
from .responses_pdf import build_responses_pdf  # noqa: F401
from .report_pdf import build_report_pdf  # noqa: F401
from .combined_pdf import build_combined_pdf  # noqa: F401
