"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { workspaceApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import type { Role, Workspace } from "@/types/api";

const STORAGE_KEY = "recallai.workspace";
const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

type WorkspaceContextValue = {
  workspaces: Workspace[];
  current: Workspace | null;
  isLoading: boolean;
  error: unknown;
  select: (id: number) => void;
  /** Whether the current user's role in the active workspace is at least `role`. */
  can: (role: Role) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

/** The active workspace is UI state; the backend still authorizes every request. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useQuery({ queryKey: qk.workspaces, queryFn: workspaceApi.list });
  const workspaces = useMemo(() => data?.results ?? [], [data]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedId(readStoredId());
  }, []);

  const current = useMemo(
    () => workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null,
    [workspaces, selectedId],
  );

  const select = useCallback((id: number) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // Storage unavailable (private mode): selection just won't persist.
    }
  }, []);

  const can = useCallback((role: Role) => (current ? RANK[current.role] >= RANK[role] : false), [current]);

  const value = useMemo(
    () => ({ workspaces, current, isLoading, error, select, can }),
    [workspaces, current, isLoading, error, select, can],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
