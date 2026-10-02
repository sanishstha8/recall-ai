from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import IO


class DocumentParsingError(Exception):
    """User-facing parsing failure (stored as the document's processing_error)."""


@dataclass
class ParsedPage:
    page_number: int  # 1-based
    text: str


@dataclass
class ParsedDocument:
    pages: list[ParsedPage]
    # True when pages are physical (PDF); False when they were derived by paginating text.
    native_pages: bool = True


def pages_from_texts(texts: list[str]) -> list[ParsedPage]:
    return [ParsedPage(page_number=i, text=t) for i, t in enumerate(texts, start=1)]


class BaseDocumentParser(ABC):
    file_types: tuple[str, ...] = ()

    @abstractmethod
    def parse(self, file: IO[bytes]) -> ParsedDocument: ...
