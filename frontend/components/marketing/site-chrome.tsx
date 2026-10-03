import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Start for Free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[2fr_1fr_1fr_1fr] md:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Your knowledge. Private. Searchable. Intelligent.</p>
          <p className="text-xs text-muted-foreground">Runs entirely on your hardware with open models.</p>
        </div>
        {[
          {
            title: "Product",
            links: [
              ["Features", "/features"],
              ["Pricing", "/pricing"],
              ["Dashboard", "/dashboard"],
            ],
          },
          {
            title: "Company",
            links: [
              ["About", "/about"],
              ["Privacy", "/about#privacy"],
            ],
          },
          {
            title: "Developers",
            links: [
              ["API docs", `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/docs/`],
              ["Self-hosting", "/about#self-hosting"],
            ],
          },
        ].map((col) => (
          <div key={col.title} className="space-y-3">
            <p className="text-sm font-medium">{col.title}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground md:px-6">
          © {new Date().getFullYear()} RecallAI. Released under the MIT License.
        </p>
      </div>
    </footer>
  );
}
