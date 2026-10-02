"use client";

import { CheckCircle2, CircleAlert, FileUp, Loader2, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useUploadDocument } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils/format";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";
const ALLOWED = /\.(pdf|docx|txt|md|markdown)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

type UploadItem = { key: string; file: File; state: "uploading" | "done" | "error"; error?: string };

export function UploadDropzone({ knowledgeBaseId, disabled }: { knowledgeBaseId: number; disabled?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const upload = useUploadDocument(knowledgeBaseId);

  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
        // Fast client-side checks; the server re-validates type and content.
        if (!ALLOWED.test(file.name)) {
          setItems((p) => [{ key, file, state: "error", error: "Unsupported file type" }, ...p]);
          continue;
        }
        if (file.size > MAX_BYTES) {
          setItems((p) => [{ key, file, state: "error", error: "Larger than 25 MB" }, ...p]);
          continue;
        }
        setItems((p) => [{ key, file, state: "uploading" }, ...p]);
        upload.mutate(file, {
          onSuccess: () => update(key, { state: "done" }),
          onError: (error) => update(key, { state: "error", error: error.message }),
        });
      }
    },
    [upload],
  );

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center transition-colors hover:bg-muted/40",
          dragging && "border-brand bg-brand-soft/60",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="mb-3 rounded-full bg-background p-2.5 shadow-sm ring-1 ring-border">
          <FileUp className="size-5 text-brand" />
        </div>
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT or Markdown · up to 25 MB each</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          data-testid="upload-input"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <ul className="space-y-1.5" aria-label="Uploads">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              {item.state === "uploading" ? (
                <Loader2 className="size-4 animate-spin text-brand" />
              ) : item.state === "done" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <CircleAlert className="size-4 text-destructive" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.state === "uploading" ? "Uploading…" : item.state === "done" ? "Uploaded — processing" : item.error}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{formatBytes(item.file.size)}</span>
              {item.state !== "uploading" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss"
                  onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
