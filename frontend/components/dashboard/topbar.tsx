"use client";

import { LogOut, Menu, Search, Settings, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SidebarContent } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/auth-provider";
import { initials } from "@/lib/utils/format";

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <button
        onClick={onOpenPalette}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[0.65rem] sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <Avatar className="size-8">
                {user?.avatar && <AvatarImage src={user.avatar} alt="" />}
                <AvatarFallback className="text-xs">{initials(user?.full_name ?? "")}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{user?.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <UserIcon /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings?tab=workspace">
                <Settings /> Workspace settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
