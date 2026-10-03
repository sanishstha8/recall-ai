import type { Metadata } from "next";

import { ProtectedShell } from "@/components/dashboard/protected-shell";

export const metadata: Metadata = { title: "Admin" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
