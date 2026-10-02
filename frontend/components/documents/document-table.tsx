"use client";

import { FileText, MoreHorizontal, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeleteDocument, useReprocessDocument } from "@/hooks/use-documents";
import { formatBytes, formatDate } from "@/lib/utils/format";
import type { DocumentItem } from "@/types/api";

const TYPE_LABEL: Record<string, string> = { pdf: "PDF", docx: "DOCX", txt: "TXT", md: "Markdown" };

export function DocumentTable({ documents, canEdit }: { documents: DocumentItem[]; canEdit: boolean }) {
  const reprocess = useReprocessDocument();
  const remove = useDeleteDocument();
  const [pendingDelete, setPendingDelete] = useState<DocumentItem | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem_4.5rem_8rem_7rem_2.5rem] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
          <span>Pages</span>
          <span>Status</span>
          <span>Uploaded</span>
          <span />
        </div>
        <ul className="divide-y">
          {documents.map((doc) => (
            <li
              key={doc.id}
              data-testid="document-row"
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_5rem_5rem_4.5rem_8rem_7rem_2.5rem]"
            >
              <Link href={`/dashboard/documents/${doc.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{doc.name}</span>
              </Link>
              <span className="hidden text-sm text-muted-foreground md:block">{TYPE_LABEL[doc.file_type]}</span>
              <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{formatBytes(doc.file_size)}</span>
              <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{doc.page_count || "—"}</span>
              <span className="row-start-2 flex items-center gap-1.5 md:row-start-auto">
                {doc.status === "FAILED" && doc.processing_error ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <DocumentStatusBadge doc={doc} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{doc.processing_error}</TooltipContent>
                  </Tooltip>
                ) : (
                  <DocumentStatusBadge doc={doc} />
                )}
                {doc.status === "FAILED" && canEdit && (
                  <Button variant="ghost" size="xs" onClick={() => reprocess.mutate(doc)} disabled={reprocess.isPending}>
                    <RotateCw /> Retry
                  </Button>
                )}
              </span>
              <span className="row-start-2 text-xs text-muted-foreground md:row-start-auto md:text-sm">{formatDate(doc.created_at)}</span>
              <div className="col-start-2 row-span-2 row-start-1 flex justify-end md:col-start-auto md:row-span-1 md:row-start-auto">
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${doc.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => reprocess.mutate(doc)}>
                        <RotateCw /> Reprocess
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(doc)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.name}”?`}
        description="The file, its extracted pages and its search index are removed. Chat citations to it will disappear."
        confirmLabel="Delete document"
        destructive
        onConfirm={() => (pendingDelete ? remove.mutateAsync(pendingDelete) : undefined)}
      />
    </>
  );
}
