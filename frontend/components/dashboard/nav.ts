import { BarChart3, GraduationCap, LayoutDashboard, Library, MessagesSquare, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: Library },
  { href: "/dashboard/chat", label: "Chat", icon: MessagesSquare },
  { href: "/dashboard/study", label: "Study", icon: GraduationCap },
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function isActive(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
