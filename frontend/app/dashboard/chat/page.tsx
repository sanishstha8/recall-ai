"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Composer } from "@/components/chat/composer";
import { MobileHistoryButton } from "@/components/chat/mobile-history";
import { Button } from "@/components/ui/button";
import { useStartChat } from "@/hooks/use-start-chat";
import { knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useWorkspace } from "@/stores/workspace-store";

const SUGGESTIONS = [
  "Summarize the key ideas in my notes",
  "Explain normalization and give examples of 1NF, 2NF and 3NF.",
  "What are the most important definitions I should memorize?",
  "Compare the main approaches discussed and their trade-offs",
];

function NewChat() {
  const { current } = useWorkspace();
  const params = useSearchParams();
  const initialKb = Number(params.get("kb")) || null;
  const [kbId, setKbId] = useState<number | null>(initialKb);
  const startChat = useStartChat();
  const kbs = useQuery({ queryKey: qk.knowledgeBases(current?.id), queryFn: () => knowledgeApi.list({ workspace: current!.id }) });
  const noReadyDocs = kbs.data && !kbs.data.results.some((kb) => kb.ready_document_count > 0);

  const send = (text: string) => startChat.mutate({ knowledgeBaseId: kbId, initialQuestion: text });

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 items-center px-3 lg:hidden">
        <MobileHistoryButton />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 pb-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Sparkles className="size-5" />
          </div>
          <h1 className="font-display text-4xl tracking-tight">What do you want to recall?</h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" /> Answers come from your documents, with page-level citations — generated locally.
          </p>
        </div>
        {noReadyDocs && (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            You don&apos;t have any processed documents yet.{" "}
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href="/dashboard/knowledge">Upload one first</Link>
            </Button>
            .
          </div>
        )}
        <Composer onSend={send} streaming={startChat.isPending} knowledgeBaseId={kbId} onKnowledgeBaseChange={setKbId} autoFocus />
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={startChat.isPending}
              className="rounded-xl border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatHomePage() {
  return (
    <Suspense>
      <NewChat />
    </Suspense>
  );
}
