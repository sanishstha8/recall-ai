"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/dashboard/states";
import { ExamRunner } from "@/components/study/exam-runner";
import { FlashcardDeck } from "@/components/study/flashcard-deck";
import { KIND_META } from "@/components/study/meta";
import { WrittenQuestions } from "@/components/study/written-questions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { studyApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { formatDuration, timeAgo } from "@/lib/utils/format";
import type { Flashcard, QuizQuestion, StudySet, SummaryContent, WrittenQuestion } from "@/types/api";

function Generating({ set }: { set: StudySet }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, (Date.now() - new Date(set.created_at).getTime()) / 1000));
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center"
      data-testid="study-generating"
    >
      <Loader2 className="size-7 animate-spin text-brand" />
      <p className="font-medium">
        {set.status === "PENDING" ? "Queued…" : `Generating your ${KIND_META[set.kind].label.toLowerCase()}…`}
      </p>
      <p className="text-sm text-muted-foreground">
        Your local model is reading the material. This usually takes 1–3 minutes on a CPU.
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{formatDuration(seconds)} elapsed</p>
    </div>
  );
}

function SummaryView({ content }: { content: SummaryContent }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-brand/25 bg-brand-soft/40 p-6">
        <p className="mb-1 text-xs font-medium tracking-wide text-brand uppercase">In short</p>
        <p className="text-[0.95rem] leading-7">{content.short_summary}</p>
      </div>
      {content.key_points.length > 0 && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 text-sm font-medium">Key points</h2>
          <ul className="space-y-2">
            {content.key_points.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-6 md:p-8">
        <h2 className="mb-3 text-sm font-medium">Detailed summary</h2>
        <Markdown content={content.detailed_summary} />
      </section>
    </div>
  );
}

export default function StudySetPage() {
  const { setId } = useParams<{ setId: string }>();
  const id = Number(setId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const set = useQuery({
    queryKey: qk.studySet(id),
    queryFn: () => studyApi.get(id),
    refetchInterval: (q) => (q.state.data && ["PENDING", "GENERATING"].includes(q.state.data.status) ? 3000 : false),
  });
  const regenerate = useMutation({
    mutationFn: () => studyApi.regenerate(id),
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ["study-sets"] });
      router.push(`/dashboard/study/${next.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => studyApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-sets"] });
      toast.success("Study set deleted");
      router.replace("/dashboard/study");
    },
  });

  if (set.isPending) return <Skeleton className="m-8 h-96 rounded-2xl" />;
  if (set.error)
    return <ErrorState className="m-8" title="Study set unavailable" error={set.error} onRetry={() => set.refetch()} />;
  const s = set.data;
  const meta = KIND_META[s.kind];
  const content = s.content ?? {};

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <Link
        href="/dashboard/study"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Study
      </Link>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <meta.icon className="size-3.5 text-brand" /> {meta.label} · {s.difficulty.toLowerCase()} ·{" "}
            {timeAgo(s.created_at)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          {s.sources.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <FileText className="size-3.5" /> Based on
              {[...new Set(s.sources.map((src) => src.document_name))].join(", ")} · {s.sources.length}{" "}
              {s.sources.length === 1 ? "page" : "pages"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(s.status === "READY" || s.status === "FAILED") && (
            <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              {regenerate.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Regenerate
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Delete study set" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {s.status === "PENDING" || s.status === "GENERATING" ? (
        <Generating set={s} />
      ) : s.status === "FAILED" ? (
        <ErrorState
          title="Generation failed"
          error={new Error(s.error || "The local model could not produce valid output.")}
          onRetry={() => regenerate.mutate()}
        />
      ) : s.kind === "SUMMARY" ? (
        <SummaryView content={content as SummaryContent} />
      ) : s.kind === "FLASHCARDS" ? (
        <FlashcardDeck cards={(content as { cards: Flashcard[] }).cards} />
      ) : s.kind === "QUESTIONS" ? (
        <WrittenQuestions
          short={(content as { short_answer: WrittenQuestion[] }).short_answer}
          long={(content as { long_answer: WrittenQuestion[] }).long_answer}
        />
      ) : (
        <ExamRunner
          studySetId={s.id}
          questions={(content as { questions: QuizQuestion[] }).questions}
          timeLimitMinutes={s.kind === "MOCK_EXAM" ? s.time_limit_minutes : null}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this study set?"
        description="Its content and any attempt history will be removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  );
}
