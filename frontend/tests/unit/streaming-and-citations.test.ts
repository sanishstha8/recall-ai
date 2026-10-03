import { afterEach, describe, expect, it, vi } from "vitest";

import { linkCitations } from "@/components/chat/markdown";
import { parseFrame, setAccessToken, streamSSE } from "@/lib/api/client";
import { paragraphsMatchingQuote, splitByQuery } from "@/lib/utils/highlight";

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("SSE parsing", () => {
  it("parses event frames with JSON data", () => {
    expect(parseFrame('event: token\ndata: {"delta": "Hi"}')).toEqual({ event: "token", data: { delta: "Hi" } });
    expect(parseFrame("event: ping")).toBeNull();
  });

  it("reassembles frames split across network chunks and sends the bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'event: start\ndata: {"user_message": {"id": 1}}\n\nevent: tok',
          'en\ndata: {"delta": "Normal"}\n\n',
          'event: token\ndata: {"delta": "ization"}\n\nevent: done\ndata: {"message": {"id": 2}}\n\n',
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("abc");

    const events = [];
    for await (const e of streamSSE("/conversations/1/stream/", { content: "q" })) events.push(e);

    expect(events.map((e) => e.event)).toEqual(["start", "token", "token", "done"]);
    expect(
      events
        .filter((e) => e.event === "token")
        .map((e) => (e.data as { delta: string }).delta)
        .join(""),
    ).toBe("Normalization");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/conversations/1/stream/");
    expect(init.headers.Authorization).toBe("Bearer abc");
    expect(init.credentials).toBe("include");
  });

  it("refreshes the access token once on 401 and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "token_not_valid", message: "x" } }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: "fresh" }), { status: 200 }))
      .mockResolvedValueOnce(sseResponse(['event: done\ndata: {"message": {"id": 3}}\n\n']));
    vi.stubGlobal("fetch", fetchMock);

    const events = [];
    for await (const e of streamSSE("/conversations/1/stream/", { content: "q" })) events.push(e);
    expect(events).toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh/");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh");
  });
});

describe("citations", () => {
  it("links only valid source numbers and never touches code blocks", () => {
    const md = "1NF is atomic [1]. See [2, 3]. Bogus [9].\n\n```\narr[1]\n```";
    const out = linkCitations(md, new Set([1, 2, 3]));
    expect(out).toContain("[1](#cite-1)");
    expect(out).toContain("[2](#cite-2)[3](#cite-3)");
    expect(out).toContain("Bogus [9]");
    expect(out).toContain("arr[1]");
  });
});

describe("highlighting", () => {
  it("finds paragraphs belonging to a quoted chunk despite whitespace differences", () => {
    const paragraphs = [
      "Unit 3: Normalization",
      "First normal form requires   atomic values\nand no repeating groups.",
      "Other text",
    ];
    const quote = "First normal form requires atomic values and no repeating groups.";
    expect([...paragraphsMatchingQuote(paragraphs, quote)]).toEqual([1]);
  });

  it("splits text by a case-insensitive query safely", () => {
    expect(splitByQuery("B+ tree and b+ TREE", "b+ tree")).toEqual([
      { text: "B+ tree", match: true },
      { text: " and ", match: false },
      { text: "b+ TREE", match: true },
    ]);
  });
});
