from __future__ import annotations

from typing import IO

from apps.documents.parsers.base import BaseDocumentParser, ParsedDocument, pages_from_texts
from apps.documents.processing.cleaning import paginate_text


def decode_text(raw: bytes) -> str:
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


class TXTParser(BaseDocumentParser):
    file_types = ("txt",)

    def parse(self, file: IO[bytes]) -> ParsedDocument:
        return ParsedDocument(
            pages=pages_from_texts(paginate_text(decode_text(file.read()))), native_pages=False
        )


class MarkdownParser(TXTParser):
    """Markdown is kept as-is: headings and lists are meaningful context for the LLM."""

    file_types = ("md",)
