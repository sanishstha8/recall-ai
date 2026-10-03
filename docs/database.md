# Database

PostgreSQL 17 with the `vector` extension (pgvector). The extension is created by the first `documents` migration.

```mermaid
erDiagram
    USER ||--o{ WORKSPACE_MEMBER : "belongs to"
    USER ||--o{ WORKSPACE : owns
    WORKSPACE ||--o{ WORKSPACE_MEMBER : has
    WORKSPACE ||--o{ KNOWLEDGE_BASE : contains
    KNOWLEDGE_BASE ||--o{ DOCUMENT : contains
    DOCUMENT ||--o{ DOCUMENT_PAGE : has
    DOCUMENT_PAGE ||--o{ DOCUMENT_CHUNK : "split into"
    KNOWLEDGE_BASE ||--o{ DOCUMENT_CHUNK : "scopes (denormalized)"
    WORKSPACE ||--o{ CONVERSATION : contains
    USER ||--o{ CONVERSATION : starts
    KNOWLEDGE_BASE |o--o{ CONVERSATION : "optionally scoped to"
    CONVERSATION ||--o{ MESSAGE : has
    MESSAGE ||--o{ CITATION : cites
    DOCUMENT ||--o{ CITATION : "cited in"
    DOCUMENT_CHUNK |o--o{ CITATION : "source chunk"
    WORKSPACE ||--o{ STUDY_SET : contains
    STUDY_SET ||--o{ QUIZ_ATTEMPT : has
    WORKSPACE ||--o{ USAGE_RECORD : records

    USER {
        bigint id PK
        string email UK
        string password "PBKDF2 hash"
        string first_name
        string last_name
        image avatar
        bool is_active
        bool is_staff
    }
    WORKSPACE {
        bigint id PK
        string name
        slug slug UK
        bigint owner_id FK
    }
    WORKSPACE_MEMBER {
        bigint id PK
        bigint workspace_id FK
        bigint user_id FK
        enum role "OWNER|ADMIN|MEMBER|VIEWER"
        datetime joined_at
    }
    KNOWLEDGE_BASE {
        bigint id PK
        bigint workspace_id FK
        string name
        text description
        string icon
    }
    DOCUMENT {
        bigint id PK
        bigint knowledge_base_id FK
        bigint uploaded_by_id FK
        string name
        string original_filename
        string file_type
        bigint file_size
        string content_hash
        string storage_path
        enum status "UPLOADED|PROCESSING|READY|FAILED"
        enum processing_stage
        int page_count
        int word_count
        int chunk_count
        text processing_error
        datetime processed_at
    }
    DOCUMENT_PAGE {
        bigint id PK
        bigint document_id FK
        int page_number
        text content
    }
    DOCUMENT_CHUNK {
        bigint id PK
        bigint document_id FK
        bigint page_id FK
        bigint knowledge_base_id FK
        text content
        int chunk_index
        int token_count
        vector embedding "vector(EMBEDDING_DIMENSIONS)"
        string embedding_model
        int embedding_dimensions
        tsvector search_vector "generated"
        jsonb metadata
    }
    CONVERSATION {
        bigint id PK
        bigint workspace_id FK
        bigint knowledge_base_id FK "nullable"
        bigint user_id FK
        string title
        string model
    }
    MESSAGE {
        bigint id PK
        bigint conversation_id FK
        enum role "SYSTEM|USER|ASSISTANT"
        text content
        string model
        int prompt_tokens
        int completion_tokens
        int total_tokens
    }
    CITATION {
        bigint id PK
        bigint message_id FK
        bigint document_id FK
        bigint chunk_id FK "nullable"
        int source_index
        int page_number
        text quoted_content
        float relevance_score
        bool cited
    }
    STUDY_SET {
        bigint id PK
        bigint workspace_id FK
        bigint knowledge_base_id FK
        bigint document_id FK "nullable"
        bigint user_id FK
        enum kind "SUMMARY|FLASHCARDS|QUIZ|QUESTIONS|MOCK_EXAM"
        enum status "PENDING|GENERATING|READY|FAILED"
        enum difficulty
        jsonb content
        jsonb sources
    }
    QUIZ_ATTEMPT {
        bigint id PK
        bigint study_set_id FK
        bigint user_id FK
        jsonb answers
        jsonb results
        int score
        int total
    }
    USAGE_RECORD {
        bigint id PK
        bigint workspace_id FK
        bigint user_id FK
        enum operation "CHAT|EMBEDDING|SUMMARY|FLASHCARD|QUIZ|QUESTIONS|MOCK_EXAM"
        string model
        int input_tokens
        int output_tokens
        int total_tokens
        decimal estimated_cost
        int latency_ms
        bool success
    }
```

## Indexes

| Table | Index | Purpose |
| --- | --- | --- |
| `documents_documentchunk` | HNSW on `embedding` (`vector_cosine_ops`) | Fast approximate nearest-neighbour search |
| `documents_documentchunk` | GIN on `search_vector` | Full-text search for hybrid retrieval |
| `documents_documentchunk` | `(knowledge_base_id, embedding_model)` | Scope retrieval before / alongside the vector scan |
| `documents_documentchunk` | unique `(document_id, chunk_index)` | Idempotent rebuilds |
| `documents_documentpage` | unique `(document_id, page_number)` | Page lookup for the viewer |
| `documents_document` | `(knowledge_base_id, -created_at)`, `(knowledge_base_id, status)` | Listings and readiness checks |
| `workspaces_workspacemember` | unique `(workspace_id, user_id)`, `(user_id, workspace_id)` | Membership checks on every request |
| `conversations_conversation` | `(user_id, workspace_id, -updated_at)` | Chat history |
| `usage_usagerecord` | `(workspace_id, -created_at)`, `(user_id, -created_at)` | Usage dashboards |

## Embedding dimensions

The `embedding` column is created with `EMBEDDING_DIMENSIONS` (768 for nomic-embed-text). To use a model with a different size on an existing database, create a migration that alters the column (and recreates the HNSW index) and reprocess documents. Fresh installs pick the value up automatically.
