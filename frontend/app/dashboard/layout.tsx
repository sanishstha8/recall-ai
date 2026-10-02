import type { Metadata } from "next";

import { ProtectedShell } from "@/components/dashboard/protected-shell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · RecallAI" } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
