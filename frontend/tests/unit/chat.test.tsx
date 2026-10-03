import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantMessage, citationsToSources } from "@/components/chat/message";
import { qk } from "@/lib/api/query-keys";
import { Providers, makeClient, renderWithProviders } from "@/tests/test-utils";
import type { Citation, Message } from "@/types/api";

const stream = vi.hoisted(() => ({ events: [] as { event: string; data: unknown }[] }));

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  streamSSE: async function* () {
    for (const e of stream.events) yield e;
  },
}));

const citation = (n: number, page: number, cited = true): Citation => ({
  id: n,
  source_index: n,
  document: 9,
  document_name: "Advanced Database.pdf",
  knowledge_base: 3,
  chunk: n,
  page_number: page,
  quoted_content: `Quoted passage ${n}`,
  relevance_score: 0.8,
  cited,
});

describe("Assistant message", () => {
  it("renders inline citation chips that open the cited page", () => {
    renderWithProviders(
      <AssistantMessage
        content={"3NF removes transitive dependencies [2]. 1NF needs atomic values [1]."}
        sources={citationsToSources([citation(1, 2), citation(2, 4), citation(3, 5, false)])}
      />,
    );
    const chips = screen.getAllByTestId("citation-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["2", "1"]);
    expect(chips[0]).toHaveAttribute("href", expect.stringContaining("/dashboard/documents/9?page=4&hl=Quoted"));
    // Cited sources are listed; the uncited one is collapsed behind a toggle.
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getAllByTestId("source-card")).toHaveLength(2);
    expect(screen.getByText(/1 more retrieved passage not cited/)).toBeInTheDocument();
  });

  it("does not render raw HTML from model output", () => {
    const { container } = renderWithProviders(
      <AssistantMessage content={'<img src=x onerror="alert(1)"> **bold**'} sources={[]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("bold");
  });
});

describe("useChatStream", () => {
  it("streams tokens, then appends the stored messages to the cache", async () => {
    const { useChatStream } = await import("@/hooks/use-chat-stream");
    const user: Message = {
      id: 1,
      role: "USER",
      content: "What is 3NF?",
      model: "",
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      citations: [],
      created_at: "",
    };
    const answer: Message = {
      ...user,
      id: 2,
      role: "ASSISTANT",
      content: "3NF removes transitive dependencies [1].",
      citations: [citation(1, 4)],
    };
    stream.events = [
      { event: "start", data: { user_message: user } },
      {
        event: "sources",
        data: [
          {
            index: 1,
            document_id: 9,
            document_name: "Advanced Database.pdf",
            page_number: 4,
            chunk_id: 1,
            score: 0.8,
            excerpt: "...",
          },
        ],
      },
      { event: "token", data: { delta: "3NF removes" } },
      { event: "token", data: { delta: " transitive dependencies [1]." } },
      { event: "done", data: { message: answer } },
    ];
    const client = makeClient();
    client.setQueryData(qk.messages(5), []);
    const { result } = renderHook(() => useChatStream(5), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    });

    await act(() => result.current.send("What is 3NF?"));
    await waitFor(() => expect(result.current.state.status).toBe("idle"));
    expect(client.getQueryData<Message[]>(qk.messages(5))?.map((m) => m.id)).toEqual([1, 2]);
  });

  it("surfaces generation errors without losing the question", async () => {
    const { useChatStream } = await import("@/hooks/use-chat-stream");
    stream.events = [
      { event: "start", data: { user_message: { id: 1, role: "USER", content: "q", citations: [] } } },
      { event: "error", data: { code: "ai_error", message: "Cannot reach Ollama at http://ollama:11434." } },
    ];
    const client = makeClient();
    const { result } = renderHook(() => useChatStream(6), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    });
    await act(() => result.current.send("q"));
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toContain("Cannot reach Ollama");
    expect(client.getQueryData<Message[]>(qk.messages(6))).toHaveLength(1);
  });
});
