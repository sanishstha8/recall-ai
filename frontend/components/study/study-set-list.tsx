"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";

import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { KIND_META } from "@/components/study/meta";
import { Skeleton } from "@/components/ui/skeleton";
import { studyApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";
import type { StudyKind, StudySet } from "@/types/api";

function StatusPill({ set }: { set: StudySet }) {
  if (set.status === "READY") {
    return set.best_score !== null ? (
      <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success tabular-nums">
        Best {Math.round(set.best_score)}%
      </span>
    ) : null;
  }
  if (set.status === "FAILED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
        <CircleAlert className="size-3" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">
      <Loader2 className="size-3 animate-spin" /> Generating
    </span>
  );
}

export function StudySetList({ kinds, emptyHint }: { kinds?: StudyKind[]; emptyHint?: string }) {
  const { current } = useWorkspace();
  const kindParam = kinds?.length === 1 ? kinds[0] : undefined;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.studySets(current?.id, kindParam),
    queryFn: () => studyApi.list({ workspace: current!.id, kind: kindParam }),
    refetchInterval: (q) =>
      q.state.data?.results.some((s) => s.status === "PENDING" || s.status === "GENERATING") ? 4000 : false,
  });
  const sets = (data?.results ?? []).filter((s) => !kinds || kinds.includes(s.kind));

  if (isPending)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!sets.length)
    return (
      <EmptyState
        icon={GraduationCap}
        title="Nothing here yet"
        description={emptyHint ?? "Generate study material from any knowledge base."}
      />
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sets.map((set) => {
        const meta = KIND_META[set.kind];
        const Icon = meta.icon;
        return (
          <Link
            key={set.id}
            href={`/dashboard/study/${set.id}`}
            data-testid="study-set-card"
            className={cn("flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20")}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-3.5 text-brand" /> {meta.label}
              <span className="ml-auto">
                <StatusPill set={set} />
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-medium">{set.title}</p>
            <p className="mt-auto pt-3 text-xs text-muted-foreground">
              {set.knowledge_base_name} · {set.difficulty.toLowerCase()} · {timeAgo(set.created_at)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
