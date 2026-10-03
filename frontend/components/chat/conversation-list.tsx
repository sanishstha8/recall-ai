"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";
import type { Conversation } from "@/types/api";

export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const { current } = useWorkspace();
  const params = useParams<{ conversationId?: string }>();
  const activeId = Number(params.conversationId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  const { data, isPending } = useQuery({
    queryKey: qk.conversations(current?.id),
    queryFn: () => conversationApi.list({ workspace: current!.id }),
    enabled: !!current,
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => conversationApi.update(id, { title }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.setQueryData(qk.conversation(conv.id), conv);
      setRenaming(null);
    },
  });
  const remove = useMutation({
    mutationFn: (conv: Conversation) => conversationApi.remove(conv.id).then(() => conv),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation deleted");
      if (conv.id === activeId) router.replace("/dashboard/chat");
    },
  });

  const items = (data?.results ?? []).filter((c) => c.title.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button asChild className="w-full justify-start" variant="outline">
          <Link href="/dashboard/chat" onClick={onNavigate}>
            <MessageSquarePlus /> New chat
          </Link>
        </Button>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search chats"
            className="h-8 pl-8 text-sm"
            aria-label="Search chats"
          />
        </div>
      </div>
      <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2 pb-3">
        {isPending ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {filter ? "No matching chats" : "No conversations yet"}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((c) => (
              <li key={c.id} className="group relative">
                {renaming?.id === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renaming.title.trim()) rename.mutate({ id: c.id, title: renaming.title.trim() });
                    }}
                    className="px-1 py-1"
                  >
                    <Input
                      autoFocus
                      value={renaming.title}
                      onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                      onBlur={() => setRenaming(null)}
                      onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                      className="h-8 text-sm"
                      aria-label="Conversation title"
                    />
                  </form>
                ) : (
                  <Link
                    href={`/dashboard/chat/${c.id}`}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-lg px-3 py-2 pr-9 transition-colors hover:bg-muted",
                      c.id === activeId && "bg-muted",
                    )}
                  >
                    <span className="block truncate text-sm">{c.title}</span>
                    <span className="block truncate text-[0.7rem] text-muted-foreground">
                      {c.knowledge_base_name ?? "All knowledge"} · {timeAgo(c.updated_at)}
                    </span>
                  </Link>
                )}
                {renaming?.id !== c.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`Actions for ${c.title}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRenaming({ id: c.id, title: c.title })}>
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this conversation?"
        description={`“${deleting?.title}” and all of its messages will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => (deleting ? remove.mutateAsync(deleting) : undefined)}
      />
    </div>
  );
}
