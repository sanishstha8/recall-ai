"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShieldAlert } from "lucide-react";

import { EmptyState, ErrorState, PageHeader } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL } from "@/lib/api/client";
import { systemApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { formatNumber, timeAgo } from "@/lib/utils/format";
import type { AdminAnalytics } from "@/types/api";

const TOTAL_LABELS: [keyof AdminAnalytics["totals"], string][] = [
  ["users", "Users"],
  ["active_users_7d", "Active (7d)"],
  ["workspaces", "Workspaces"],
  ["documents", "Documents"],
  ["conversations", "Conversations"],
  ["ai_requests", "AI requests"],
  ["ai_failures", "AI failures"],
  ["processing_failures", "Processing failures"],
];

function useAnalytics(enabled: boolean) {
  return useQuery({ queryKey: qk.admin, queryFn: systemApi.adminAnalytics, enabled, refetchInterval: 30_000 });
}

export default function AdminPage() {
  const { user } = useAuth();
  const analytics = useAnalytics(!!user?.is_staff);

  if (!user?.is_staff)
    return (
      <div className="p-8">
        <EmptyState
          icon={ShieldAlert}
          title="Staff only"
          description="The admin dashboard is available to staff accounts. Create one with `python manage.py createsuperuser`."
        />
      </div>
    );

  const d = analytics.data;
  const maxFeature = Math.max(1, ...(d?.feature_usage.map((f) => f.requests) ?? [1]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Admin"
        description="Platform-wide analytics across every workspace on this server."
        actions={
          <Button variant="outline" asChild>
            <a href={`${API_URL}/admin/`} target="_blank" rel="noreferrer">
              Django admin <ExternalLink />
            </a>
          </Button>
        }
      />
      {analytics.error ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TOTAL_LABELS.map(([key, label]) => (
              <Card key={key} className="gap-1 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {d ? (
                    <p
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        key.endsWith("failures") && d.totals[key] > 0 && "text-destructive",
                      )}
                    >
                      {formatNumber(d.totals[key])}
                    </p>
                  ) : (
                    <Skeleton className="mt-1 h-7 w-12" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Most used features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!d ? (
                  <Skeleton className="h-32" />
                ) : d.feature_usage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AI usage yet.</p>
                ) : (
                  d.feature_usage.map((f) => (
                    <div key={f.operation} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{f.operation.toLowerCase().replace("_", " ")}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {f.requests} · {formatNumber(f.total_tokens)} tokens
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{ width: `${(f.requests / maxFeature) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!d ? (
                  <Skeleton className="h-32" />
                ) : (
                  Object.entries(d.health).map(([name, check]) => (
                    <div key={name} className="flex items-start justify-between gap-4 text-sm">
                      <span className="capitalize">{name}</span>
                      <span
                        className={cn(
                          "max-w-[70%] truncate text-right text-xs",
                          check.ok ? "text-success" : "text-destructive",
                        )}
                        title={JSON.stringify(check.detail)}
                      >
                        {check.ok ? `OK · ${check.latency_ms} ms` : String(check.detail)}
                      </span>
                    </div>
                  ))
                )}
                {d && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Documents:{" "}
                    {Object.entries(d.documents_by_status)
                      .map(([s, n]) => `${s.toLowerCase()} ${n}`)
                      .join(" · ") || "none"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-sm">Recent processing failures</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {d?.recent_failures.length ? (
                  <ul className="divide-y">
                    {d.recent_failures.map((f) => (
                      <li key={f.id} className="px-5 py-3 text-sm">
                        <p className="font-medium">
                          {f.name}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {f.workspace} · {timeAgo(f.updated_at)}
                          </span>
                        </p>
                        <p className="line-clamp-2 text-xs text-destructive">{f.error}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    {d ? "No processing failures." : "Loading…"}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-sm">Newest users</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {d?.recent_users.map((u) => (
                    <li key={u.id} className="flex justify-between px-5 py-2.5 text-sm">
                      <span className="truncate">{u.email}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">joined {timeAgo(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
