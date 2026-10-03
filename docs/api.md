# API

Interactive documentation: **http://localhost:8000/api/docs/** (Swagger UI, served locally) · OpenAPI schema: **/api/schema/**.

Base URL: `/api/v1/`. All endpoints except auth and health require `Authorization: Bearer <access token>`.

## Errors

Every error uses one envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "email: An account with this email already exists.",
    "details": { "email": ["An account with this email already exists."] },
    "request_id": "8c1f…"
  }
}
```

| Status | Meaning |
| --- | --- |
| 400 | Validation error (`details` has per-field messages) |
| 401 | Missing/expired token — refresh and retry |
| 403 | Your workspace role does not allow the action |
| 404 | Not found **or not in your workspaces** |
| 409 | Conflict (e.g. document already processing) |
| 429 | Rate limited |
| 502 | Local model returned an error (e.g. model not pulled) |
| 503 | Ollama unreachable |

## Endpoints

### Auth
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register/` | `{email, password, first_name?, last_name?}` → `{access, user}` + refresh cookie. Creates a personal workspace. |
| POST | `/auth/login/` | `{email, password}` → `{access, user}` + refresh cookie |
| POST | `/auth/refresh/` | Uses the cookie (or `{refresh}`) → `{access}`; rotates the refresh token |
| POST | `/auth/logout/` | Blacklists the refresh token, clears the cookie |
| GET/PATCH | `/auth/me/` | Profile; PATCH accepts JSON or multipart (`avatar`) |
| POST | `/auth/password/change/` | `{current_password, new_password}` |
| POST | `/auth/password-reset/` | `{email}` — always 202 (no account enumeration) |
| POST | `/auth/password-reset/confirm/` | `{uid, token, new_password}` |

### Workspaces & members
| Method | Path |
| --- | --- |
| GET, POST | `/workspaces/` |
| GET, PATCH, DELETE | `/workspaces/{id}/` |
| GET, POST | `/workspaces/{id}/members/` (`{email, role}`) |
| PATCH, DELETE | `/workspaces/{id}/members/{member_id}/` |

### Knowledge bases, documents, search
| Method | Path | Notes |
| --- | --- | --- |
| GET, POST | `/knowledge-bases/` | `?workspace=&search=` |
| GET, PATCH, DELETE | `/knowledge-bases/{id}/` | |
| GET, POST | `/knowledge-bases/{id}/documents/` | POST is `multipart/form-data` with `file` |
| POST | `/knowledge-bases/{id}/search/` | `{query, top_k?, document_ids?}` — semantic search, no LLM |
| GET | `/documents/` | `?workspace=&knowledge_base=&status=&search=` |
| GET, DELETE | `/documents/{id}/` | |
| POST | `/documents/{id}/reprocess/` | 202 |
| GET | `/documents/{id}/status/` | Lightweight polling |
| GET | `/documents/{id}/pages/` | Paginated pages, or `?page_number=N` |
| GET | `/documents/{id}/search-text/?q=` | In-document text search |
| GET | `/documents/{id}/file/` | Original file (`?download=1` for attachment) |

### Conversations
| Method | Path | Notes |
| --- | --- | --- |
| GET, POST | `/conversations/` | `{workspace, knowledge_base?, title?}` |
| GET, PATCH, DELETE | `/conversations/{id}/` | |
| GET | `/conversations/{id}/messages/` | History with citations |
| POST | `/conversations/{id}/messages/` | `{content}` or `{regenerate: true}` — waits for the full answer |
| POST | `/conversations/{id}/stream/` | Same body — **Server-Sent Events** (see [rag.md](rag.md#streaming)) |

Example:

```bash
curl -N -X POST http://localhost:8000/api/v1/conversations/1/stream/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content": "Explain normalization and give examples of 1NF, 2NF and 3NF."}'
```

### Study
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/study/summary/`, `/study/flashcards/`, `/study/quiz/`, `/study/questions/`, `/study/mock-exam/` | `{knowledge_base, document?, topic?, count?, difficulty?, time_limit_minutes?}` → 202 with a `PENDING` study set |
| GET | `/study/sets/` | `?kind=&knowledge_base=&workspace=` |
| GET, PATCH, DELETE | `/study/sets/{id}/` | Poll until `READY` / `FAILED` |
| POST | `/study/sets/{id}/regenerate/` | |
| GET, POST | `/study/sets/{id}/attempts/` | POST `{answers: {"1": "B"}, duration_seconds}` → scored attempt |

### Usage, health, admin
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/usage/` | `?workspace=&scope=me|workspace&operation=&days=` |
| GET | `/usage/summary/` | Totals, by operation, by day, by model |
| GET | `/health/` | Liveness |
| GET | `/health/ready/` | DB/pgvector, broker and Ollama model checks (503 when degraded) |
| GET | `/admin/analytics/` | Staff only |

## Rate limits

Configurable via env: `THROTTLE_ANON` (60/min), `THROTTLE_USER` (600/min), `THROTTLE_AUTH` (10/min per IP on credential endpoints), `THROTTLE_AI` (30/min per user on chat/search/study), `THROTTLE_UPLOAD` (30/min).
