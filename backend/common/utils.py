from __future__ import annotations

import re
import unicodedata
import uuid
from pathlib import PurePath

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._ -]+")
_WHITESPACE = re.compile(r"\s+")


def sanitize_filename(filename: str, max_length: int = 150) -> str:
    """Return a display-safe filename. Never used to build storage paths directly."""
    name = PurePath(filename.replace("\\", "/")).name
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = _UNSAFE_CHARS.sub("_", name)
    name = _WHITESPACE.sub(" ", name).strip(" ._")
    if not name:
        name = "document"
    if len(name) > max_length:
        stem, dot, ext = name.rpartition(".")
        if dot and len(ext) <= 10:
            name = stem[: max_length - len(ext) - 1] + "." + ext
        else:
            name = name[:max_length]
    return name


def file_extension(filename: str) -> str:
    return PurePath(filename).suffix.lower().lstrip(".")


def upload_to_random_name(prefix: str, filename: str) -> str:
    """Build a storage path from a random id; the user-supplied name is never trusted."""
    ext = file_extension(filename)
    ext = ext if re.fullmatch(r"[a-z0-9]{1,8}", ext) else "bin"
    return f"{prefix}/{uuid.uuid4().hex}.{ext}"


def estimate_tokens(text: str) -> int:
    """Approximate the LLM token count without a model-specific tokenizer.

    Counts word pieces and punctuation, which tracks BPE tokenizers closely enough
    for chunk sizing. Real token usage for generation comes from Ollama itself.
    """
    if not text:
        return 0
    words = re.findall(r"\w+|[^\w\s]", text)
    # Long words are split into several BPE tokens.
    return sum(1 + len(w) // 8 for w in words)
