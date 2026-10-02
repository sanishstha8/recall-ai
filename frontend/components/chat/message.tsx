"use client";

import { Check, Copy, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { CitationChip, SourceList, type SourceRef } from "@/components/chat/citations";
import { Markdown, linkCitations } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Citation, StreamSource } from "@/types/api";

export function citationsToSources(citations: Citation[]): SourceRef[] {
  return citations.map((c) => ({
    index: c.source_index,
    documentId: c.document,
    documentName: c.document_name,
    pageNumber: c.page_number,
    excerpt: c.quoted_content,
    score: c.relevance_score,
    cited: c.cited,
  }));
}

export function streamSourcesToSources(sources: StreamSource[], draft: string): SourceRef[] {
  return sources.map((s) => ({
    index: s.index,
    documentId: s.document_id,
    documentName: s.document_name,
    pageNumber: s.page_number,
    excerpt: s.excerpt,
    score: s.score,
    cited: new RegExp(`\\[(?:\\d+\\s*,\\s*)*${s.index}(?:\\s*,\\s*\\d+)*\\]`).test(draft),
  }));
}

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end" data-testid="user-message">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.94rem] whitespace-pre-wrap text-primary-foreground">
        {content}
      </div>
    </div>
  );
}

export function AssistantMessage({
  content,
  sources,
  streaming,
  model,
  tokens,
  onRegenerate,
}: {
  content: string;
  sources: SourceRef[];
  streaming?: boolean;
  model?: string;
  tokens?: number;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const byIndex = useMemo(() => new Map(sources.map((s) => [s.index, s])), [sources]);
  const linked = useMemo(() => linkCitations(content, new Set(byIndex.keys())), [content, byIndex]);

  return (
    <div className="group flex gap-3" data-testid="assistant-message">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {content ? (
          <Markdown
            content={linked}
            renderCitation={(i) => {
              const source = byIndex.get(i);
              return source ? <CitationChip source={source} /> : `[${i}]`;
            }}
          />
        ) : (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground" aria-live="polite">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand" />
            </span>
            {sources.length ? `Reading ${sources.length} passages…` : "Searching your knowledge…"}
          </div>
        )}
        {streaming && content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle" />}

        {!streaming && <SourceList sources={sources} />}

        {!streaming && content && (
          <div className={cn("mt-2 flex items-center gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Copy answer"
                  onClick={() =>
                    navigator.clipboard.writeText(content).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    })
                  }
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
            {onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label="Regenerate answer" onClick={onRegenerate}>
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}
            {model && (
              <span className="ml-1 text-[0.7rem]">
                {model}
                {tokens ? ` · ${tokens.toLocaleString()} tokens` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
