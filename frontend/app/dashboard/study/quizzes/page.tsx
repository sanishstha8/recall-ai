import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/states";
import { StudySetList } from "@/components/study/study-set-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Quizzes & exams" };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={
          <Link href="/dashboard/study" className="hover:text-foreground">
            Study
          </Link>
        }
        title="Quizzes & exams"
        description="Practice quizzes and timed mock exams, scored on submission."
        actions={
          <Button asChild>
            <Link href="/dashboard/study?kind=QUIZ">Generate new</Link>
          </Button>
        }
      />
      <StudySetList kinds={["QUIZ", "MOCK_EXAM"]} emptyHint="Generate a quiz or mock exam from the Study page." />
    </div>
  );
}
