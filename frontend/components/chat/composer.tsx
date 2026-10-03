"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Check, Library, Plus, Square, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useWorkspace } from "@/stores/workspace-store";

export function Composer({
  onSend,
  onStop,
  streaming,
  knowledgeBaseId,
  onKnowledgeBaseChange,
  autoFocus,
  placeholder = "Ask your knowledge anything…",
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  knowledgeBaseId: number | null;
  onKnowledgeBaseChange: (id: number | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { current } = useWorkspace();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const kbs = useQuery({
    queryKey: qk.knowledgeBases(current?.id),
    queryFn: () => knowledgeApi.list({ workspace: current!.id }),
    enabled: !!current,
  });
  const selected = kbs.data?.results.find((kb) => kb.id === knowledgeBaseId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/20">
      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        rows={1}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label="Message"
        className="block max-h-56 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[0.95rem] outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Knowledge and attachments">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Answer from</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onKnowledgeBaseChange(null)}>
              <Library /> <span className="flex-1">All knowledge in workspace</span>
              {knowledgeBaseId === null && <Check />}
            </DropdownMenuItem>
            {kbs.data?.results.map((kb) => (
              <DropdownMenuItem key={kb.id} onSelect={() => onKnowledgeBaseChange(kb.id)}>
                <Library /> <span className="flex-1 truncate">{kb.name}</span>
                {knowledgeBaseId === kb.id && <Check />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={knowledgeBaseId ? `/dashboard/knowledge/${knowledgeBaseId}` : "/dashboard/knowledge"}>
                <Upload /> Upload a document
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span
          className="truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
          data-testid="composer-kb"
        >
          {selected?.name ?? "All knowledge"}
        </span>
        <span className="ml-auto hidden text-[0.7rem] text-muted-foreground sm:inline">
          Shift + Enter for a new line
        </span>
        {streaming ? (
          <Button size="icon-sm" variant="secondary" onClick={onStop} aria-label="Stop generating">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button size="icon-sm" onClick={submit} disabled={!value.trim()} aria-label="Send message">
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  );
}
