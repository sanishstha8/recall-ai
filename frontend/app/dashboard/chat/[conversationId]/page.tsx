"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, RotateCcw, X } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Composer } from "@/components/chat/composer";
import { AssistantMessage, UserMessage, citationsToSources, streamSourcesToSources } from "@/components/chat/message";
import { MobileHistoryButton } from "@/components/chat/mobile-history";
import { ErrorState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatStream } from "@/hooks/use-chat-stream";
import { conversationApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";

function Thread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = Number(conversationId);
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { state, send, regenerate, stop, dismissError } = useChatStream(id);
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const autoSent = useRef(false);

  const conversation = useQuery({ queryKey: qk.conversation(id), queryFn: () => conversationApi.get(id) });
  const messages = useQuery({ queryKey: qk.messages(id), queryFn: () => conversationApi.messages(id) });

  const changeKb = useMutation({
    mutationFn: (knowledgeBaseId: number | null) => conversationApi.update(id, { knowledge_base: knowledgeBaseId }),
    onSuccess: (conv) => {
      queryClient.setQueryData(qk.conversation(id), conv);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // A question typed on the "new chat" screen arrives as ?q= and is sent once.
  const initialQuestion = params.get("q");
  useEffect(() => {
    if (!initialQuestion || autoSent.current || messages.isPending) return;
    autoSent.current = true;
    router.replace(`/dashboard/chat/${id}`, { scroll: false });
    if (!messages.data?.length) send(initialQuestion);
  }, [initialQuestion, messages.isPending, messages.data, id, router, send]);

  // Keep the view pinned to the newest content unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [messages.data, state.draft, state.pendingQuestion, state.sources, pinned]);

  const streaming = state.status === "streaming";
  const list = messages.data ?? [];
  const lastAssistantId = [...list].reverse().find((m) => m.role === "ASSISTANT")?.id;

  if (conversation.error) {
    return (
      <ErrorState
        className="m-8"
        title="Conversation unavailable"
        error={conversation.error}
        onRetry={() => conversation.refetch()}
      />
    );
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-5">
        <MobileHistoryButton />
        {conversation.isPending ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <h1 className="truncate text-sm font-medium" data-testid="conversation-title">
            {conversation.data.title}
          </h1>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="relative flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
          {messages.isPending ? (
            <div className="space-y-6">
              <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : messages.error ? (
            <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
          ) : (
            list.map((m) =>
              m.role === "USER" ? (
                <UserMessage key={m.id} content={m.content} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  content={m.content}
                  sources={citationsToSources(m.citations)}
                  model={m.model}
                  tokens={m.total_tokens}
                  onRegenerate={m.id === lastAssistantId && !streaming ? regenerate : undefined}
                />
              ),
            )
          )}

          {state.pendingQuestion && <UserMessage content={state.pendingQuestion} />}
          {streaming && (
            <AssistantMessage
              content={state.draft}
              sources={streamSourcesToSources(state.sources, state.draft)}
              streaming
            />
          )}

          {state.status === "error" && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="font-medium">The answer couldn&apos;t be generated</p>
                <p className="text-muted-foreground">{state.error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={regenerate}>
                <RotateCcw /> Retry
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={dismissError}>
                <X />
              </Button>
            </div>
          )}
        </div>
        {!pinned && (
          <Button
            size="icon-sm"
            variant="outline"
            className="sticky bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow"
            aria-label="Scroll to latest"
            onClick={() => {
              setPinned(true);
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            }}
          >
            <ArrowDown />
          </Button>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={(text) => {
              setPinned(true);
              send(text);
            }}
            onStop={stop}
            streaming={streaming}
            knowledgeBaseId={conversation.data?.knowledge_base ?? null}
            onKnowledgeBaseChange={(kb) => changeKb.mutate(kb)}
            autoFocus
          />
          <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
            Answers are generated by a local model and may be imperfect — check the cited pages.
          </p>
        </div>
      </div>
    </>
  );
}

export default function ConversationPage() {
  return (
    <Suspense>
      <Thread />
    </Suspense>
  );
}
