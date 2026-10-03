import { CheckCircle2, CircleAlert, Clock, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/types/api";

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued…",
  EXTRACTING: "Processing…",
  CHUNKING: "Processing…",
  EMBEDDING: "Indexing…",
};

export function documentStatusLabel(doc: Pick<DocumentItem, "status" | "processing_stage">): string {
  if (doc.status === "READY") return "Ready";
  if (doc.status === "FAILED") return "Failed";
  if (doc.status === "UPLOADED") return "Queued…";
  return STAGE_LABEL[doc.processing_stage] ?? "Processing…";
}

export function isProcessing(doc: Pick<DocumentItem, "status">) {
  return doc.status === "UPLOADED" || doc.status === "PROCESSING";
}

export function DocumentStatusBadge({
  doc,
  className,
}: {
  doc: Pick<DocumentItem, "status" | "processing_stage">;
  className?: string;
}) {
  const label = documentStatusLabel(doc);
  const tone =
    doc.status === "READY"
      ? "bg-success/12 text-success"
      : doc.status === "FAILED"
        ? "bg-destructive/10 text-destructive"
        : "bg-brand-soft text-brand";
  const Icon =
    doc.status === "READY"
      ? CheckCircle2
      : doc.status === "FAILED"
        ? CircleAlert
        : doc.status === "UPLOADED"
          ? Clock
          : Loader2;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}
      data-status={doc.status}
    >
      <Icon className={cn("size-3", doc.status === "PROCESSING" && "animate-spin")} />
      {label}
    </span>
  );
}
