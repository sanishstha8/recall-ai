"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { studyApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format";
import type { QuizAttempt, QuizQuestion } from "@/types/api";

const LETTERS = ["A", "B", "C", "D"] as const;

function Results({
  attempt,
  questions,
  onRetake,
}: {
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  onRetake: () => void;
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const tone =
    attempt.percentage >= 80 ? "text-success" : attempt.percentage >= 50 ? "text-warning" : "text-destructive";
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="quiz-results">
      <div className="rounded-2xl border bg-card p-8 text-center">
        <Trophy className={cn("mx-auto mb-3 size-8", tone)} />
        <p className="text-sm text-muted-foreground">Your score</p>
        <p className={cn("text-5xl font-semibold tracking-tight tabular-nums", tone)} data-testid="quiz-score">
          {attempt.score}/{attempt.total}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {Math.round(attempt.percentage)}% · completed in {formatDuration(attempt.duration_seconds)}
        </p>
        <Button className="mt-5" variant="outline" onClick={onRetake}>
          <RotateCcw /> Retake
        </Button>
      </div>
      <ol className="space-y-3">
        {attempt.results.map((r, i) => {
          const q = byId.get(r.question_id);
          if (!q) return null;
          return (
            <li key={r.question_id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                {r.is_correct ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <div className="grid gap-1.5 text-sm">
                    {LETTERS.map((l) => (
                      <div
                        key={l}
                        className={cn(
                          "rounded-lg border px-3 py-1.5",
                          l === r.correct_answer && "border-success/50 bg-success/10",
                          l === r.selected && !r.is_correct && "border-destructive/50 bg-destructive/10",
                        )}
                      >
                        <span className="mr-2 font-medium">{l}.</span>
                        {q.options[l]}
                      </div>
                    ))}
                  </div>
                  {!r.selected && <p className="text-xs text-muted-foreground">Not answered</p>}
                  {r.explanation && (
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{r.explanation}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Exam-style runner for quizzes (untimed) and mock exams (count-down, auto-submit). */
export function ExamRunner({
  studySetId,
  questions,
  timeLimitMinutes,
}: {
  studySetId: number;
  questions: QuizQuestion[];
  timeLimitMinutes: number | null;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const startedAt = useRef(0);
  const limitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null;
  const remaining = limitSeconds !== null ? Math.max(0, limitSeconds - elapsed) : null;

  const submit = useMutation({
    mutationFn: () => studyApi.submitAttempt(studySetId, answers, Math.round((Date.now() - startedAt.current) / 1000)),
    onSuccess: (result) => {
      setAttempt(result);
      queryClient.invalidateQueries({ queryKey: qk.attempts(studySetId) });
      queryClient.invalidateQueries({ queryKey: ["study-sets"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
  const submitNow = useCallback(() => {
    if (!submit.isPending && !attempt) submit.mutate();
  }, [submit, attempt]);

  useEffect(() => {
    if (attempt) return;
    startedAt.current = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (remaining === 0 && !attempt) submitNow();
  }, [remaining, attempt, submitNow]);

  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);
  const question = questions[index];

  if (attempt)
    return (
      <Results
        attempt={attempt}
        questions={questions}
        onRetake={() => {
          setAttempt(null);
          setAnswers({});
          setFlagged(new Set());
          setIndex(0);
          setElapsed(0);
        }}
      />
    );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_15rem]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium tabular-nums" data-testid="question-counter">
            Question {index + 1} of {questions.length}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 tabular-nums",
              remaining !== null && remaining < 60 && "border-destructive/40 text-destructive",
            )}
            aria-live="off"
            data-testid="exam-timer"
          >
            <Clock className="size-3.5" />
            {remaining !== null ? `${formatDuration(remaining)} left` : formatDuration(elapsed)}
          </span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} className="h-1.5" />

        <div className="rounded-2xl border bg-card p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-3">
            <h2 className="text-lg leading-snug font-medium">{question.question}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={flagged.has(question.id) ? "Unflag question" : "Flag for review"}
              aria-pressed={flagged.has(question.id)}
              onClick={() =>
                setFlagged((f) => {
                  const next = new Set(f);
                  if (next.has(question.id)) next.delete(question.id);
                  else next.add(question.id);
                  return next;
                })
              }
            >
              <Flag className={cn(flagged.has(question.id) && "fill-warning text-warning")} />
            </Button>
          </div>
          <div role="radiogroup" aria-label="Answer options" className="grid gap-2.5">
            {LETTERS.map((letter) => {
              const selected = answers[question.id] === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`option-${letter}`}
                  onClick={() => setAnswers((a) => ({ ...a, [question.id]: letter }))}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50",
                    selected && "border-brand bg-brand-soft/60 hover:bg-brand-soft/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                      selected && "border-brand bg-brand text-brand-foreground",
                    )}
                  >
                    {letter}
                  </span>
                  <span className="pt-0.5">{question.options[letter]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
            <ChevronLeft /> Previous
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex((i) => i + 1)}>
              Next <ChevronRight />
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} disabled={submit.isPending} data-testid="submit-exam">
              {submit.isPending && <Loader2 className="animate-spin" />} Submit
            </Button>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Questions</p>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to question ${i + 1}`}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-md border text-xs tabular-nums transition-colors hover:bg-muted",
                  answers[q.id] && "border-brand/40 bg-brand-soft text-brand",
                  i === index && "ring-2 ring-ring",
                )}
              >
                {i + 1}
                {flagged.has(q.id) && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-warning" />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {answeredCount} of {questions.length} answered
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setConfirmOpen(true)} disabled={submit.isPending}>
          Submit exam
        </Button>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your answers?"
        description={
          answeredCount < questions.length
            ? `You have ${questions.length - answeredCount} unanswered question(s). Unanswered questions score zero.`
            : "You can review every answer after submitting."
        }
        confirmLabel="Submit"
        onConfirm={() => submit.mutateAsync()}
      />
    </div>
  );
}
