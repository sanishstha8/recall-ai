"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { refreshAccessToken, setAccessToken, setUnauthorizedHandler } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { User } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  register: (body: { email: string; password: string; first_name?: string; last_name?: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const signOutLocally = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        if (!cancelled) setStatus("anonymous");
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUserState(me);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) signOutLocally();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOutLocally]);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocally);
    return () => setUnauthorizedHandler(null);
  }, [signOutLocally]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(email, password) {
        const me = await authApi.login(email, password);
        queryClient.clear();
        setUserState(me);
        setStatus("authenticated");
        return me;
      },
      async register(body) {
        const me = await authApi.register(body);
        queryClient.clear();
        setUserState(me);
        setStatus("authenticated");
        return me;
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          signOutLocally();
        }
      },
      setUser: setUserState,
    }),
    [user, status, queryClient, signOutLocally],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
