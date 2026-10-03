"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";
import type { WrittenQuestion } from "@/types/api";

function QuestionItem({ q, n }: { q: WrittenQuestion; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="text-sm font-medium text-muted-foreground tabular-nums">{n}.</span>
        <span className="flex-1 text-sm font-medium">{q.question}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {open ? "Hide" : "Model answer"}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="border-t bg-muted/30 px-4 py-3 pl-10">
          <Markdown content={q.model_answer} />
        </div>
      )}
    </li>
  );
}

export function WrittenQuestions({ short, long }: { short: WrittenQuestion[]; long: WrittenQuestion[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {[
        { title: "Short-answer questions", items: short, offset: 0 },
        { title: "Long-answer questions", items: long, offset: short.length },
      ].map(
        (section) =>
          section.items.length > 0 && (
            <section key={section.title} className="space-y-3">
              <h2 className="text-sm font-medium">{section.title}</h2>
              <ol className="space-y-2">
                {section.items.map((q, i) => (
                  <QuestionItem key={q.id} q={q} n={section.offset + i + 1} />
                ))}
              </ol>
            </section>
          ),
      )}
      <p className="text-xs text-muted-foreground">Try answering on paper first, then compare with the model answer.</p>
    </div>
  );
}
