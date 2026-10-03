"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Minus,
  Plus,
  Quote,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { DocumentStatusBadge, isProcessing } from "@/components/documents/status-badge";
import { ErrorState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocument } from "@/hooks/use-documents";
import { documentApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { paragraphsMatchingQuote, splitByQuery, splitParagraphs } from "@/lib/utils/highlight";

const ZOOM_STEPS = [0.85, 0.95, 1, 1.1, 1.25, 1.4];

function PageText({ content, quote, search, zoom }: { content: string; quote: string; search: string; zoom: number }) {
  const paragraphs = useMemo(() => splitParagraphs(content), [content]);
  const quoted = useMemo(() => paragraphsMatchingQuote(paragraphs, quote), [paragraphs, quote]);
  const firstQuoted = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    firstQuoted.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [content, quote]);

  const firstIndex = quoted.size ? Math.min(...quoted) : -1;
  return (
    <article className="mx-auto max-w-[68ch] space-y-4 leading-7 text-foreground/90" style={{ fontSize: `${zoom}rem` }}>
      {paragraphs.map((p, i) => {
        const isQuoted = quoted.has(i);
        return (
          <p
            key={i}
            ref={i === firstIndex ? firstQuoted : undefined}
            className="whitespace-pre-line"
            data-quoted={isQuoted || undefined}
          >
            {isQuoted ? (
              <mark className="citation-highlight">{p}</mark>
            ) : (
              splitByQuery(p, search).map((part, j) =>
                part.match ? (
                  <mark key={j} className="search-highlight">
                    {part.text}
                  </mark>
                ) : (
                  <span key={j}>{part.text}</span>
                ),
              )
            )}
          </p>
        );
      })}
    </article>
  );
}

