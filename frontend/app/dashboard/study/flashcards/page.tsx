import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/states";
import { StudySetList } from "@/components/study/study-set-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Flashcards" };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={
          <Link href="/dashboard/study" className="hover:text-foreground">
            Study
          </Link>
        }
        title="Flashcards"
        description="Flip through question/answer cards to test your recall."
        actions={
          <Button asChild>
            <Link href="/dashboard/study?kind=FLASHCARDS">Generate new</Link>
          </Button>
        }
      />
      <StudySetList kinds={["FLASHCARDS"]} emptyHint="Generate flashcards from the Study page." />
    </div>
  );
}
