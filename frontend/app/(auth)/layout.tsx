import { Lock, Quote } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <aside className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-dots absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-60" />
        <Logo className="relative" />
        <div className="relative max-w-lg space-y-6">
          <Quote className="size-8 text-brand" />
          <p className="font-display text-4xl leading-tight">
            Everything you&apos;ve read, searchable in seconds — and it never leaves your machine.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Lock className="size-4" />
            Local embeddings · Local LLM · Your own Postgres
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} RecallAI · Open source, self-hosted
        </p>
      </aside>
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
