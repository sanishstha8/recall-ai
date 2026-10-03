# RecallAI

> **Your knowledge. Private. Searchable. Intelligent.**

RecallAI is a privacy-first, local AI knowledge and study workspace. Upload your documents, search them by meaning, chat with them through a locally hosted LLM with **page-level citations**, and turn them into summaries, flashcards, quizzes and timed mock exams — **without sending your data to any third-party AI service and without paying for anything.**

![Chat with cited answers](docs/screenshots/chat.png)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start (Docker)](#quick-start-docker)
- [Ollama models](#ollama-models)
- [Local development without Docker](#local-development-without-docker)
- [Environment variables](#environment-variables)
- [Running tests](#running-tests)
- [API documentation](#api-documentation)
- [Project structure](#project-structure)
- [Screenshots](#screenshots)
- [Security](#security)
- [Roadmap](#roadmap)

Deep dives: [Architecture](docs/architecture.md) · [RAG pipeline](docs/rag.md) · [Database](docs/database.md) · [API](docs/api.md)

## Features

**Knowledge**
- Workspaces with **owner / admin / member / viewer** roles and strict server-side isolation
- Knowledge bases with drag-and-drop upload of **PDF, DOCX, TXT and Markdown**
- Asynchronous processing (Celery): extraction → cleaning → chunking → local embeddings → pgvector, with live status and one-click retry
- Document viewer: page navigation, in-document search, zoom, original-PDF preview, citation highlighting
- Semantic search across a knowledge base (no LLM call)

**AI chat (RAG)**
- Local embeddings (`nomic-embed-text`) + local LLM (`llama3.2:3b` by default) via **Ollama**
- pgvector cosine search (HNSW) → reranking → relevance threshold → grounded prompt
- **Streaming** answers over Server-Sent Events with Markdown and code highlighting
- **Clickable citations** `[1]` that open the exact page with the passage highlighted
- Conversation history, rename, delete, regenerate, stop, per-conversation knowledge base
- Optional hybrid retrieval (vector + PostgreSQL full-text, reciprocal rank fusion)

**Study mode**
- Short summary, detailed summary and key points
- Flip-card flashcards
- Multiple-choice quizzes with explanations
- Short- and long-answer questions with model answers
- **Timed mock exams** with question palette, flags, auto-submit, server-side scoring and review

**Platform**
- Usage tracking (operation, model, tokens, latency — cost is always $0 locally)
- Admin analytics dashboard + Django admin
- JWT auth with in-memory access token and httpOnly refresh cookie, rate limiting, upload validation
- OpenAPI docs, structured JSON logging with request ids, health/readiness probes
- Dark / light mode, responsive layout, command palette (Ctrl/⌘ K)

## Architecture

```mermaid
flowchart LR
    UI["Next.js frontend"] -- REST + SSE --> API["Django REST API"]
    API --> PG[("PostgreSQL + pgvector")]
    API --> FS[("Document storage")]
    API -- tasks --> RD[("Redis")] --> W["Celery worker"]
    W -- embeddings --> OL["Ollama (local models)"]
    API -- query embedding + streamed generation --> OL
    W --> PG
```

### RAG pipeline

```mermaid
flowchart LR
    Q[Question] --> E[Local embedding] --> V["pgvector top-k<br/>(scoped to your workspace)"] --> R[Rerank] --> C["Context<br/>SOURCE 1 · Page 42"] --> P[Grounded prompt] --> L[Local LLM] --> A["Streamed answer + [n] citations"]
```

More detail: [docs/rag.md](docs/rag.md).

### Local AI architecture

Nothing in RecallAI calls a cloud AI API. Every model call goes through two small interfaces — `LLMProvider` (`generate()`, `stream()`) and `EmbeddingProvider` — implemented by `OllamaProvider` and `OllamaEmbeddingProvider`. Views never talk to Ollama directly:

```text
View → ChatService → RAGPipeline → Retriever / Reranker / PromptBuilder → LLMProvider → Ollama
```

Providers are selected by dotted path (`AI_LLM_PROVIDER`, `AI_EMBEDDING_PROVIDER`), so another backend can be added without touching business logic.

### Database architecture

PostgreSQL holds users, workspaces, knowledge bases, documents → pages → chunks (with `vector` embeddings and a generated `tsvector`), conversations → messages → citations, study sets, quiz attempts and usage records. See the ER diagram in [docs/database.md](docs/database.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, React Hook Form, Zod |
| Backend | Python 3.12, Django 5.2 LTS, Django REST Framework, SimpleJWT, drf-spectacular |
| Data | PostgreSQL 17 + pgvector, Redis |
| Async | Celery |
| Local AI | Ollama — `llama3.2:3b` (chat), `nomic-embed-text` (embeddings) |
| Parsing | pypdf, python-docx |
| Testing | pytest + pytest-django, Vitest + Testing Library, Playwright |
| Ops | Docker Compose, gunicorn (gthread), WhiteNoise |

## Quick start (Docker)

Requirements: Docker Desktop (or Docker Engine + Compose v2), ~8 GB RAM, ~6 GB disk.

```bash
git clone <repository> recall-ai
cd recall-ai
cp .env.example .env            # then set SECRET_KEY to a long random string
docker compose up --build -d
```

Download the models once (≈2.3 GB — not done automatically):

```bash
./docker/pull-models.sh         # macOS / Linux / Git Bash
.\docker\pull-models.ps1        # Windows PowerShell
```

Then open:

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API docs | http://localhost:8000/api/docs/ |
| Health | http://localhost:8000/api/v1/health/ |
| Readiness (DB, broker, models) | http://localhost:8000/api/v1/health/ready/ |
| Django admin | http://localhost:8000/admin/ |

Create an admin account (for `/admin` and the analytics dashboard):

```bash
docker compose exec backend python manage.py createsuperuser
```

A ready-made sample document lives at [`docs/samples/Advanced Database.pdf`](docs/samples/Advanced%20Database.pdf) — create a knowledge base, upload it, and ask *"Explain normalization and give examples of 1NF, 2NF and 3NF."*

Persistent volumes: `postgres_data`, `redis_data`, `ollama_models`, `documents` (uploaded files) and `media` (avatars).

## Ollama models

| Purpose | Default | Env var | Notes |
| --- | --- | --- | --- |
| Chat / study generation | `llama3.2:3b` | `OLLAMA_CHAT_MODEL` | Any Ollama chat model. Bigger = better answers, slower on CPU. `qwen2.5:7b`, `llama3.1:8b` work well with a GPU. |
| Embeddings | `nomic-embed-text` | `OLLAMA_EMBEDDING_MODEL` | Must match `EMBEDDING_DIMENSIONS` (768). `mxbai-embed-large` is 1024. |

Changing the embedding model on an existing database requires a migration for the vector column size and reprocessing documents (retrieval only compares vectors from the current model, so nothing breaks silently).

GPU: uncomment the `deploy.resources` block of the `ollama` service in `docker-compose.yml` (NVIDIA Container Toolkit required). On CPU, expect the first token in ~5 s and full answers / quizzes in 1–3 minutes with the default 3B model.

## Local development without Docker

Prerequisites: Python 3.12, Node 20+, PostgreSQL with pgvector, Ollama (Redis optional).

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements/development.txt
# .env at the repo root: DATABASE_URL=postgres://…/recallai, OLLAMA_BASE_URL=http://localhost:11434
# Without Redis, set CELERY_TASK_ALWAYS_EAGER=true to run tasks inline.
python manage.py migrate
python manage.py runserver
celery -A config worker -l info        # if using Redis (add --pool=solo on Windows)

# Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev

# Models
ollama pull llama3.2:3b && ollama pull nomic-embed-text
```

## Environment variables

All configuration lives in `.env` (template: [`.env.example`](.env.example)). Never commit `.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `DEBUG` | `true` | Django debug mode |
| `SECRET_KEY` | — | **Required.** Long random string |
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` | Use `config.settings.production` behind HTTPS |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | |
| `DATABASE_URL` | `postgres://recallai:recallai@postgres:5432/recallai` | PostgreSQL with pgvector |
| `REDIS_URL` | `redis://redis:6379/0` | Celery broker + cache (rate limiting) |
| `CELERY_TASK_ALWAYS_EAGER` | `false` | Run tasks inline (no worker) |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | |
| `OLLAMA_CHAT_MODEL` | `llama3.2:3b` | |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | |
| `EMBEDDING_DIMENSIONS` | `768` | Must match the embedding model |
| `EMBEDDING_QUERY_PREFIX` / `EMBEDDING_DOCUMENT_PREFIX` | nomic prefixes | Blank for models that don't use them |
| `OLLAMA_NUM_CTX` / `OLLAMA_REQUEST_TIMEOUT` | `8192` / `300` | |
| `CHUNK_SIZE_TOKENS` / `CHUNK_OVERLAP_TOKENS` | `600` / `80` | |
| `RAG_TOP_K` / `RAG_CONTEXT_CHUNKS` / `RAG_MIN_SCORE` | `10` / `5` / `0.5` | Retrieval tuning |
| `RAG_RETRIEVER` | `vector` | `hybrid` = vector + full-text |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | `http://localhost:3000,…` | |
| `MAX_UPLOAD_SIZE` | `26214400` | Bytes (25 MB) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API URL as seen by the **browser** (baked in at build time) |
| `DOCUMENT_STORAGE_BACKEND` / `DOCUMENT_STORAGE_OPTIONS` | filesystem | Swap to S3/Supabase via django-storages |
| `THROTTLE_*` | see [docs/api.md](docs/api.md#rate-limits) | Rate limits |

## Running tests

```bash
# Backend: 96 tests (auth, isolation, permissions, uploads, processing, chunking,
# vector retrieval, RAG, streaming, citations, study, usage, health, OpenAPI)
cd backend && pytest
ruff check . && ruff format --check .

# Frontend: unit/component tests + types + lint
cd frontend && npm test && npm run typecheck && npm run lint

# End-to-end (real stack incl. Ollama must be running, e.g. docker compose up)
cd frontend && npx playwright install chromium && npm run test:e2e
```

Backend tests need PostgreSQL with pgvector (the test database is created automatically). Model calls are replaced at the provider boundary by deterministic offline doubles (a hashing embedder and a scripted LLM), so the full pipeline — parsing, chunking, pgvector storage and search, prompts, citations, SSE, study validation — runs for real without Ollama. The Ollama providers themselves are tested against a mocked HTTP transport. The Playwright suite exercises the full acceptance flow against real local models: register → workspace → knowledge base → upload PDF → processing → streamed answer → citation → generated quiz → score.

## API documentation

Swagger UI at **/api/docs/** (assets served locally, works offline), OpenAPI schema at **/api/schema/**. Summary, error format and the SSE event contract: [docs/api.md](docs/api.md).

## Project structure

```text
recall-ai/
├── backend/
│   ├── config/            # settings (base/development/production/test), urls, celery
│   ├── apps/
│   │   ├── accounts/      # custom user, JWT auth, password reset
│   │   ├── workspaces/    # workspaces, members, roles
│   │   ├── knowledge/     # knowledge bases + scoping selectors
│   │   ├── documents/     # upload validation, parsers, cleaning, chunking, Celery pipeline
│   │   ├── ai/            # providers (Ollama), rag/ (retriever, reranker, context, prompt, pipeline), chat service
│   │   ├── conversations/ # conversations, messages, citations, SSE endpoint
│   │   ├── study/         # study generation, attempts, scoring
│   │   ├── usage/         # usage records, analytics
│   │   └── health/        # liveness/readiness
│   ├── common/            # permissions, errors, logging, storage, pagination, throttles
│   ├── scripts/           # sample PDF generator
│   └── tests/             # pytest suite + offline AI doubles
├── frontend/
│   ├── app/               # (marketing), (auth), dashboard/, admin/
│   ├── components/        # ui/ (shadcn), chat/, documents/, knowledge/, study/, dashboard/, …
│   ├── hooks/ lib/ stores/ types/
│   └── tests/             # unit/ (Vitest) and e2e/ (Playwright)
├── docker/                # model pull scripts
├── docs/                  # architecture, RAG, database, API, screenshots, sample PDF
├── docker-compose.yml
└── .env.example
```

## Screenshots

| | |
| --- | --- |
| ![Landing](docs/screenshots/landing.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| ![Knowledge base](docs/screenshots/knowledge-base.png) | ![Document viewer](docs/screenshots/document-viewer.png) |
| ![Mock exam](docs/screenshots/exam.png) | ![Dark mode](docs/screenshots/dark-mode.png) |

## Security

- Passwords hashed with Django's PBKDF2; email is the login identifier
- Access token in memory only; refresh token in an `httpOnly` cookie scoped to `/api/v1/auth/`, rotated and blacklisted on use/logout
- Server-side workspace isolation on every query (404 for outsiders), role checks for mutations
- Upload limits, extension **and content sniffing** (PDF magic bytes, DOCX zip structure with zip-bomb guard, text without NUL bytes); filenames sanitized and never used for storage paths; files are never executed and are served with `nosniff` + sandbox CSP
- Model output rendered with `react-markdown` (no raw HTML) — XSS-safe; source text is treated as data in prompts (prompt-injection guidance)
- DRF throttling for auth, AI, uploads; CORS restricted to configured origins; secrets only via environment
- ORM-only database access (no raw SQL with user input)

## Roadmap

Not implemented yet (out of MVP scope): OCR for scanned PDFs · website and YouTube ingestion · team invitations by email · voice · browser extension · mobile app · optional cloud AI providers (the provider interface is ready) · payments · public API keys · agents.

## License

[MIT](LICENSE)
