import type { ApiErrorBody } from "@/types/api";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API_BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
    public requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First message for a field, for inline form errors. */
  fieldError(field: string): string | undefined {
    const value = this.details?.[field];
    if (Array.isArray(value)) return String(value[0]);
    return typeof value === "string" ? value : undefined;
  }
}

// ---------------------------------------------------------------------------
// Access token: kept in memory only. The refresh token lives in an httpOnly
// cookie set by the API and is never readable from JavaScript.
// ---------------------------------------------------------------------------
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

let refreshInFlight: Promise<string | null> | null = null;

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { access: string };
      accessToken = data.access;
      return data.access;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      return new ApiError(res.status, body.error.code, body.error.message, body.error.details, body.error.request_id);
    }
  } catch {
    // Non-JSON error body (proxy error page etc.)
  }
  const fallback = res.status >= 500 ? "The server ran into a problem. Please try again." : res.statusText;
  return new ApiError(res.status, "http_error", fallback || "Request failed");
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skip the automatic refresh-and-retry on 401. */
  noRetry?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Low-level request returning the raw Response (used for streaming and file downloads). */
export async function apiRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const { body, query, noRetry, headers, ...init } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const send = () =>
    fetch(buildUrl(path, query), {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the RecallAI server. Is the backend running?");
  }
  if (res.status === 401 && !noRetry) {
    const token = await refreshAccessToken();
    if (token) {
      res = await send();
    } else {
      onUnauthorized?.();
    }
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiRaw(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Server-Sent Events over fetch (EventSource cannot POST or send headers).
// ---------------------------------------------------------------------------
export type SSEEvent = { event: string; data: unknown };

export async function* streamSSE(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SSEEvent> {
  const res = await apiRaw(path, { method: "POST", body, signal });
  if (!res.body) throw new ApiError(0, "stream_error", "Streaming is not supported by this browser.");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
    }
  }
  const tail = parseFrame(buffer);
  if (tail) yield tail;
}

export function parseFrame(frame: string): SSEEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return { event, data: data.join("\n") };
  }
}
