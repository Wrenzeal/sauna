import type {
  ApiAgent,
  AuthIdentity,
  AuthStartResult,
  AuthVerifyResult,
  CreateProviderConfigInput,
  CreateDistillationJobInput,
  DiscoverModelsInput,
  FetchedModel,
  DistillationJob,
  FocusSession,
  FocusSessionSummary,
  ConsultationStarted,
  Message,
  ProviderConfig,
  ProviderTestChatResult,
  StreamEventShape,
  TurnCreated,
  UpdateProviderConfigInput,
} from "@/types/sauna";

const LOCAL_API_BASE_URL = "/api/sauna";
const PRODUCTION_API_BASE_URL = "https://api.sauna.wrenzeal.top/api/v1";
const DEFAULT_API_BASE_URL = process.env.NODE_ENV === "production" ? PRODUCTION_API_BASE_URL : LOCAL_API_BASE_URL;

export function getSaunaApiBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_SAUNA_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
  if (configured === DEFAULT_API_BASE_URL || configured.endsWith("/api/v1")) {
    return configured;
  }
  try {
    const url = new URL(configured);
    if (url.pathname === "" || url.pathname === "/") {
      return `${configured}/api/v1`;
    }
  } catch {
    // Relative custom paths are assumed to already point at the API root.
  }
  return configured;
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

export class SaunaApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SaunaApiError";
    this.status = status;
    this.code = code;
  }
}

function apiUrl(path: string) {
  const base = getSaunaApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response) {
  let payload: ErrorPayload = {};
  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    payload = {};
  }
  return new SaunaApiError(
    response.status,
    payload.error ?? "request_failed",
    payload.message ?? `Sauna API request failed with ${response.status}`,
  );
}

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  for (const [key, value] of Object.entries(authHeaders(token))) {
    headers.set(key, value);
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

interface SSEFrame {
  event?: string;
  id?: string;
  data: string;
}

function parseSSEFrame(raw: string): SSEFrame | null {
  const frame: SSEFrame = { data: "" };
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") {
      frame.event = value;
    } else if (field === "id") {
      frame.id = value;
    } else if (field === "data") {
      frame.data += frame.data ? `\n${value}` : value;
    }
  }
  return frame.data ? frame : null;
}

function nextSSEBoundary(buffer: string) {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1) {
    return crlf === -1 ? null : { index: crlf, length: 4 };
  }
  if (crlf === -1) {
    return { index: lf, length: 2 };
  }
  return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 };
}

function normalizeStreamEvent(frame: SSEFrame): StreamEventShape {
  const payload = JSON.parse(frame.data) as Partial<StreamEventShape>;
  const eventType = frame.event ?? payload.event_type ?? "assistant.delta";
  return {
    event_id: payload.event_id ?? frame.id ?? "",
    sequence: payload.sequence ?? 0,
    turn_id: payload.turn_id ?? "",
    session_id: payload.session_id ?? "",
    message_id: payload.message_id ?? "",
    timestamp: payload.timestamp ?? new Date().toISOString(),
    event_type: eventType as StreamEventShape["event_type"],
    delta: payload.delta,
    error: payload.error,
    usage: payload.usage,
    interaction_id: payload.interaction_id,
    agent_id: payload.agent_id,
  };
}

export interface StreamTurnOptions {
  token: string;
  signal?: AbortSignal;
  onEvent: (event: StreamEventShape) => void;
}

