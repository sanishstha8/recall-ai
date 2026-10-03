import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 md:px-6">
      <div className="text-center">
        <p className="text-xs font-medium tracking-[0.18em] text-brand uppercase">Pricing</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Free. Because it runs on your hardware.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          RecallAI uses local open models, so there are no per-token fees, no API keys and no subscriptions.
        </p>
      </div>
      <div className="mx-auto mt-14 grid max-w-3xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-8">
          <p className="font-medium">Self-hosted</p>
          <p className="mt-4 font-display text-5xl">$0</p>
          <p className="text-sm text-muted-foreground">forever</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              "Unlimited documents & chats",
              "All study tools",
              "Workspaces & team roles",
              "Local Ollama models",
              "MIT licensed",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="size-4 text-brand" /> {f}
              </li>
            ))}
          </ul>
          <Button className="mt-8 w-full" asChild>
            <Link href="/register">Start for Free</Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-dashed p-8">
          <p className="font-medium">What you need</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>• Docker Desktop (or Python 3.12 + Node 20+)</li>
            <li>• ~8 GB RAM for llama3.2:3b (more for larger models)</li>
            <li>• ~3 GB disk for the default models</li>
            <li>• Optional: a GPU for much faster generation</li>
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">
            Costs shown on the usage page are always $0 for local inference.
          </p>
        </div>
      </div>
    </div>
  );
}