function OriginalFile({
  documentId,
  page,
  fileType,
  name,
}: {
  documentId: number;
  page: number;
  fileType: string;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    documentApi
      .file(documentId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(setError);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  if (error) return <ErrorState title="Couldn't load the original file" error={error} />;
  if (!url) return <Skeleton className="h-[70vh] rounded-xl" />;
  if (fileType !== "pdf")
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <FileText className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preview is available for PDFs. Download the original instead.</p>
        <Button asChild variant="outline">
          <a href={url} download={name}>
            <Download /> Download
          </a>
        </Button>
      </div>
    );
  return (
    <iframe
      key={page}
      title={name}
      src={`${url}#page=${page}`}
      className="h-[75vh] w-full rounded-xl border bg-muted"
    />
  );
}

function Viewer() {
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);
  const params = useSearchParams();
  const router = useRouter();
  const doc = useDocument(documentId);

  const pageCount = doc.data?.page_count ?? 0;
  const requested = Number(params.get("page") ?? 1) || 1;
  const page = Math.min(Math.max(1, requested), Math.max(1, pageCount));
  const quote = params.get("hl") ?? "";
  const [zoomIndex, setZoomIndex] = useState(2);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [jump, setJump] = useState("");

  const pageQuery = useQuery({
    queryKey: qk.documentPage(documentId, page),
    queryFn: () => documentApi.page(documentId, page),
    enabled: doc.data?.status === "READY",
  });
  const searchQuery = useQuery({
    queryKey: ["document", documentId, "search", activeSearch],
    queryFn: () => documentApi.searchText(documentId, activeSearch),
    enabled: activeSearch.length >= 2,
  });

  const goTo = (p: number, keepQuote = false) => {
    const next = new URLSearchParams();
    next.set("page", String(Math.min(Math.max(1, p), pageCount)));
    if (keepQuote && quote) next.set("hl", quote);
    router.replace(`/dashboard/documents/${documentId}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight" && page < pageCount) goTo(page + 1);
      if (e.key === "ArrowLeft" && page > 1) goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (doc.isPending) return <Skeleton className="m-8 h-[60vh] rounded-xl" />;
  if (doc.error)
    return <ErrorState className="m-8" title="Document unavailable" error={doc.error} onRetry={() => doc.refetch()} />;
  const d = doc.data;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <Link
        href={`/dashboard/knowledge/${d.knowledge_base}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {d.knowledge_base_name}
      </Link>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{d.name}</h1>
          <p className="text-sm text-muted-foreground">
            {d.file_type.toUpperCase()} · {formatBytes(d.file_size)} · {d.page_count} pages ·{" "}
            {d.word_count.toLocaleString()} words · uploaded {formatDate(d.created_at)}
          </p>
        </div>
        <DocumentStatusBadge doc={d} />
      </div>

      {d.status !== "READY" ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border p-12 text-center">
          {isProcessing(d) ? (
            <Loader2 className="size-6 animate-spin text-brand" />
          ) : (
            <X className="size-6 text-destructive" />
          )}
          <p className="font-medium">
            {isProcessing(d) ? "This document is still being processed" : "Processing failed"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {d.processing_error || "Pages will appear here when indexing finishes."}
          </p>
        </div>
      ) : (
        <Tabs defaultValue="text">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1" aria-label="Page navigation">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (Number(jump)) goTo(Number(jump));
                  setJump("");
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Input
                  value={jump}
                  onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
                  placeholder={String(page)}
                  className="h-7 w-12 text-center"
                  aria-label="Go to page"
                />
                <span>/ {pageCount}</span>
              </form>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => goTo(page + 1)}
              >
                <ChevronRight />
              </Button>
              <div className="ml-2 flex items-center gap-1 border-l pl-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom out"
                  disabled={zoomIndex === 0}
                  onClick={() => setZoomIndex((z) => z - 1)}
                >
                  <Minus />
                </Button>
                <span className="w-10 text-center text-xs text-muted-foreground tabular-nums">
                  {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom in"
                  disabled={zoomIndex === ZOOM_STEPS.length - 1}
                  onClick={() => setZoomIndex((z) => z + 1)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value="text" className="mt-4">
            <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
              <div className="min-h-[60vh] rounded-xl border bg-card px-6 py-8 md:px-10">
                {quote && (
                  <div className="mx-auto mb-6 flex max-w-[68ch] items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
                    <Quote className="size-3.5" /> Highlighting the cited passage
                    <button className="ml-auto underline-offset-2 hover:underline" onClick={() => goTo(page)}>
                      Clear
                    </button>
                  </div>
                )}
                <div className="mb-6 text-center text-xs tracking-widest text-muted-foreground uppercase">
                  Page {page}
                </div>
                {pageQuery.isPending ? (
                  <div className="mx-auto max-w-[68ch] space-y-3">
                    {Array.from({ length: 8 }, (_, i) => (
                      <Skeleton key={i} className="h-4" />
                    ))}
                  </div>
                ) : pageQuery.error ? (
                  <ErrorState error={pageQuery.error} onRetry={() => pageQuery.refetch()} />
                ) : (
                  <PageText
                    content={pageQuery.data.content}
                    quote={quote}
                    search={activeSearch}
                    zoom={ZOOM_STEPS[zoomIndex]}
                  />
                )}
              </div>

              <aside className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setActiveSearch(searchInput.trim());
                  }}
                  className="relative"
                >
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search in document"
                    className="h-9 pl-8"
                    aria-label="Search in document"
                  />
                </form>
                {searchQuery.isFetching && <Skeleton className="h-16" />}
                {searchQuery.data && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {searchQuery.data.reduce((n, r) => n + r.matches, 0)} matches on {searchQuery.data.length} pages
                    </p>
                    {searchQuery.data.map((r) => (
                      <button
                        key={r.page_number}
                        onClick={() => goTo(r.page_number)}
                        className={cn(
                          "w-full rounded-lg border bg-card p-3 text-left text-xs transition-colors hover:border-foreground/20",
                          r.page_number === page && "border-brand",
                        )}
                      >
                        <div className="mb-1 font-medium">
                          Page {r.page_number} · {r.matches} {r.matches === 1 ? "match" : "matches"}
                        </div>
                        <p className="line-clamp-3 text-muted-foreground">…{r.snippet}…</p>
                      </button>
                    ))}
                  </div>
                )}
                {!activeSearch && <p className="text-xs text-muted-foreground">Use ← → to move between pages.</p>}
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="original" className="mt-4">
            <OriginalFile documentId={documentId} page={page} fileType={d.file_type} name={d.original_filename} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function DocumentViewerPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}
