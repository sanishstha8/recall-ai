import { api, apiRaw, setAccessToken } from "@/lib/api/client";
import type {
  AdminAnalytics,
  AuthResponse,
  Conversation,
  DocumentItem,
  DocumentPage,
  DocumentStatus,
  KnowledgeBase,
  Message,
  PageSearchResult,
  Paginated,
  QuizAttempt,
  Readiness,
  Role,
  SearchResponse,
  StudyKind,
  StudyRequest,
  StudySet,
  UsageRecord,
  UsageSummary,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types/api";

// --- Auth ---------------------------------------------------------------------
export const authApi = {
  async login(email: string, password: string) {
    const res = await api<AuthResponse>("/auth/login/", { method: "POST", body: { email, password }, noRetry: true });
    setAccessToken(res.access);
    return res.user;
  },
  async register(body: { email: string; password: string; first_name?: string; last_name?: string }) {
    const res = await api<AuthResponse>("/auth/register/", { method: "POST", body, noRetry: true });
    setAccessToken(res.access);
    return res.user;
  },
  async logout() {
    try {
      await api<void>("/auth/logout/", { method: "POST", body: {}, noRetry: true });
    } finally {
      setAccessToken(null);
    }
  },
  me: () => api<User>("/auth/me/"),
  updateMe: (body: FormData | Partial<Pick<User, "first_name" | "last_name">>) =>
    api<User>("/auth/me/", { method: "PATCH", body }),
  changePassword: (current_password: string, new_password: string) =>
    api<void>("/auth/password/change/", { method: "POST", body: { current_password, new_password } }),
  requestPasswordReset: (email: string) =>
    api<{ detail: string }>("/auth/password-reset/", { method: "POST", body: { email }, noRetry: true }),
  confirmPasswordReset: (body: { uid: string; token: string; new_password: string }) =>
    api<void>("/auth/password-reset/confirm/", { method: "POST", body, noRetry: true }),
};

// --- Workspaces -------------------------------------------------------------------
export const workspaceApi = {
  list: () => api<Paginated<Workspace>>("/workspaces/", { query: { page_size: 100 } }),
  create: (name: string) => api<Workspace>("/workspaces/", { method: "POST", body: { name } }),
  update: (id: number, name: string) => api<Workspace>(`/workspaces/${id}/`, { method: "PATCH", body: { name } }),
  remove: (id: number) => api<void>(`/workspaces/${id}/`, { method: "DELETE" }),
  members: (id: number) => api<Paginated<WorkspaceMember>>(`/workspaces/${id}/members/`, { query: { page_size: 100 } }),
  addMember: (id: number, email: string, role: Role) =>
    api<WorkspaceMember>(`/workspaces/${id}/members/`, { method: "POST", body: { email, role } }),
  updateMember: (id: number, memberId: number, role: Role) =>
    api<WorkspaceMember>(`/workspaces/${id}/members/${memberId}/`, { method: "PATCH", body: { role } }),
  removeMember: (id: number, memberId: number) =>
    api<void>(`/workspaces/${id}/members/${memberId}/`, { method: "DELETE" }),
};

// --- Knowledge bases -----------------------------------------------------------------
export type KnowledgeBaseInput = { workspace: number; name: string; description?: string; icon?: string };

export const knowledgeApi = {
  list: (params: { workspace?: number; search?: string; page_size?: number }) =>
    api<Paginated<KnowledgeBase>>("/knowledge-bases/", { query: { page_size: 100, ...params } }),
  get: (id: number) => api<KnowledgeBase>(`/knowledge-bases/${id}/`),
  create: (body: KnowledgeBaseInput) => api<KnowledgeBase>("/knowledge-bases/", { method: "POST", body }),
  update: (id: number, body: Partial<Omit<KnowledgeBaseInput, "workspace">>) =>
    api<KnowledgeBase>(`/knowledge-bases/${id}/`, { method: "PATCH", body }),
  remove: (id: number) => api<void>(`/knowledge-bases/${id}/`, { method: "DELETE" }),
  search: (id: number, query: string, top_k = 10) =>
    api<SearchResponse>(`/knowledge-bases/${id}/search/`, { method: "POST", body: { query, top_k } }),
};

// --- Documents ------------------------------------------------------------------------
export const documentApi = {
  listForKnowledgeBase: (kbId: number, params: { status?: DocumentStatus; search?: string } = {}) =>
    api<Paginated<DocumentItem>>(`/knowledge-bases/${kbId}/documents/`, { query: { page_size: 100, ...params } }),
  list: (params: { workspace?: number; knowledge_base?: number; page_size?: number; status?: DocumentStatus }) =>
    api<Paginated<DocumentItem>>("/documents/", { query: params }),
  get: (id: number) => api<DocumentItem>(`/documents/${id}/`),
  upload: (kbId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<DocumentItem>(`/knowledge-bases/${kbId}/documents/`, { method: "POST", body: form });
  },
  remove: (id: number) => api<void>(`/documents/${id}/`, { method: "DELETE" }),
  reprocess: (id: number) => api<DocumentItem>(`/documents/${id}/reprocess/`, { method: "POST" }),
  page: (id: number, pageNumber: number) =>
    api<DocumentPage>(`/documents/${id}/pages/`, { query: { page_number: pageNumber } }),
  searchText: (id: number, q: string) => api<PageSearchResult[]>(`/documents/${id}/search-text/`, { query: { q } }),
  /** Fetch the original file as a Blob (authenticated). */
  file: async (id: number) => (await apiRaw(`/documents/${id}/file/`)).blob(),
};

// --- Conversations ----------------------------------------------------------------------
export const conversationApi = {
  list: (params: { workspace?: number; knowledge_base?: number; search?: string; page_size?: number }) =>
    api<Paginated<Conversation>>("/conversations/", { query: { page_size: 50, ...params } }),
  get: (id: number) => api<Conversation>(`/conversations/${id}/`),
  create: (body: { workspace: number; knowledge_base?: number | null; title?: string }) =>
    api<Conversation>("/conversations/", { method: "POST", body }),
  update: (id: number, body: { title?: string; knowledge_base?: number | null }) =>
    api<Conversation>(`/conversations/${id}/`, { method: "PATCH", body }),
  remove: (id: number) => api<void>(`/conversations/${id}/`, { method: "DELETE" }),
  messages: (id: number) => api<Message[]>(`/conversations/${id}/messages/`),
};

// --- Study --------------------------------------------------------------------------------
export const STUDY_ENDPOINT: Record<StudyKind, string> = {
  SUMMARY: "summary",
  FLASHCARDS: "flashcards",
  QUIZ: "quiz",
  QUESTIONS: "questions",
  MOCK_EXAM: "mock-exam",
};

export const studyApi = {
  generate: (kind: StudyKind, body: StudyRequest) =>
    api<StudySet>(`/study/${STUDY_ENDPOINT[kind]}/`, { method: "POST", body }),
  list: (params: { workspace?: number; kind?: StudyKind; knowledge_base?: number; page_size?: number }) =>
    api<Paginated<StudySet>>("/study/sets/", { query: { page_size: 50, ...params } }),
  get: (id: number) => api<StudySet>(`/study/sets/${id}/`),
  rename: (id: number, title: string) => api<StudySet>(`/study/sets/${id}/`, { method: "PATCH", body: { title } }),
  remove: (id: number) => api<void>(`/study/sets/${id}/`, { method: "DELETE" }),
  regenerate: (id: number) => api<StudySet>(`/study/sets/${id}/regenerate/`, { method: "POST" }),
  attempts: (id: number) => api<QuizAttempt[]>(`/study/sets/${id}/attempts/`),
  submitAttempt: (id: number, answers: Record<string, string>, duration_seconds: number) =>
    api<QuizAttempt>(`/study/sets/${id}/attempts/`, { method: "POST", body: { answers, duration_seconds } }),
};

// --- Usage / health / admin ---------------------------------------------------------------
export type UsageParams = { workspace?: number; scope?: "me" | "workspace"; days?: number; operation?: string };

export const usageApi = {
  summary: (params: UsageParams) => api<UsageSummary>("/usage/summary/", { query: params }),
  list: (params: UsageParams & { page?: number }) => api<Paginated<UsageRecord>>("/usage/", { query: params }),
};

export const systemApi = {
  readiness: async (): Promise<Readiness> => {
    // 503 still carries a useful body, so read it instead of throwing.
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/health/ready/`);
    return (await res.json()) as Readiness;
  },
  adminAnalytics: () => api<AdminAnalytics>("/admin/analytics/"),
};
