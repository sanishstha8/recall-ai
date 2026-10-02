"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, GraduationCap, Library, MessageSquarePlus, MessagesSquare, Moon, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { NAV_ITEMS } from "@/components/dashboard/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { conversationApi, documentApi, knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useWorkspace } from "@/stores/workspace-store";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { current } = useWorkspace();
  const workspaceId = current?.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const kbs = useQuery({
    queryKey: qk.knowledgeBases(workspaceId),
    queryFn: () => knowledgeApi.list({ workspace: workspaceId }),
    enabled: open && !!workspaceId,
  });
  const chats = useQuery({
    queryKey: qk.conversations(workspaceId),
    queryFn: () => conversationApi.list({ workspace: workspaceId }),
    enabled: open && !!workspaceId,
  });
  const docs = useQuery({
    queryKey: qk.recentDocuments(workspaceId),
    queryFn: () => documentApi.list({ workspace: workspaceId, page_size: 20 }),
    enabled: open && !!workspaceId,
  });

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump anywhere in RecallAI">
      <CommandInput placeholder="Search knowledge, chats, documents or actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/dashboard/chat")}>
            <MessageSquarePlus /> New chat
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/knowledge?new=1")}>
            <Library /> New knowledge base
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/knowledge")}>
            <Upload /> Upload document
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/study")}>
            <GraduationCap /> Generate study material
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} onSelect={() => go(href)}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {!!kbs.data?.results.length && (
          <CommandGroup heading="Knowledge bases">
            {kbs.data.results.map((kb) => (
              <CommandItem key={kb.id} value={`kb ${kb.name}`} onSelect={() => go(`/dashboard/knowledge/${kb.id}`)}>
                <Library /> {kb.name}
                <CommandShortcut>{kb.document_count} docs</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!chats.data?.results.length && (
          <CommandGroup heading="Conversations">
            {chats.data.results.slice(0, 15).map((c) => (
              <CommandItem key={c.id} value={`chat ${c.id} ${c.title}`} onSelect={() => go(`/dashboard/chat/${c.id}`)}>
                <MessagesSquare /> <span className="truncate">{c.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!docs.data?.results.length && (
          <CommandGroup heading="Documents">
            {docs.data.results.map((d) => (
              <CommandItem key={d.id} value={`doc ${d.id} ${d.name}`} onSelect={() => go(`/dashboard/documents/${d.id}`)}>
                <FileText /> <span className="truncate">{d.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
