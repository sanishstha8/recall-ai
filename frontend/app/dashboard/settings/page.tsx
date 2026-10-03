"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/dashboard/states";
import { FormError, TextField } from "@/components/forms/field";
import { MembersPanel } from "@/components/settings/members-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authApi, systemApi, workspaceApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";
import { changePasswordSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "@/lib/validation/server-errors";
import { useWorkspace } from "@/stores/workspace-store";

function ProfileCard() {
  const { user, setUser } = useAuth();
  const [first, setFirst] = useState(user?.first_name ?? "");
  const [last, setLast] = useState(user?.last_name ?? "");
  const save = useMutation({
    mutationFn: (body: FormData | { first_name: string; last_name: string }) => authApi.updateMe(body),
    onSuccess: (u) => {
      setUser(u);
      toast.success("Profile updated");
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear to other members of your workspaces.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {user?.avatar && <AvatarImage src={user.avatar} alt="" />}
            <AvatarFallback>{initials(user?.full_name ?? "")}</AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="avatar" className="cursor-pointer text-sm font-medium text-brand hover:underline">
              Upload photo
            </Label>
            <input
              id="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append("avatar", file);
                save.mutate(form);
              }}
            />
            <p className="text-xs text-muted-foreground">PNG, JPG or WebP · up to 2 MB</p>
          </div>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ first_name: first, last_name: last });
          }}
        >
          <TextField id="first" label="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
          <TextField id="last" label="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          <TextField id="email-ro" label="Email" value={user?.email ?? ""} disabled className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
  });
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await authApi.changePassword(v.current_password, v.new_password);
      reset();
      toast.success("Password changed");
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["current_password", "new_password"]));
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Passwords are hashed with Django&apos;s PBKDF2 hasher and never stored in plain text.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-sm space-y-4">
          <FormError message={formError} />
          <TextField
            id="current_password"
            type="password"
            label="Current password"
            autoComplete="current-password"
            error={formState.errors.current_password?.message}
            {...register("current_password")}
          />
          <TextField
            id="new_password"
            type="password"
            label="New password"
            autoComplete="new-password"
            error={formState.errors.new_password?.message}
            {...register("new_password")}
          />
          <TextField
            id="confirm_password"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            error={formState.errors.confirm?.message}
            {...register("confirm")}
          />
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />} Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WorkspaceCard() {
  const { current, can, workspaces, select } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState(current!.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rename = useMutation({
    mutationFn: () => workspaceApi.update(current!.id, name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workspaces });
      toast.success("Workspace renamed");
    },
  });
  const remove = useMutation({
    mutationFn: () => workspaceApi.remove(current!.id),
    onSuccess: () => {
      const next = workspaces.find((w) => w.id !== current!.id);
      if (next) select(next.id);
      queryClient.invalidateQueries();
      toast.success("Workspace deleted");
    },
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Everything in a workspace is isolated from your other workspaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) rename.mutate();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!can("ADMIN")}
              aria-label="Workspace name"
              className="h-9"
            />
            {can("ADMIN") && (
              <Button
                type="submit"
                variant="outline"
                className="h-9"
                disabled={rename.isPending || name.trim() === current!.name}
              >
                Rename
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Owners and admins can invite people and change roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <MembersPanel />
        </CardContent>
      </Card>
      {current!.role === "OWNER" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Delete workspace</CardTitle>
            <CardDescription>
              Permanently deletes all knowledge bases, documents, conversations and study sets in “{current!.name}”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={workspaces.length < 2}
              title={workspaces.length < 2 ? "Create another workspace first" : undefined}
            >
              Delete workspace
            </Button>
            {workspaces.length < 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                You need at least one other workspace before deleting this one.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${current!.name}”?`}
        description="This cannot be undone."
        confirmLabel="Delete workspace"
        destructive
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  );
}

function WorkspaceSettings() {
  const { current } = useWorkspace();
  // Re-mount per workspace so the rename field starts from the selected workspace's name.
  return <WorkspaceCard key={current!.id} />;
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid max-w-md grid-cols-3 gap-3">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm hover:bg-muted/50",
                theme === value && "border-brand bg-brand-soft/50",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LocalAICard() {
  const { data, isPending } = useQuery({ queryKey: qk.readiness, queryFn: systemApi.readiness });
  const ai = data?.checks.ai;
  const detail =
    ai && typeof ai.detail === "object"
      ? (ai.detail as { chat_model: string; embedding_model: string; installed_models: string[] })
      : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local AI</CardTitle>
        <CardDescription>
          Models are served by Ollama on your machine. No API keys, no third-party AI services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isPending ? (
          <p className="text-muted-foreground">Checking…</p>
        ) : detail ? (
          <dl className="grid max-w-lg grid-cols-[10rem_1fr] gap-y-2">
            <dt className="text-muted-foreground">Chat model</dt>
            <dd className="font-mono text-xs">{detail.chat_model}</dd>
            <dt className="text-muted-foreground">Embedding model</dt>
            <dd className="font-mono text-xs">{detail.embedding_model}</dd>
            <dt className="text-muted-foreground">Installed models</dt>
            <dd className="font-mono text-xs">{detail.installed_models.join(", ")}</dd>
          </dl>
        ) : (
          <p className="text-destructive">{typeof ai?.detail === "string" ? ai.detail : "Ollama is not reachable."}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Change models with OLLAMA_CHAT_MODEL / OLLAMA_EMBEDDING_MODEL in your .env file.
        </p>
      </CardContent>
    </Card>
  );
}

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "profile";
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader title="Settings" />
      <Tabs value={tab} onValueChange={(t) => router.replace(`/dashboard/settings?tab=${t}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6 space-y-6">
          <ProfileCard />
          <PasswordCard />
        </TabsContent>
        <TabsContent value="workspace" className="mt-6">
          <WorkspaceSettings />
        </TabsContent>
        <TabsContent value="preferences" className="mt-6 space-y-6">
          <AppearanceCard />
          <LocalAICard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
