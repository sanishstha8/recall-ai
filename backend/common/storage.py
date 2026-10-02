"""Storage abstraction for uploaded documents.

Backed by the ``documents`` alias in ``settings.STORAGES`` — local filesystem in
development. Switching to S3 / Supabase Storage only requires configuring a different
Django storage backend (e.g. ``storages.backends.s3.S3Storage``); callers only ever use
this class and storage paths, never filesystem paths.
"""

from __future__ import annotations

import uuid
from typing import IO

from django.core.files.base import File
from django.core.files.storage import Storage, storages


class DocumentStorage:
    def __init__(self, backend: Storage | None = None):
        self.backend = backend or storages["documents"]

    @staticmethod
    def build_path(*, workspace_id: int, knowledge_base_id: int, extension: str) -> str:
        # Never derived from the uploaded filename.
        return f"workspace_{workspace_id}/kb_{knowledge_base_id}/{uuid.uuid4().hex}.{extension}"

    def save(self, file: IO[bytes], *, workspace_id: int, knowledge_base_id: int, extension: str) -> str:
        path = self.build_path(
            workspace_id=workspace_id, knowledge_base_id=knowledge_base_id, extension=extension
        )
        return self.backend.save(path, File(file))

    def open(self, path: str) -> File:
        return self.backend.open(path, "rb")

    def exists(self, path: str) -> bool:
        return self.backend.exists(path)

    def delete(self, path: str) -> None:
        if path and self.backend.exists(path):
            self.backend.delete(path)


def get_document_storage() -> DocumentStorage:
    return DocumentStorage()
