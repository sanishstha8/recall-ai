import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Features" };

const GROUPS = [
  {
    title: "Knowledge & documents",
    items: [
      "Workspaces with owner / admin / member / viewer roles",
      "Knowledge bases to group related documents",
      "Drag-and-drop upload of PDF, DOCX, TXT and Markdown (up to 25 MB)",
      "Asynchronous processing pipeline with live status and one-click retry",
      "Page viewer with navigation, in-document search, zoom and original-PDF preview",
    ],
  },
  {
    title: "Retrieval & chat",
    items: [
      "Local embeddings (nomic-embed-text by default) stored in PostgreSQL + pgvector",
      "Cosine similarity search with HNSW indexes, reranking and relevance thresholds",
      "Optional hybrid retrieval: vector + Postgres full-text with reciprocal rank fusion",
      "Streaming answers over Server-Sent Events with Markdown and code highlighting",
      "Inline, clickable citations that open the exact page with the passage highlighted",
      "Conversation history, rename, delete, regenerate and stop generation",
    ],
  },
  {
    title: "Study",
    items: [
      "Short summary, detailed summary and key points",
      "Flip-card flashcards with shuffle and keyboard shortcuts",
      "Multiple-choice quizzes with explanations",
      "Short- and long-answer questions with model answers",
      "Timed mock exams with question palette, flags, auto-submit and scored review",
    ],
  },
  {
    title: "Platform",
    items: [
      "Usage tracking per operation, model, tokens and latency",
      "Admin analytics: users, documents, AI requests, failures and system health",
      "JWT auth with httpOnly refresh cookie, rate limiting and upload validation",
      "OpenAPI documentation at /api/docs/",
      "One-command Docker Compose deployment",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 md:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.18em] text-brand uppercase">Features</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Built for depth, designed for privacy</h1>
        <p className="mt-4 text-muted-foreground">
          Every capability below runs on your own machine — no cloud AI, no telemetry.
        </p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-2xl border bg-card p-7">
            <h2 className="font-medium">{g.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {g.items.map((i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-14 text-center">
        <Button size="lg" asChild>
          <Link href="/register">Start for Free</Link>
        </Button>
      </div>
    </div>
  );
}
