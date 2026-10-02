"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  FileText,
  GraduationCap,
  Library,
  MessageSquarePlus,
  MessagesSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { AIStatusCard } from "@/components/dashboard/ai-status";
import { EmptyState, PageHeader } from "@/components/dashboard/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationApi, documentApi, knowledgeApi, usageApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { formatBytes, formatNumber, timeAgo } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";

function StatCard({ label, value, icon: Icon, href, hint }: { label: string; value?: number; icon: typeof FileText; href: string; hint?: string }) {
  return (
    <Link href={href} className="group">
      <Card className="gap-3 py-5 transition-colors group-hover:border-foreground/20">
        <CardContent className="flex items-start justify-between px-5">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === undefined ? <Skeleton className="h-8 w-14" /> : <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatNumber(value)}</p>}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-brand-soft group-hover:text-brand">
            <Icon className="size-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: typeof Upload; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="rounded-lg bg-brand-soft p-2 text-brand">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium">
          {title}
          <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function ListCard({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function Welcome() {
  const welcome = useSearchParams().get("welcome");
  if (!welcome) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/60 p-4 text-sm">
      <Sparkles className="mt-0.5 size-4 text-brand" />
      <div>
        <p className="font-medium">Your private workspace is ready.</p>
        <p className="text-muted-foreground">
          Create a knowledge base, upload a PDF, and ask it anything — everything runs on your own machine.
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const workspace = current!.id;

  const kbs = useQuery({ queryKey: qk.knowledgeBases(workspace), queryFn: () => knowledgeApi.list({ workspace }) });
  const docs = useQuery({
    queryKey: qk.recentDocuments(workspace),
    queryFn: () => documentApi.list({ workspace, page_size: 6 }),
  });
  const chats = useQuery({ queryKey: qk.conversations(workspace), queryFn: () => conversationApi.list({ workspace }) });
  const usage = useQuery({
    queryKey: qk.usage({ workspace, days: 7, summary: true }),
    queryFn: () => usageApi.summary({ workspace, days: 7 }),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <PageHeader eyebrow={current!.name} title={`${greeting}, ${user?.first_name || user?.full_name}`} description="Here's what's happening in your knowledge workspace." />
      <Suspense>
        <Welcome />
      </Suspense>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Overview">
        <StatCard label="Documents" value={docs.data?.count} icon={FileText} href="/dashboard/knowledge" />
        <StatCard label="Knowledge bases" value={kbs.data?.count} icon={Library} href="/dashboard/knowledge" />
        <StatCard label="Conversations" value={chats.data?.count} icon={MessagesSquare} href="/dashboard/chat" />
        <StatCard
          label="AI activity"
          value={usage.data?.totals.requests}
          icon={Activity}
          href="/dashboard/usage"
          hint={usage.data ? `${formatNumber(usage.data.totals.total_tokens)} tokens · last 7 days` : undefined}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quick actions">
        <QuickAction href="/dashboard/knowledge" icon={Upload} title="Upload document" description="PDF, DOCX, TXT or Markdown" />
        <QuickAction href="/dashboard/knowledge?new=1" icon={Library} title="New knowledge base" description="Group related documents" />
        <QuickAction href="/dashboard/chat" icon={MessageSquarePlus} title="Start chat" description="Ask with cited answers" />
        <QuickAction href="/dashboard/study" icon={GraduationCap} title="Study" description="Quizzes, flashcards, exams" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_20rem]">
        <ListCard title="Recent documents" href="/dashboard/knowledge">
          {docs.isPending ? (
            <RowSkeletons />
          ) : !docs.data?.results.length ? (
            <EmptyState className="m-5 border-0 py-8" icon={FileText} title="No documents yet" description="Upload a PDF to a knowledge base to get started." />
          ) : (
            <ul className="divide-y">
              {docs.data.results.map((doc) => (
                <li key={doc.id}>
                  <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.knowledge_base_name} · {formatBytes(doc.file_size)} · {timeAgo(doc.created_at)}
                      </p>
                    </div>
                    <DocumentStatusBadge doc={doc} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ListCard>

        <ListCard title="Recent conversations" href="/dashboard/chat">
          {chats.isPending ? (
            <RowSkeletons />
          ) : !chats.data?.results.length ? (
            <EmptyState className="m-5 border-0 py-8" icon={MessagesSquare} title="No conversations yet" description="Ask your documents a question." />
          ) : (
            <ul className="divide-y">
              {chats.data.results.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/chat/${c.id}`} className="block px-5 py-3 hover:bg-muted/40">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className={cn("truncate text-xs text-muted-foreground")}>
                      {c.knowledge_base_name ?? "All knowledge"} · {c.message_count} messages · {timeAgo(c.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ListCard>

        <AIStatusCard />
      </div>
    </div>
  );
}
