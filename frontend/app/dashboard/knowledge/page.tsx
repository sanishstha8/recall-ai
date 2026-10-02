"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Library, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { EmptyState, ErrorState, PageHeader } from "@/components/dashboard/states";
import { KbIcon } from "@/components/knowledge/kb-icon";
import { KnowledgeBaseFormDialog } from "@/components/knowledge/kb-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { timeAgo } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";

function KnowledgeList() {
  const { current, can } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const workspace = current!.id;
  const canCreate = can("MEMBER");

  useEffect(() => {
    if (params.get("new") === "1" && canCreate) {
      setOpen(true);
      router.replace("/dashboard/knowledge");
    }
  }, [params, router, canCreate]);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.knowledgeBases(workspace),
    queryFn: () => knowledgeApi.list({ workspace }),
  });
  const items = (data?.results ?? []).filter((kb) => kb.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Knowledge"
        description="Each knowledge base is a private, searchable collection of your documents."
        actions={
          canCreate && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New knowledge base
            </Button>
          )
        }
      />
      {!!data?.results.length && (
        <div className="relative max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter knowledge bases" className="h-9 pl-8" aria-label="Filter knowledge bases" />
        </div>
      )}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data.results.length ? (
        <EmptyState
          icon={Library}
          title="Create your first knowledge base"
          description="Knowledge bases group related documents — for example a semester, a course, or a research project."
          action={
            canCreate && (
              <Button onClick={() => setOpen(true)}>
                <Plus /> New knowledge base
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((kb) => (
            <Link
              key={kb.id}
              href={`/dashboard/knowledge/${kb.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <KbIcon name={kb.icon} />
                <span className="text-xs text-muted-foreground">{timeAgo(kb.last_activity_at)}</span>
              </div>
              <h3 className="mt-4 font-medium tracking-tight">{kb.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{kb.description || "No description"}</p>
              <div className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                <FileText className="size-3.5" />
                {kb.document_count} {kb.document_count === 1 ? "document" : "documents"}
                {kb.document_count > kb.ready_document_count && (
                  <span className="ml-auto text-brand">{kb.document_count - kb.ready_document_count} processing</span>
                )}
              </div>
            </Link>
          ))}
          {!items.length && <p className="text-sm text-muted-foreground">No knowledge bases match “{filter}”.</p>}
        </div>
      )}
      <KnowledgeBaseFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgeList />
    </Suspense>
  );
}
