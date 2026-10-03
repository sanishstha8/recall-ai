"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/states";
import { StudyGenerator } from "@/components/study/generator";
import { StudySetList } from "@/components/study/study-set-list";
import type { StudyKind } from "@/types/api";

const SECTIONS = [
  { href: "/dashboard/study/summaries", label: "Summaries" },
  { href: "/dashboard/study/flashcards", label: "Flashcards" },
  { href: "/dashboard/study/quizzes", label: "Quizzes & exams" },
];

function StudyHub() {
  const params = useSearchParams();
  const kb = Number(params.get("kb")) || null;
  const kind = (params.get("kind") as StudyKind | null) ?? undefined;
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <PageHeader
        title="Study"
        description="Turn your documents into summaries, flashcards, quizzes and timed mock exams."
        actions={SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </Link>
        ))}
      />
      <StudyGenerator initialKb={kb} initialKind={kind} />
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Recent study sets</h2>
        <StudySetList />
      </section>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense>
      <StudyHub />
    </Suspense>
  );
}
