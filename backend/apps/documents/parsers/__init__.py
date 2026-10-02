from apps.documents.parsers.base import (
    BaseDocumentParser,
    DocumentParsingError,
    ParsedDocument,
    ParsedPage,
)
from apps.documents.parsers.docx import DOCXParser
from apps.documents.parsers.pdf import PDFParser
from apps.documents.parsers.text import MarkdownParser, TXTParser

_PARSERS: dict[str, type[BaseDocumentParser]] = {
    file_type: parser
    for parser in (PDFParser, TXTParser, MarkdownParser, DOCXParser)
    for file_type in parser.file_types
}


def get_parser(file_type: str) -> BaseDocumentParser:
    try:
        return _PARSERS[file_type]()
    except KeyError:
        raise DocumentParsingError(f"No parser available for '{file_type}' files.") from None


__all__ = [
    "BaseDocumentParser",
    "DOCXParser",
    "DocumentParsingError",
    "MarkdownParser",
    "PDFParser",
    "ParsedDocument",
    "ParsedPage",
    "TXTParser",
    "get_parser",
]
