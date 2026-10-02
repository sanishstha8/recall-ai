// Types mirroring the RecallAI REST API (see /api/docs/).

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
    request_id: string | null;
  };
};

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar: string | null;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = { access: string; user: User };

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Workspace = {
  id: number;
  name: string;
  slug: string;
  owner: number;
  role: Role;
  member_count: number;
  knowledge_base_count: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: number;
  role: Role;
  joined_at: string;
  user: Pick<User, "id" | "email" | "first_name" | "last_name" | "full_name" | "avatar">;
};

export type KnowledgeBase = {
  id: number;
  workspace: number;
  name: string;
  description: string;
  icon: string;
  document_count: number;
  ready_document_count: number;
  last_activity_at: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type DocumentStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
export type ProcessingStage = "QUEUED" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "DONE";
export type FileType = "pdf" | "txt" | "md" | "docx";

export type DocumentItem = {
  id: number;
  knowledge_base: number;
  knowledge_base_name: string;
  workspace: number;
  uploaded_by: number | null;
  uploaded_by_email: string | null;
  name: string;
  original_filename: string;
  file_type: FileType;
  file_size: number;
  status: DocumentStatus;
  processing_stage: ProcessingStage;
  page_count: number;
  word_count: number;
  chunk_count: number;
  processing_error: string;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

export type DocumentPage = { id: number; page_number: number; content: string };

export type PageSearchResult = { page_number: number; matches: number; snippet: string };

export type SearchResult = {
  chunk_id: number;
  document_id: number;
  document_name: string;
  page_number: number;
  chunk_index: number;
  content: string;
  score: number;
  rerank_score: number | null;
};

export type SearchResponse = {
  query: string;
  embedding_model: string;
  latency_ms: number;
  results: SearchResult[];
};

export type Citation = {
  id: number;
  source_index: number;
  document: number;
  document_name: string;
  knowledge_base: number;
  chunk: number | null;
  page_number: number;
  quoted_content: string;
  relevance_score: number;
  cited: boolean;
};

export type MessageRole = "SYSTEM" | "USER" | "ASSISTANT";

export type Message = {
  id: number;
  role: MessageRole;
  content: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  citations: Citation[];
  created_at: string;
};

export type Conversation = {
  id: number;
  workspace: number;
  knowledge_base: number | null;
  knowledge_base_name: string | null;
  title: string;
  model: string;
  message_count: number;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

export type StreamSource = {
  index: number;
  document_id: number;
  document_name: string;
  page_number: number;
  chunk_id: number;
  score: number;
  excerpt: string;
};

export type StudyKind = "SUMMARY" | "FLASHCARDS" | "QUIZ" | "QUESTIONS" | "MOCK_EXAM";
export type StudyStatus = "PENDING" | "GENERATING" | "READY" | "FAILED";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Flashcard = { id: number; question: string; answer: string };
export type QuizQuestion = {
  id: number;
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  answer?: "A" | "B" | "C" | "D";
  explanation?: string;
};
export type WrittenQuestion = { id: number; question: string; model_answer: string };
export type SummaryContent = {
  title: string;
  short_summary: string;
  detailed_summary: string;
  key_points: string[];
};

export type StudySetContent =
  | SummaryContent
  | { cards: Flashcard[] }
  | { questions: QuizQuestion[] }
  | { short_answer: WrittenQuestion[]; long_answer: WrittenQuestion[] }
  | Record<string, never>;

export type StudySet = {
  id: number;
  workspace: number;
  knowledge_base: number;
  knowledge_base_name: string;
  document: number | null;
  document_name: string | null;
  kind: StudyKind;
  title: string;
  status: StudyStatus;
  difficulty: Difficulty;
  topic: string;
  item_count: number;
  time_limit_minutes: number | null;
  content?: StudySetContent;
  sources: { document_id: number; document_name: string; page_number: number }[];
  model: string;
  error: string;
  attempt_count: number;
  best_score: number | null;
  created_at: string;
  updated_at: string;
};

export type StudyRequest = {
  knowledge_base: number;
  document?: number | null;
  topic?: string;
  title?: string;
  count?: number;
  difficulty?: Difficulty;
  time_limit_minutes?: number | null;
};

export type AttemptResult = {
  question_id: number;
  selected: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
};

export type QuizAttempt = {
  id: number;
  study_set: number;
  answers: Record<string, string>;
  results: AttemptResult[];
  score: number;
  total: number;
  percentage: number;
  duration_seconds: number;
  created_at: string;
};

export type UsageOperation = "CHAT" | "EMBEDDING" | "SUMMARY" | "FLASHCARD" | "QUIZ" | "QUESTIONS" | "MOCK_EXAM";

export type UsageRecord = {
  id: number;
  workspace: number;
  user: number | null;
  user_email: string | null;
  operation: UsageOperation;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: string;
  latency_ms: number;
  success: boolean;
  created_at: string;
};

export type UsageSummary = {
  totals: {
    requests: number;
    failures: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: number;
    avg_latency_ms: number;
  };
  by_operation: { operation: UsageOperation; requests: number; total_tokens: number; avg_latency_ms: number }[];
  by_day: { day: string; requests: number; total_tokens: number }[];
  by_model: { model: string; requests: number; total_tokens: number }[];
};

export type HealthCheck = { ok: boolean; latency_ms: number; detail: unknown };

export type Readiness = {
  status: "ready" | "degraded";
  checks: { database: HealthCheck; broker: HealthCheck; ai: HealthCheck };
};

export type AdminAnalytics = {
  totals: Record<
    | "users"
    | "active_users_7d"
    | "workspaces"
    | "documents"
    | "conversations"
    | "messages"
    | "ai_requests"
    | "ai_failures"
    | "processing_failures",
    number
  >;
  documents_by_status: Partial<Record<DocumentStatus, number>>;
  feature_usage: { operation: UsageOperation; requests: number; total_tokens: number }[];
  recent_failures: { id: number; name: string; workspace: string; error: string; updated_at: string }[];
  recent_users: { id: number; email: string; created_at: string; last_login: string | null }[];
  health: Readiness["checks"];
};
