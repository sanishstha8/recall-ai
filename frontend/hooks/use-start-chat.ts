"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { conversationApi } from "@/lib/api/endpoints";
import { useWorkspace } from "@/stores/workspace-store";

/** Create a conversation (optionally scoped to a knowledge base) and open it. */
export function useStartChat() {
  const { current } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { knowledgeBaseId?: number | null; initialQuestion?: string }) =>
      conversationApi.create({ workspace: current!.id, knowledge_base: args.knowledgeBaseId ?? null }),
    onSuccess: (conversation, args) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      const q = args.initialQuestion ? `?q=${encodeURIComponent(args.initialQuestion)}` : "";
      router.push(`/dashboard/chat/${conversation.id}${q}`);
    },
  });
}
