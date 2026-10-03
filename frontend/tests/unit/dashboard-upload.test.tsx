import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/tests/test-utils";
import type { DocumentItem } from "@/types/api";

const api = vi.hoisted(() => ({
  knowledge: { list: vi.fn() },
  documents: { list: vi.fn(), upload: vi.fn() },
  conversations: { list: vi.fn() },
  usage: { summary: vi.fn() },
  system: { readiness: vi.fn() },
}));

vi.mock("@/lib/api/endpoints", () => ({
  knowledgeApi: api.knowledge,
  documentApi: api.documents,
  conversationApi: api.conversations,
  usageApi: api.usage,
  systemApi: api.system,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => ({ user: { first_name: "Asha", full_name: "Asha Rai" } }),
}));
vi.mock("@/stores/workspace-store", () => ({
  useWorkspace: () => ({ current: { id: 7, name: "Asha's Workspace", role: "OWNER" }, can: () => true }),
}));

const doc: DocumentItem = {
  id: 1,
  knowledge_base: 3,
  knowledge_base_name: "BSc CSIT",
  workspace: 7,
  uploaded_by: 1,
  uploaded_by_email: "a@b.co",
  name: "Advanced Database.pdf",
  original_filename: "Advanced Database.pdf",
  file_type: "pdf",
  file_size: 6800,
  status: "PROCESSING",
  processing_stage: "EMBEDDING",
  page_count: 6,
  word_count: 678,
  chunk_count: 0,
  processing_error: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  processed_at: null,
};

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

describe("Dashboard", () => {
  beforeEach(() => {
    api.knowledge.list.mockResolvedValue(page([{ id: 3 }, { id: 4 }]));
    api.documents.list.mockResolvedValue(page([doc]));
    api.conversations.list.mockResolvedValue(page([]));
    api.usage.summary.mockResolvedValue({ totals: { requests: 12, total_tokens: 3400 } });
    api.system.readiness.mockResolvedValue({
      status: "ready",
      checks: {
        ai: { ok: true, latency_ms: 3, detail: { chat_model: "llama3.2:3b", embedding_model: "nomic-embed-text" } },
        database: { ok: true, latency_ms: 1, detail: "pgvector 0.8.0" },
        broker: { ok: true, latency_ms: 1, detail: "redis reachable" },
      },
    });
  });

  it("shows stats, recent documents with processing state, and AI status", async () => {
    const { default: DashboardPage } = await import("@/app/dashboard/page");
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole("heading", { name: /Asha/ })).toBeInTheDocument();
    expect(await screen.findByText("Advanced Database.pdf")).toBeInTheDocument();
    expect(screen.getByText("Indexing…")).toBeInTheDocument();
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    expect(await screen.findByText("llama3.2:3b · nomic-embed-text")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(api.documents.list).toHaveBeenCalledWith({ workspace: 7, page_size: 6 });
  });
});

describe("Upload dropzone", () => {
  it("rejects unsupported files client-side and uploads valid ones", async () => {
    api.documents.upload = vi.fn().mockResolvedValue(doc);
    const { UploadDropzone } = await import("@/components/documents/upload-dropzone");
    renderWithProviders(<UploadDropzone knowledgeBaseId={3} />);
    const input = screen.getByTestId("upload-input") as HTMLInputElement;

    await userEvent.upload(input, new File(["MZ"], "virus.exe"), { applyAccept: false });
    expect(await screen.findByText("Unsupported file type")).toBeInTheDocument();
    expect(api.documents.upload).not.toHaveBeenCalled();

    const pdf = new File(["%PDF-1.4"], "notes.pdf", { type: "application/pdf" });
    await userEvent.upload(input, pdf);
    await waitFor(() => expect(api.documents.upload).toHaveBeenCalledWith(3, pdf));
    expect(await screen.findByText("Uploaded — processing")).toBeInTheDocument();
  });

  it("shows the server's validation message for a rejected upload", async () => {
    api.documents.upload = vi.fn(async () => {
      throw new Error("The file content does not match a valid .pdf file.");
    });
    const { UploadDropzone } = await import("@/components/documents/upload-dropzone");
    renderWithProviders(<UploadDropzone knowledgeBaseId={3} />);
    await userEvent.upload(screen.getByTestId("upload-input"), new File(["<html>"], "fake.pdf"));
    expect(await screen.findByText("The file content does not match a valid .pdf file.")).toBeInTheDocument();
  });
});