export function createSaunaApiClient(token?: string) {
  return {
    startEmail(email: string) {
      return requestJson<AuthStartResult>(
        "/auth/email/start",
        { method: "POST", body: JSON.stringify({ email }) },
      );
    },
    verifyEmail(email: string, code: string) {
      return requestJson<AuthVerifyResult>(
        "/auth/email/verify",
        { method: "POST", body: JSON.stringify({ email, code }) },
      );
    },
    logout() {
      return requestJson<{ ok: boolean }>("/auth/logout", { method: "POST" }, token);
    },
    me() {
      return requestJson<{ identity: AuthIdentity }>("/me", {}, token);
    },
    listPublicAgents() {
      return requestJson<{ agents: ApiAgent[] }>("/public/agents");
    },
    listWorkspaceAgents() {
      return requestJson<{ agents: ApiAgent[] }>("/agents", {}, token);
    },
    listProviderConfigs() {
      return requestJson<{ provider_configs: ProviderConfig[] }>("/provider-configs", {}, token);
    },
    createProviderConfig(input: CreateProviderConfigInput) {
      return requestJson<ProviderConfig>(
        "/provider-configs",
        { method: "POST", body: JSON.stringify(input) },
        token,
      );
    },
    updateProviderConfig(id: string, input: UpdateProviderConfigInput) {
      return requestJson<ProviderConfig>(
        `/provider-configs/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        token,
      );
    },
    deleteProviderConfig(id: string) {
      return requestJson<ProviderConfig>(`/provider-configs/${id}`, { method: "DELETE" }, token);
    },
    setDefaultProviderConfig(id: string) {
      return requestJson<ProviderConfig>(`/provider-configs/${id}/set-default`, { method: "POST" }, token);
    },
    listProviderModels(id: string) {
      return requestJson<{ models: FetchedModel[] }>(`/provider-configs/${id}/models`, {}, token);
    },
    discoverProviderModels(input: DiscoverModelsInput) {
      return requestJson<{ models: FetchedModel[] }>(
        "/provider-configs/discover-models",
        { method: "POST", body: JSON.stringify(input) },
        token,
      );
    },
    testProviderChat(id: string) {
      return requestJson<ProviderTestChatResult>(`/provider-configs/${id}/test-chat`, { method: "POST" }, token);
    },
    listFocusSessions() {
      return requestJson<{ sessions: FocusSessionSummary[] }>("/focus-room/sessions", {}, token);
    },
    listDistillationJobs() {
      return requestJson<{ jobs: DistillationJob[] }>("/studio/jobs", {}, token);
    },
    createDistillationJob(input: CreateDistillationJobInput) {
      return requestJson<DistillationJob>(
        "/studio/jobs",
        { method: "POST", body: JSON.stringify(input) },
        token,
      );
    },
    getDistillationJob(id: string) {
      return requestJson<DistillationJob>(`/studio/jobs/${id}`, {}, token);
    },
    createPublicAgentSession(agentId: string, title?: string) {
      const body = title?.trim() ? JSON.stringify({ title: title.trim() }) : undefined;
      return requestJson<FocusSession>(
        `/lobby/public-agents/${agentId}/sessions`,
        { method: "POST", body },
        token,
      );
    },
    startConsultation(input: { agent_id: string; content: string; title?: string; provider_config_id?: string }) {
      return requestJson<ConsultationStarted>(
        "/focus-room/consultations",
        { method: "POST", body: JSON.stringify(input) },
        token,
      );
    },
    createTurn(sessionId: string, content: string) {
      return requestJson<TurnCreated>(
        `/focus-room/sessions/${sessionId}/turns`,
        { method: "POST", body: JSON.stringify({ content }) },
        token,
      );
    },
    renameFocusSession(sessionId: string, title: string) {
      return requestJson<FocusSession>(
        `/focus-room/sessions/${sessionId}`,
        { method: "PATCH", body: JSON.stringify({ title }) },
        token,
      );
    },
    deleteFocusSession(sessionId: string) {
      return requestJson<void>(`/focus-room/sessions/${sessionId}`, { method: "DELETE" }, token);
    },
    listMessages(sessionId: string) {
      return requestJson<{ messages: Message[] }>(`/focus-room/sessions/${sessionId}/messages`, {}, token);
    },
  };
}

export async function streamTurn(sessionId: string, turnId: string, options: StreamTurnOptions) {
  const headers = new Headers({ Accept: "text/event-stream", Authorization: `Bearer ${options.token}` });
  const response = await fetch(apiUrl(`/focus-room/sessions/${sessionId}/turns/${turnId}/stream`), {
    method: "GET",
    headers,
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw await parseError(response);
  }
  if (!response.body) {
    throw new SaunaApiError(502, "stream_unavailable", "Sauna API stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = nextSSEBoundary(buffer);
      while (boundary) {
        const raw = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const frame = parseSSEFrame(raw);
        if (frame) {
          options.onEvent(normalizeStreamEvent(frame));
        }
        boundary = nextSSEBoundary(buffer);
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const frame = parseSSEFrame(tail);
      if (frame) {
        options.onEvent(normalizeStreamEvent(frame));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function humanizeApiError(error: unknown) {
  if (error instanceof SaunaApiError) {
    if (error.code === "provider_config_required") {
      return "先接入你的模型 provider 和 key。";
    }
    if (error.code === "unauthorized") {
      return "登录已过期，请重新登录。";
    }
    if (error.code === "api_unreachable") {
      return "Sauna API 暂时不可用。";
    }
    if (error.code === "invalid_input") {
      return "配置不完整，请检查 Base URL、Key 和模型名。";
    }
    if (error.code === "not_found") {
      return "配置不存在或已删除。";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试。";
}
