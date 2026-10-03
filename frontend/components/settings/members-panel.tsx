"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormError } from "@/components/forms/field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { workspaceApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";
import { initials } from "@/lib/utils/format";
import { useWorkspace } from "@/stores/workspace-store";
import type { Role, WorkspaceMember } from "@/types/api";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "ADMIN", label: "Admin", description: "Manage members and all content" },
  { value: "MEMBER", label: "Member", description: "Create knowledge bases and upload" },
  { value: "VIEWER", label: "Viewer", description: "Read, search, chat and study" },
];

export function MembersPanel() {
  const { current, can } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = current!.id;
  const canManage = can("ADMIN");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const members = useQuery({ queryKey: qk.members(workspaceId), queryFn: () => workspaceApi.members(workspaceId) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
    queryClient.invalidateQueries({ queryKey: qk.workspaces });
  };

  const add = useMutation({
    meta: { silent: true },
    mutationFn: () => workspaceApi.addMember(workspaceId, email.trim(), role),
    onSuccess: (m) => {
      toast.success(`${m.user.email} added`);
      setEmail("");
      invalidate();
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ member, role: next }: { member: WorkspaceMember; role: Role }) =>
      workspaceApi.updateMember(workspaceId, member.id, next),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (member: WorkspaceMember) => workspaceApi.removeMember(workspaceId, member.id),
    onSuccess: () => {
      toast.success("Member removed");
      invalidate();
    },
  });

  return (
    <div className="space-y-5">
      {canManage && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) add.mutate();
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              aria-label="Member email"
              className="h-9 flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-9 w-full sm:w-32" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r.value !== "ADMIN" || current?.role === "OWNER" || current?.role === "ADMIN").map(
                  (r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button type="submit" className="h-9" disabled={add.isPending || !email.trim()}>
              {add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
            </Button>
          </div>
          <FormError message={add.error?.message} />
          <p className="text-xs text-muted-foreground">The person needs an existing RecallAI account on this server.</p>
        </form>
      )}

      {members.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="divide-y rounded-xl border">
          {members.data?.results.map((m) => {
            const isSelf = m.user.id === user?.id;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(m.user.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.full_name} {isSelf && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                {m.role === "OWNER" || !canManage || isSelf ? (
                  <span className="text-xs text-muted-foreground capitalize">{m.role.toLowerCase()}</span>
                ) : (
                  <Select value={m.role} onValueChange={(v) => changeRole.mutate({ member: m, role: v as Role })}>
                    <SelectTrigger className="h-8 w-28" aria-label={`Role for ${m.user.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {m.role !== "OWNER" && (canManage || isSelf) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isSelf ? "Leave workspace" : `Remove ${m.user.email}`}
                    onClick={() => setRemoving(m)}
                  >
                    <X />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing?.user.id === user?.id ? "Leave this workspace?" : `Remove ${removing?.user.email}?`}
        description="They will immediately lose access to every knowledge base and conversation in this workspace."
        confirmLabel={removing?.user.id === user?.id ? "Leave" : "Remove"}
        destructive
        onConfirm={() => (removing ? remove.mutateAsync(removing) : undefined)}
      />
    </div>
  );
}
