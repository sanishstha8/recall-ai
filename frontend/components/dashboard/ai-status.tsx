"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu, Database, RefreshCw, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { systemApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import type { HealthCheck } from "@/types/api";

function Row({ icon: Icon, label, check }: { icon: typeof Cpu; label: string; check?: HealthCheck }) {
  const detail =
    check && typeof check.detail === "object" && check.detail !== null
      ? (check.detail as { chat_model?: string; embedding_model?: string })
      : null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>{label}</span>
          <span className={cn("flex items-center gap-1.5 text-xs", check?.ok ? "text-success" : "text-destructive")}>
            <span className={cn("size-1.5 rounded-full", check?.ok ? "bg-success" : "bg-destructive")} />
            {check?.ok ? "Online" : "Unavailable"}
          </span>
        </div>
        <p
          className="truncate text-xs text-muted-foreground"
          title={typeof check?.detail === "string" ? check.detail : undefined}
        >
          {detail
            ? `${detail.chat_model} · ${detail.embedding_model}`
            : typeof check?.detail === "string"
              ? check.detail
              : ""}
        </p>
      </div>
    </div>
  );
}

export function AIStatusCard() {
  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: qk.readiness,
    queryFn: systemApi.readiness,
    refetchInterval: 60_000,
  });
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
        <CardTitle className="text-sm">Local AI status</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={() => refetch()} aria-label="Refresh status">
          <RefreshCw className={cn(isFetching && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {isPending ? (
          <>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </>
        ) : data ? (
          <>
            <Row icon={Cpu} label="Ollama models" check={data.checks.ai} />
            <Row icon={Database} label="PostgreSQL + pgvector" check={data.checks.database} />
            <Row icon={Server} label="Task queue" check={data.checks.broker} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Status unavailable.</p>
        )}
      </CardContent>
    </Card>
  );
}
