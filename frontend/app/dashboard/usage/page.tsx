"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DailyBarChart } from "@/components/dashboard/bar-chart";
import { ErrorState, PageHeader } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usageApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { formatNumber, timeAgo } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";
import type { UsageOperation } from "@/types/api";

const OPERATION_LABEL: Record<UsageOperation, string> = {
  CHAT: "Chat",
  EMBEDDING: "Embeddings",
  SUMMARY: "Summaries",
  FLASHCARD: "Flashcards",
  QUIZ: "Quizzes",
  QUESTIONS: "Questions",
  MOCK_EXAM: "Mock exams",
};

export default function UsagePage() {
  const { current, can } = useWorkspace();
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"me" | "workspace">("me");
  const [page, setPage] = useState(1);
  const params = { workspace: current!.id, days, scope };

  const summary = useQuery({
    queryKey: qk.usage({ ...params, kind: "summary" }),
    queryFn: () => usageApi.summary(params),
  });
  const records = useQuery({
    queryKey: qk.usage({ ...params, page }),
    queryFn: () => usageApi.list({ ...params, page }),
  });
  const totals = summary.data?.totals;
  const maxOp = Math.max(1, ...(summary.data?.by_operation.map((o) => o.requests) ?? [1]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Usage"
        description="Every AI operation runs on your local models — tracked here for transparency. Cost is always $0."
        actions={
          <>
            {can("ADMIN") && (
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as "me" | "workspace");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="Scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My usage</SelectItem>
                  <SelectItem value="workspace">Whole workspace</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select
              value={String(days)}
              onValueChange={(v) => {
                setDays(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "AI requests",
                value: totals && formatNumber(totals.requests),
                hint: totals && `${totals.failures} failed`,
              },
              {
                label: "Tokens processed",
                value: totals && formatNumber(totals.total_tokens),
                hint: totals && `${formatNumber(totals.input_tokens)} in · ${formatNumber(totals.output_tokens)} out`,
              },
              {
                label: "Avg. latency",
                value: totals && `${(totals.avg_latency_ms / 1000).toFixed(1)}s`,
                hint: "per request",
              },
              {
                label: "Estimated cost",
                value: totals && `$${totals.estimated_cost.toFixed(2)}`,
                hint: "local inference",
              },
            ].map((s) => (
              <Card key={s.label} className="gap-1 py-5">
                <CardContent className="px-5">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {s.value === undefined ? (
                    <Skeleton className="mt-2 h-8 w-20" />
                  ) : (
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{s.value}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint ?? " "}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Daily activity</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.data ? (
                  <DailyBarChart data={summary.data.by_day} days={days} />
                ) : (
                  <Skeleton className="h-44" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By feature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!summary.data ? (
                  <Skeleton className="h-40" />
                ) : summary.data.by_operation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AI activity in this period.</p>
                ) : (
                  summary.data.by_operation.map((o) => (
                    <div key={o.operation} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{OPERATION_LABEL[o.operation]}</span>
                        <span className="text-muted-foreground tabular-nums">{o.requests}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{ width: `${(o.requests / maxOp) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-sm">Recent requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {records.isPending ? (
            <Skeleton className="m-5 h-40" />
          ) : records.error ? (
            <ErrorState className="m-5" error={records.error} onRetry={() => records.refetch()} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Operation</TableHead>
                  <TableHead>Model</TableHead>
                  {scope === "workspace" && <TableHead>User</TableHead>}
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="pr-5 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No requests yet.
                    </TableCell>
                  </TableRow>
                )}
                {records.data.results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5">
                      <span className={cn("inline-flex items-center gap-1.5", !r.success && "text-destructive")}>
                        <span className={cn("size-1.5 rounded-full", r.success ? "bg-success" : "bg-destructive")} />
                        {OPERATION_LABEL[r.operation]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.model}</TableCell>
                    {scope === "workspace" && <TableCell className="text-xs">{r.user_email ?? "—"}</TableCell>}
                    <TableCell className="text-right tabular-nums">{formatNumber(r.total_tokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(r.latency_ms / 1000).toFixed(1)}s</TableCell>
                    <TableCell className="pr-5 text-right text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {records.data && (records.data.next || records.data.previous) && (
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!records.data.previous}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!records.data.next} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
