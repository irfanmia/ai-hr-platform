"""
PDF Vision Parser
-----------------
Converts each PDF page to a screenshot image, then sends them to a vision AI
(Groq llama-4-scout-17b-16e-instruct) for structured resume extraction.

Why images instead of text extraction?
- Handles scanned PDFs, designed resumes, tables, columns correctly
- Much smaller token usage than raw PDF text dumps
- Vision model understands layout context (columns, sections, headers)
"""

import base64
import io
import logging
import os

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MAX_PAGES = 4       # Most resumes are 1-2 pages; cap at 4
DPI = 120           # 120 DPI = clear enough for AI, small enough file size
JPEG_QUALITY = 75   # Balance quality vs token size


def pdf_to_images_base64(pdf_path: str) -> list[str]:
    """
    Convert each page of a PDF to a base64-encoded JPEG image.
    Returns list of base64 strings (one per page).
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.error("PyMuPDF not installed. Run: pip install pymupdf")
        return []

    try:
        doc = fitz.open(pdf_path)
        images_b64 = []
        pages_to_process = min(len(doc), MAX_PAGES)

        for page_num in range(pages_to_process):
            page = doc[page_num]
            # Render page to image at specified DPI
            mat = fitz.Matrix(DPI / 72, DPI / 72)  # 72 is default PDF DPI
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)

            # Convert to JPEG bytes
            img_bytes = pix.tobytes("jpeg")

            # Encode to base64
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            images_b64.append(b64)
            logger.info(f"Page {page_num + 1}: {len(img_bytes) / 1024:.1f} KB → {len(b64) / 1024:.1f} KB base64")

        doc.close()
        return images_b64

    except Exception as e:
        logger.error(f"PDF to image conversion failed: {e}")
        return []


def is_document_a_resume(pdf_path: str) -> dict:
    """
    Use Groq vision to explicitly determine if an uploaded PDF is a resume/CV.
    Returns {"is_resume": bool, "reason": str}
    """
    images_b64 = pdf_to_images_base64(pdf_path)
    if not images_b64:
        return {"is_resume": False, "reason": "Could not read the document. Please upload a valid PDF, DOC, or DOCX file."}

    if not GROQ_API_KEY:
        # No API key — fall back to basic text check
        return {"is_resume": True, "reason": ""}

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        content = []
        for i, b64 in enumerate(images_b64[:2]):  # Check first 2 pages only
            content.append({"type": "text", "text": f"Page {i + 1}:"})
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})

        content.append({
            "type": "text",
            "text": (
                "Look at this document carefully. Is this a resume or CV (curriculum vitae)? "
                "A resume typically contains: person's name, contact info, work experience, education, skills. "
                "Answer with ONLY a JSON object: "
                '{"is_resume": true/false, "document_type": "what type of document this actually is", "reason": "one sentence explanation"}'
            )
        })

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": content
            }],
            max_tokens=150,
            temperature=0.0,
        )

        import json
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]

        result = json.loads(raw)
        is_resume = bool(result.get("is_resume", False))
        doc_type = result.get("document_type", "unknown document")
        reason = result.get("reason", "")

        if not is_resume:
            return {
                "is_resume": False,
                "reason": (
                    f"The document you uploaded appears to be a {doc_type}, not a resume. "
                    f"Please upload your CV or resume. "
                    f"ATS-friendly format recommended: clean layout, standard fonts, no graphics."
                )
            }
        return {"is_resume": True, "reason": ""}

    except Exception as e:
        logger.warning(f"Resume validation via vision failed: {e} — allowing through")
        return {"is_resume": True, "reason": ""}  # Fail open if AI unavailable


def extract_resume_via_vision(pdf_path: str) -> dict:
    """
    Main function: convert PDF to images, send to Groq vision model,
    return structured resume data.

    Returns dict with keys:
        - full_name, email, phone, location
        - skills (list)
        - experience_years (int)
        - education (list of str)
        - certifications (list of str)
        - claims (list of str) — things the candidate claims about themselves
        - summary (str) — short bio/objective
        - raw_text (str) — raw extracted content
    """
    empty_result = {
        "full_name": "",
        "email": "",
        "phone": "",
        "location": "",
        "skills": [],
        "experience_years": 1,
        "education": [],
        "certifications": [],
        "claims": [],
        "summary": "",
        "raw_text": "",
        "pages_processed": 0,
        "method": "vision",
    }

    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — falling back to text extraction")
        return empty_result

    if not pdf_path or not os.path.exists(pdf_path):
        logger.warning(f"PDF not found: {pdf_path}")
        return empty_result

    # Step 1: Convert PDF pages to images
    images_b64 = pdf_to_images_base64(pdf_path)
    if not images_b64:
        logger.warning("No images extracted from PDF")
        return empty_result

    logger.info(f"Processing {len(images_b64)} page(s) via Groq vision")

    # Step 2: Build vision prompt with all page images
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        # Build message content — system + all page images + instruction
        content = []

        # Add each page image
        for i, b64 in enumerate(images_b64):
            content.append({
                "type": "text",
                "text": f"Page {i + 1} of resume:"
            })
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}"
                }
            })

        # Final instruction
        content.append({
            "type": "text",
            "text": """Extract the following from this resume and respond ONLY with valid JSON (no markdown, no explanation):

