import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-20 md:px-6">
      <header>
        <p className="text-xs font-medium tracking-[0.18em] text-brand uppercase">About</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">A knowledge workspace that respects you</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          RecallAI is a privacy-first AI knowledge and study platform. It lets you chat with your own documents without
          sending private data to third-party AI services.
        </p>
      </header>
      <section id="privacy" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-semibold">Privacy by architecture</h2>
        <p className="text-muted-foreground">
          Privacy isn&apos;t a setting — it&apos;s how RecallAI is built. Files are stored on your disk, text extraction
          runs in your backend, embeddings and answers are produced by models running in Ollama on your machine, and
          vectors live in your own PostgreSQL database. The application has no code path that calls a cloud AI provider.
        </p>
      </section>
      <section id="self-hosting" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-semibold">Self-hosting</h2>
        <p className="text-muted-foreground">
          Clone the repository, copy the environment template, and start the stack:
        </p>
        <pre className="overflow-x-auto rounded-xl border bg-muted/50 p-4 font-mono text-sm">
          {`cp .env.example .env
docker compose up --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull nomic-embed-text`}
        </pre>
        <p className="text-muted-foreground">Then open http://localhost:3000. Full instructions are in the README.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Open technology</h2>
        <p className="text-muted-foreground">
          Next.js, React and Tailwind on the front end; Django, Django REST Framework, Celery and Redis on the back end;
          PostgreSQL with pgvector for storage and search; Ollama for local models.
        </p>
      </section>
    </article>
  );
}
