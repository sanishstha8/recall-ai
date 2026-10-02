"use client";

import { ChevronDown, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { HoverCardish } from "@/components/chat/hover-preview";
import { cn } from "@/lib/utils";

/** Normalized source used both while streaming and for stored citations. */
export type SourceRef = {
  index: number;
  documentId: number;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  score: number;
  cited: boolean;
};

export function sourceHref(s: Pick<SourceRef, "documentId" | "pageNumber" | "excerpt">) {
  return `/dashboard/documents/${s.documentId}?page=${s.pageNumber}&hl=${encodeURIComponent(s.excerpt.slice(0, 1500))}`;
}

export function CitationChip({ source }: { source: SourceRef }) {
  return (
    <HoverCardish
      trigger={
        <Link
          href={sourceHref(source)}
          data-testid="citation-chip"
          className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded-md bg-brand-soft px-1 align-middle text-[0.7rem] font-semibold text-brand no-underline transition-colors hover:bg-brand hover:text-brand-foreground"
          aria-label={`Source ${source.index}: ${source.documentName}, page ${source.pageNumber}`}
        >
          {source.index}
        </Link>
      }
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <FileText className="size-3.5 text-brand" />
        <span className="truncate">{source.documentName}</span>
        <span className="shrink-0 text-muted-foreground">· p. {source.pageNumber}</span>
      </div>
      <p className="line-clamp-5 text-xs whitespace-pre-line text-muted-foreground">{source.excerpt}</p>
    </HoverCardish>
  );
}

function SourceCard({ source }: { source: SourceRef }) {
  return (
    <Link
      href={sourceHref(source)}
      data-testid="source-card"
      className="group/source flex min-w-0 items-start gap-2.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-brand/50"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-soft text-[0.7rem] font-semibold text-brand">
        {source.index}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium group-hover/source:underline">{source.documentName}</span>
        <span className="block text-[0.7rem] text-muted-foreground">
          Page {source.pageNumber} · {Math.round(source.score * 100)}% relevant
        </span>
      </span>
    </Link>
  );
}

export function SourceList({ sources }: { sources: SourceRef[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!sources.length) return null;
  const cited = sources.filter((s) => s.cited);
  const consulted = sources.filter((s) => !s.cited);
  const primary = cited.length ? cited : consulted;
  const secondary = cited.length ? consulted : [];
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{cited.length ? "Sources" : "Retrieved context"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {primary.map((s) => (
          <SourceCard key={s.index} source={s} />
        ))}
      </div>
      {secondary.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")} />
            {secondary.length} more retrieved {secondary.length === 1 ? "passage" : "passages"} not cited
          </button>
          {showAll && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {secondary.map((s) => (
                <SourceCard key={s.index} source={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
