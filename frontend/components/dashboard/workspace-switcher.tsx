"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { workspaceApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { initials } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";

export function WorkspaceSwitcher() {
  const { workspaces, current, select, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () => workspaceApi.create(name.trim()),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspaces });
      select(workspace.id);
      setOpen(false);
      setName("");
      toast.success(`Workspace “${workspace.name}” created`);
    },
  });

  if (isLoading || !current) return <Skeleton className="h-10 w-full" />;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
            aria-label="Switch workspace"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[0.65rem] font-semibold text-primary-foreground">
              {initials(current.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{current.name}</span>
              <span className="block text-xs text-muted-foreground capitalize">{current.role.toLowerCase()}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => select(w.id)}>
              <span className="flex size-5 items-center justify-center rounded bg-muted text-[0.6rem] font-semibold">
                {initials(w.name)}
              </span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === current.id && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Plus /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>New workspace</DialogTitle>
              <DialogDescription>Workspaces keep knowledge, chats and members fully separate.</DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-1.5">
              <Label htmlFor="workspace-name">Name</Label>
              <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Final year" autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
