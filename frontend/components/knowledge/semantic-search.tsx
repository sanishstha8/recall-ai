"use client";

import { useMutation } from "@tanstack/react-query";
import { FileText, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { knowledgeApi } from "@/lib/api/endpoints";

export function SemanticSearch({ knowledgeBaseId, hasDocuments }: { knowledgeBaseId: number; hasDocuments: boolean }) {
  const [query, setQuery] = useState("");
  const search = useMutation({
    meta: { silent: true },
    mutationFn: (q: string) => knowledgeApi.search(knowledgeBaseId, q, 10),
  });

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) search.mutate(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by meaning, e.g. “how do transactions stay isolated?”"
            className="h-10 pl-9"
            aria-label="Semantic search"
          />
        </div>
        <Button type="submit" className="h-10" disabled={!query.trim() || search.isPending}>
          {search.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Search
        </Button>
      </form>

      {!hasDocuments ? (
        <EmptyState icon={Search} title="Nothing to search yet" description="Upload and process a document first." />
      ) : search.error ? (
        <ErrorState title="Search failed" error={search.error} onRetry={() => search.mutate(query.trim())} />
      ) : search.data ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {search.data.results.length} passages · {search.data.embedding_model} · {search.data.latency_ms} ms
          </p>
          {search.data.results.length === 0 && <p className="text-sm text-muted-foreground">No matching passages.</p>}
          {search.data.results.map((r) => (
            <Link
              key={r.chunk_id}
              href={`/dashboard/documents/${r.document_id}?page=${r.page_number}&hl=${encodeURIComponent(r.content.slice(0, 1500))}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="size-3.5" />
                <span className="font-medium text-foreground">{r.document_name}</span>· Page {r.page_number}
                <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand tabular-nums">
                  {Math.round(r.score * 100)}% match
                </span>
              </div>
              <p className="line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{r.content}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Semantic search finds passages by meaning, not just keywords — powered by your local embedding model.
        </p>
      )}
    </div>
  );
}