{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "location": "string or empty",
  "summary": "2-3 sentence professional summary",
  "skills": ["list", "of", "technical", "and", "soft", "skills"],
  "experience_years": number,
  "education": ["Degree - Institution - Year"],
  "certifications": ["list of certifications if any"],
  "claims": ["I have X years of Y", "Experienced in Z", "Led team of N people"]
}

For claims: extract specific measurable assertions the candidate makes about themselves (years of experience, team size led, projects delivered, technologies used). These will be used to generate targeted interview questions to verify their claims."""
        })

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise resume parser. Extract structured data from resume images. Respond only with valid JSON."
                },
                {
                    "role": "user",
                    "content": content
                }
            ],
            max_tokens=1024,
            temperature=0.1,
        )

        raw_response = response.choices[0].message.content.strip()
        logger.info(f"Groq vision response ({len(raw_response)} chars): {raw_response[:200]}")

        # Step 3: Parse JSON response
        import json
        # Strip markdown code blocks if present
        if raw_response.startswith("```"):
            raw_response = raw_response.split("```")[1]
            if raw_response.startswith("json"):
                raw_response = raw_response[4:]

        parsed = json.loads(raw_response)

        return {
            "full_name": parsed.get("full_name", ""),
            "email": parsed.get("email", ""),
            "phone": parsed.get("phone", ""),
            "location": parsed.get("location", ""),
            "skills": parsed.get("skills", []),
            "experience_years": int(parsed.get("experience_years", 1)),
            "education": parsed.get("education", []),
            "certifications": parsed.get("certifications", []),
            "claims": parsed.get("claims", []),
            "summary": parsed.get("summary", ""),
            "raw_text": raw_response,
            "pages_processed": len(images_b64),
            "method": "vision",
        }

    except Exception as e:
        logger.error(f"Groq vision extraction failed: {e}")
        return {**empty_result, "error": str(e)}


def parse_resume_file(file_path: str) -> dict:
    """
    Entry point — detects file type and routes to appropriate parser.
    PDF → vision pipeline
    DOC/DOCX/TXT → basic text extraction (fallback)
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        result = extract_resume_via_vision(file_path)
        if result.get("skills") or result.get("full_name"):
            return result
        # Fall through to text extraction if vision fails

    # Fallback: basic text extraction
    return _basic_text_extraction(file_path)


def _basic_text_extraction(file_path: str) -> dict:
    """Simple fallback text extraction for non-PDF files or vision failures."""
    import re

    text = ""
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".pdf":
            import fitz
            doc = fitz.open(file_path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
        elif ext in (".doc", ".docx"):
            try:
                import docx
                doc = docx.Document(file_path)
                text = "\n".join(p.text for p in doc.paragraphs)
            except Exception:
                text = ""
        else:
            with open(file_path, "r", errors="ignore") as f:
                text = f.read()
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        text = ""

    KNOWN_SKILLS = [
        "Python", "Django", "React", "TypeScript", "PostgreSQL", "Docker",
        "AWS", "Kubernetes", "Figma", "SQL", "JavaScript", "Node.js",
        "Machine Learning", "Data Analysis", "Communication", "Leadership",
        "Project Management", "Git", "Linux", "FastAPI", "Vue", "Angular",
    ]

    text_lower = text.lower()
    skills = [s for s in KNOWN_SKILLS if s.lower() in text_lower]
    years_matches = [int(m) for m in re.findall(r"(\d+)\+?\s*year", text_lower)]
    experience_years = max(years_matches) if years_matches else 1

    return {
        "full_name": "",
        "email": "",
        "phone": "",
        "location": "",
        "skills": skills,
        "experience_years": experience_years,
        "education": [],
        "certifications": [],
        "claims": [f"{experience_years} years of relevant experience"] if experience_years > 0 else [],
        "summary": text[:300] if text else "",
        "raw_text": text[:2000],
        "pages_processed": 0,
        "method": "text_fallback",
    }
