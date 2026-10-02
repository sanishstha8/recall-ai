"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, streamSSE } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import type { Message, StreamSource } from "@/types/api";

export type ChatStreamState = {
  status: "idle" | "streaming" | "error";
  /** The question being answered, shown before the server confirms it. */
  pendingQuestion: string | null;
  draft: string;
  sources: StreamSource[];
  error: string | null;
};

const IDLE: ChatStreamState = { status: "idle", pendingQuestion: null, draft: "", sources: [], error: null };

export function useChatStream(conversationId: number) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChatStreamState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const buffer = useRef("");
  const frame = useRef<number | null>(null);

  // Batch token updates to one render per animation frame.
  const flush = useCallback(() => {
    frame.current = null;
    const chunk = buffer.current;
    buffer.current = "";
    if (chunk) setState((s) => ({ ...s, draft: s.draft + chunk }));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (body: { content?: string; regenerate?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const key = qk.messages(conversationId);

      if (body.regenerate) {
        queryClient.setQueryData<Message[]>(key, (old = []) => {
          const lastUser = old.findLastIndex((m) => m.role === "USER");
          return lastUser >= 0 ? old.slice(0, lastUser + 1) : old;
        });
      }
      buffer.current = "";
      setState({ ...IDLE, status: "streaming", pendingQuestion: body.content ?? null });

      try {
        for await (const { event, data } of streamSSE(`/conversations/${conversationId}/stream/`, body, controller.signal)) {
          if (event === "start") {
            const { user_message } = data as { user_message: Message };
            if (!body.regenerate) queryClient.setQueryData<Message[]>(key, (old = []) => [...old, user_message]);
            setState((s) => ({ ...s, pendingQuestion: null }));
          } else if (event === "sources") {
            setState((s) => ({ ...s, sources: data as StreamSource[] }));
          } else if (event === "token") {
            buffer.current += (data as { delta: string }).delta;
            frame.current ??= requestAnimationFrame(flush);
          } else if (event === "done") {
            const { message } = data as { message: Message };
            queryClient.setQueryData<Message[]>(key, (old = []) => [...old, message]);
            setState(IDLE);
          } else if (event === "error") {
            const { message } = data as { message: string };
            setState((s) => ({ ...s, status: "error", error: message, pendingQuestion: null }));
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          // The server keeps a partial answer when the client stops; reload the history.
          await queryClient.invalidateQueries({ queryKey: key });
          setState(IDLE);
        } else {
          const message = error instanceof ApiError || error instanceof Error ? error.message : "Streaming failed.";
          setState((s) => ({ ...s, status: "error", error: message, pendingQuestion: null }));
        }
      } finally {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = null;
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: qk.conversation(conversationId) });
      }
    },
    [conversationId, queryClient, flush],
  );

  return {
    state,
    send: (content: string) => run({ content }),
    regenerate: () => run({ regenerate: true }),
    stop: () => abortRef.current?.abort(),
    dismissError: () => setState(IDLE),
  };
}
