"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS, isActive } from "@/components/dashboard/nav";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Logo href="/dashboard" className="px-1" />
      <WorkspaceSwitcher />
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...item }) => {
          const active = isActive(pathname, href, "exact" in item && item.exact);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                active && "bg-sidebar-accent font-medium text-foreground",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />}
              <Icon className={cn("size-4", active && "text-brand")} />
              {label}
            </Link>
          );
        })}
        {user?.is_staff && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <ShieldCheck className="size-4" /> Admin
          </Link>
        )}
      </nav>
      <div className="mt-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <span className="size-1.5 rounded-full bg-success" /> Local AI
        </div>
        Documents and questions are processed on your own machine.
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
      <div className="sticky top-0 h-svh">
        <SidebarContent />
      </div>
    </aside>
  );
}
