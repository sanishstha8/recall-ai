"""Upload validation: size, extension and content sniffing.

The declared extension must agree with the file's actual bytes; the browser-provided
content type and filename are never trusted.
"""

from __future__ import annotations

import zipfile
from typing import IO

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.documents.models import FileType
from common.utils import file_extension

EXTENSION_TO_TYPE = {
    "pdf": FileType.PDF,
    "txt": FileType.TXT,
    "text": FileType.TXT,
    "md": FileType.MARKDOWN,
    "markdown": FileType.MARKDOWN,
    "docx": FileType.DOCX,
}
CONTENT_TYPES = {
    FileType.PDF: "application/pdf",
    FileType.TXT: "text/plain; charset=utf-8",
    FileType.MARKDOWN: "text/markdown; charset=utf-8",
    FileType.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOCX_UNCOMPRESSED = 200 * 1024 * 1024  # zip-bomb guard


def _head(file: IO[bytes], size: int = 8192) -> bytes:
    file.seek(0)
    data = file.read(size)
    file.seek(0)
    return data


def _looks_like_pdf(file: IO[bytes]) -> bool:
    return b"%PDF-" in _head(file, 1024)


def _looks_like_docx(file: IO[bytes]) -> bool:
    file.seek(0)
    try:
        with zipfile.ZipFile(file) as archive:
            names = set(archive.namelist())
            total = sum(info.file_size for info in archive.infolist())
    except (zipfile.BadZipFile, OSError):
        return False
    finally:
        file.seek(0)
    return "word/document.xml" in names and total <= MAX_DOCX_UNCOMPRESSED


def _looks_like_text(file: IO[bytes]) -> bool:
    sample = _head(file)
    if b"\x00" in sample:
        return False
    try:
        # A multi-byte character may be cut at the sample boundary.
        sample.decode("utf-8")
    except UnicodeDecodeError as exc:
        if exc.start < len(sample) - 4:
            try:
                sample.decode("cp1252")
            except UnicodeDecodeError:
                return False
    return True


SNIFFERS = {
    FileType.PDF: _looks_like_pdf,
    FileType.DOCX: _looks_like_docx,
    FileType.TXT: _looks_like_text,
    FileType.MARKDOWN: _looks_like_text,
}


def validate_upload(file, filename: str) -> FileType:
    size = getattr(file, "size", None) or 0
    if size == 0:
        raise ValidationError({"file": "The file is empty."})
    if size > settings.MAX_UPLOAD_SIZE:
        limit_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
        raise ValidationError({"file": f"Files must be {limit_mb:.0f} MB or smaller."})

    file_type = EXTENSION_TO_TYPE.get(file_extension(filename))
    if file_type is None:
        raise ValidationError({"file": "Unsupported file type. Upload a PDF, DOCX, TXT or Markdown file."})
    if not SNIFFERS[file_type](file):
        raise ValidationError({"file": f"The file content does not match a valid .{file_type} file."})
    return file_type
