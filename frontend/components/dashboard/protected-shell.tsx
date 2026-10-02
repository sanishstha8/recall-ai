"use client";

import { Library, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { CommandPalette } from "@/components/dashboard/command-palette";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ErrorState } from "@/components/dashboard/states";
import { Topbar } from "@/components/dashboard/topbar";
import { useAuth } from "@/lib/auth/auth-provider";
import { WorkspaceProvider, useWorkspace } from "@/stores/workspace-store";

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

/** Client-side route guard. The API independently rejects unauthenticated requests. */
export function useRequireAuth() {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  return status;
}

function WorkspaceGate({ children }: { children: ReactNode }) {
  const { isLoading, error, current } = useWorkspace();
  if (isLoading) return <FullPageSpinner />;
  if (error) return <ErrorState className="m-8" title="Couldn't load your workspaces" error={error} onRetry={() => location.reload()} />;
  if (!current)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <Library className="size-6 text-brand" />
        <p className="font-medium">You&apos;re not a member of any workspace yet.</p>
        <p className="text-sm text-muted-foreground">Create one from the workspace switcher in the sidebar.</p>
      </div>
    );
  return <>{children}</>;
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const status = useRequireAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  if (status !== "authenticated") return <FullPageSpinner />;
  return (
    <WorkspaceProvider>
      <div className="flex min-h-svh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenPalette={() => setPaletteOpen(true)} />
          <main className="flex-1">
            <WorkspaceGate>{children}</WorkspaceGate>
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </WorkspaceProvider>
  );
}
