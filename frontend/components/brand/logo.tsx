import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* Stacked pages with a recall arc */}
      <path d="M10 9.5h9.5a3 3 0 0 1 3 3V23" className="fill-none stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 13.5h8.5a1.5 1.5 0 0 1 1.5 1.5v8.5H11a1.5 1.5 0 0 1-1.5-1.5z" className="fill-brand" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[1.05rem]">
        Recall<span className="text-brand">AI</span>
      </span>
    </Link>
  );
}
