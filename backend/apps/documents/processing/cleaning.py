from __future__ import annotations

import re
import unicodedata

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_INLINE_SPACE = re.compile(r"[^\S\n]+")  # any whitespace except newlines
_MANY_NEWLINES = re.compile(r"\n{3,}")

# Roughly one printed page; used to give text-like formats citeable "pages".
VIRTUAL_PAGE_CHARS = 3000


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", text)
    text = _HYPHEN_BREAK.sub(r"\1\2", text)  # re-join words hyphenated across lines
    text = "\n".join(_INLINE_SPACE.sub(" ", line).strip() for line in text.split("\n"))
    text = _MANY_NEWLINES.sub("\n\n", text)
    return text.strip()


def paginate_text(text: str, page_chars: int = VIRTUAL_PAGE_CHARS) -> list[str]:
    """Split text into page-sized sections at paragraph boundaries."""
    paragraphs = [p for p in re.split(r"\n\s*\n", text.replace("\r\n", "\n")) if p.strip()]
    pages: list[str] = []
    current: list[str] = []
    size = 0
    for paragraph in paragraphs:
        if current and size + len(paragraph) > page_chars:
            pages.append("\n\n".join(current))
            current, size = [], 0
        current.append(paragraph)
        size += len(paragraph) + 2
    if current:
        pages.append("\n\n".join(current))
    return pages
