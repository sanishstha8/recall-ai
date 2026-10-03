import {
  ArrowRight,
  BookOpenCheck,
  Cpu,
  Database,
  FileSearch,
  FileText,
  Fingerprint,
  Layers,
  ListChecks,
  Lock,
  MessagesSquare,
  Quote,
  ServerOff,
  Sparkles,
  Timer,
  Upload,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight md:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Static illustration of the chat UI (not live data). */
function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl" id="demo">
      <div className="bg-dots absolute -inset-x-10 -top-10 -bottom-6 -z-10 rounded-[2rem] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-70" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_30px_80px_-30px_rgb(0_0_0/0.25)]">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 text-xs text-muted-foreground">BSc CSIT · Advanced Database.pdf</span>
        </div>
        <div className="grid md:grid-cols-[13rem_1fr]">
          <aside className="hidden space-y-1 border-r bg-sidebar/60 p-3 text-sm md:block">
            {["Explain normalization…", "ACID vs BASE", "B+ tree vs hash index", "Two-phase locking"].map((t, i) => (
              <div
                key={t}
                className={`truncate rounded-md px-2.5 py-1.5 ${i === 0 ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                {t}
              </div>
            ))}
          </aside>
          <div className="space-y-5 p-5 md:p-7">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              Explain normalization and give examples of 1NF, 2NF and 3NF.
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Sparkles className="size-3.5" />
              </div>
              <div className="space-y-3 text-sm leading-6">
                <p>
                  Normalization organizes relational data to reduce redundancy and update anomalies
                  <Cite n={1} />.
                </p>
                <p>
                  <strong>1NF</strong> requires atomic values — split a multi-valued{" "}
                  <code className="rounded bg-muted px-1">Courses</code> column into one row per course
                  <Cite n={2} />. <strong>2NF</strong> removes partial dependencies on a composite key
                  <Cite n={3} />, and <strong>3NF</strong> removes transitive dependencies such as EmpID → DeptID →
                  DeptName
                  <Cite n={4} />.
                </p>
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {[
                    [1, "Page 1"],
                    [2, "Page 2"],
                    [3, "Page 3"],
                    [4, "Page 4"],
                  ].map(([n, p]) => (
                    <div
                      key={n}
                      className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs"
                    >
                      <span className="flex size-5 items-center justify-center rounded bg-brand-soft font-semibold text-brand">
                        {n}
                      </span>
                      <span className="font-medium">Advanced Database.pdf</span>
                      <span className="text-muted-foreground">· {p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cite({ n }: { n: number }) {
  return (
    <span className="mx-0.5 inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-md bg-brand-soft px-1 align-middle text-[0.68rem] font-semibold text-brand">
      {n}
    </span>
  );
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    text: "Drop in PDFs, Word documents, text and Markdown — lecture notes, papers, books.",
  },
  {
    icon: Layers,
    title: "Index locally",
    text: "Text is extracted page by page, chunked and embedded by a local model into pgvector.",
  },
  {
    icon: MessagesSquare,
    title: "Ask",
    text: "Questions retrieve the most relevant passages and a local LLM answers from them.",
  },
  {
    icon: BookOpenCheck,
    title: "Verify & study",
    text: "Every answer cites its pages. Turn any document into quizzes, flashcards and exams.",
  },
];

const FEATURES = [
  {
    icon: FileSearch,
    title: "Semantic search",
    text: "Find passages by meaning, not keywords, across every document in a knowledge base.",
  },
  {
    icon: Quote,
    title: "Page-level citations",
    text: "Click a citation to open the exact page with the quoted passage highlighted.",
  },
  {
    icon: Zap,
    title: "Streaming answers",
    text: "Responses stream token by token, with Markdown, tables and code highlighting.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    text: "Generated question–answer cards you can flip, shuffle and review with the keyboard.",
  },
  { icon: ListChecks, title: "Quizzes", text: "Multiple-choice questions with explanations, scored on the server." },
  {
    icon: Timer,
    title: "Timed mock exams",
    text: "A real exam experience: timer, question palette, flags, and a full results review.",
  },
  {
    icon: Fingerprint,
    title: "Workspace isolation",
    text: "Every query is scoped to your workspace and checked on the server — never trusted to the browser.",
  },
  {
    icon: Database,
    title: "Your own Postgres",
    text: "Documents, vectors and conversations live in PostgreSQL + pgvector you control.",
  },
  {
    icon: Cpu,
    title: "Swappable models",
    text: "Choose any Ollama chat and embedding model through two environment variables.",
  },
];

const FAQ = [
  [
    "Does my data leave my computer?",
    "No. Documents are stored on your own disk, embeddings are computed by a local Ollama model, and answers are generated locally. RecallAI never calls a third-party AI API.",
  ],
  [
    "Do I need an API key or subscription?",
    "No. RecallAI runs at $0 with open models. You only need Docker (or Python + Node) and enough RAM for a small model such as llama3.2:3b.",
  ],
  [
    "Which file types are supported?",
    "PDF, DOCX, TXT and Markdown. Scanned image-only PDFs need OCR, which isn't supported yet — RecallAI tells you clearly when a PDF has no extractable text.",
  ],
  [
    "How accurate are the answers?",
    "Answers are grounded in retrieved passages and cite their pages, and the model is instructed to say when your documents don't cover a question. Small local models can still make mistakes, so citations make checking easy.",
  ],
  [
    "Can my team use it?",
    "Yes. Workspaces support owners, admins, members and viewers, and every resource is isolated per workspace.",
  ],
  [
    "Can I use a bigger model?",
    "Yes — pull any model with Ollama and set OLLAMA_CHAT_MODEL. A GPU makes larger models fast.",
  ],
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-dots absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-50" />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center md:px-6 md:pt-28">
          <Link
            href="/about#privacy"
            className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="size-3 text-brand" /> 100% local AI · no API keys · no data sharing
            <ArrowRight className="size-3" />
          </Link>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
            Your knowledge.
            <br />
            <span className="text-muted-foreground">Private. Searchable.</span>{" "}
            <span className="italic">Intelligent.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Chat with your documents, discover what you know, and turn your knowledge into actionable study material —
            powered by local AI.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="h-11 px-5">
              <Link href="/register">
                Start for Free <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-11 px-5">
              <a href="#demo">View Demo</a>
            </Button>
          </div>
        </div>
        <div className="px-4 pb-24 md:px-6">
          <ProductPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-sidebar/40 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading eyebrow="How it works" title="From PDF to cited answers in four steps" />
          <ol className="mt-14 grid gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border bg-card p-6">
                <span className="absolute top-6 right-6 font-display text-3xl text-muted-foreground/40">0{i + 1}</span>
                <s.icon className="size-5 text-brand" />
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Document intelligence + Private local AI */}
      <section className="py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2 md:px-6">
          <div className="rounded-3xl border bg-card p-8 md:p-10">
            <FileText className="size-6 text-brand" />
            <h3 className="mt-5 font-display text-3xl">Document intelligence</h3>
            <p className="mt-3 text-muted-foreground">
              Every page is extracted, cleaned and split into overlapping chunks that never cross page boundaries — so
              every answer can point back to the exact page it came from.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "PDF, DOCX, TXT and Markdown",
                "Live processing status with automatic retries",
                "Full-text page viewer with search and zoom",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border bg-primary p-8 text-primary-foreground md:p-10">
            <ServerOff className="size-6 text-brand" />
            <h3 className="mt-5 font-display text-3xl">Private, local AI</h3>
            <p className="mt-3 opacity-75">
              Embeddings and answers come from open models running in Ollama on your own hardware. Nothing is sent to
              OpenAI, Anthropic, Google or any other AI provider — there&apos;s simply no API key to leak.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Chat model", "llama3.2:3b"],
                ["Embeddings", "nomic-embed-text"],
                ["Vector store", "pgvector"],
                ["Cost", "$0"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-primary-foreground/15 px-3 py-2.5">
                  <p className="text-xs opacity-60">{k}</p>
                  <p className="font-mono text-sm">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RAG citations */}
      <section className="border-t py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 md:px-6">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand uppercase">Retrieval-augmented generation</p>
            <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
              Answers you can check, not just trust
            </h2>
            <p className="mt-4 text-muted-foreground">
              RecallAI retrieves the most relevant passages with vector search, reranks them, and asks the model to
              answer only from those sources — citing each claim. If your documents don&apos;t cover a question, it says
              so instead of guessing.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 font-mono text-xs leading-6 text-muted-foreground">
            <p className="text-foreground">question → embedding → pgvector top-k → rerank</p>
            <p>→ SOURCE 1 · Advanced Database.pdf · Page 42</p>
            <p>→ SOURCE 2 · Advanced Database.pdf · Page 43</p>
            <p className="text-foreground">→ local LLM (streamed) → answer [1][2]</p>
            <p>→ citations stored · click to open page 42</p>
          </div>
        </div>
      </section>

      {/* Study mode */}
      <section className="border-t bg-sidebar/40 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading
            eyebrow="Study mode"
            title="Turn reading into remembering"
            description="Generate summaries, flashcards, multiple-choice quizzes, written questions and timed mock exams from any knowledge base or single document."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Summary", "Short + detailed + key points"],
              ["Flashcards", "Flip, shuffle, review"],
              ["Quiz", "A–D with explanations"],
              ["Questions", "Short & long answer"],
              ["Mock exam", "Timer, scoring, review"],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border bg-card p-5">
                <p className="font-medium">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature showcase */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading eyebrow="Features" title="Everything a serious learner needs" />
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="size-5 text-brand" />
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-12 divide-y rounded-2xl border bg-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">Own your knowledge.</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-75">
            Self-host RecallAI in minutes with Docker. Free forever, private by design.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="secondary" asChild className="h-11 px-5">
              <Link href="/register">
                Start for Free <ArrowRight />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="h-11 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/features">Explore features</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
