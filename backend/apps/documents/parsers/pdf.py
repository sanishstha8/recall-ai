from __future__ import annotations

import logging
from typing import IO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from apps.documents.parsers.base import BaseDocumentParser, DocumentParsingError, ParsedDocument, ParsedPage

logger = logging.getLogger(__name__)


class PDFParser(BaseDocumentParser):
    file_types = ("pdf",)

    def parse(self, file: IO[bytes]) -> ParsedDocument:
        try:
            reader = PdfReader(file)
            if reader.is_encrypted and not reader.decrypt(""):
                raise DocumentParsingError("This PDF is password-protected. Upload an unlocked copy.")
            pages: list[ParsedPage] = []
            for index, page in enumerate(reader.pages, start=1):
                try:
                    text = page.extract_text() or ""
                except Exception as exc:
                    logger.warning("pdf page extraction failed", extra={"page": index, "error": str(exc)})
                    text = ""
                pages.append(ParsedPage(page_number=index, text=text))
        except DocumentParsingError:
            raise
        except (PdfReadError, ValueError, KeyError, OSError) as exc:
            raise DocumentParsingError(f"Could not read the PDF: {exc}") from exc
        if not pages:
            raise DocumentParsingError("The PDF has no pages.")
        return ParsedDocument(pages=pages, native_pages=True)
