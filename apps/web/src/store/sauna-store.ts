"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SaunaApiError, classifySaunaApiError, createSaunaApiClient, humanizeApiError, streamTurn } from "@/lib/sauna-api";
import { migrateSaunaPersistedState } from "@/lib/access-policy";
import type { AuthOperation, InitialConsultationDraft } from "@/lib/access-policy";
import type {
  AgentProfile,
  AgentStatus,
  ApiAgent,
  AuthIdentity,
  AuthStartResult,
  CreateProviderConfigInput,
  CreateDistillationJobInput,
  DiscoverModelsInput,
  FetchedModel,
  DistillationJob,
  FocusSession,
  FocusSessionSummary,
  Message,
  ProviderConfig,
  ProviderTestChatResult,
  SessionSummary,
  StreamEventShape,
  UpdateProviderConfigInput,
} from "@/types/sauna";

type LoadStatus = "idle" | "loading" | "ready" | "error";
type ActionStatus = "idle" | "loading" | "streaming" | "ready" | "error";

const accents = ["emerald", "cyan", "amber", "rose"];

const consultationDraftStoragePrefix = "sauna:consultation-draft:";

function writeConsultationDraft(key: string, draft: InitialConsultationDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${consultationDraftStoragePrefix}${key}`, JSON.stringify(draft));
}

function readConsultationDraft(key: string): InitialConsultationDraft | undefined {
  if (typeof window === "undefined") return undefined;
  const storageKey = `${consultationDraftStoragePrefix}${key}`;
  const raw = window.sessionStorage.getItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<InitialConsultationDraft>;
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
    return content ? { content, autoSend: parsed.autoSend === true } : undefined;
  } catch {
    return undefined;
  }
}


const statusMap: Record<string, AgentStatus> = {
  idle: "idle",
  thinking: "thinking",
  in_conversation: "in_conversation",
  offline: "offline",
};

const publicAgentQuotes: Record<string, string> = {
  "steve-jobs": "少做一点，把体验做到不可替代。",
  "elon-musk": "先拆到物理层，再重组系统。",
  munger: "反过来想，用多元模型过滤错误。",
  feynman: "先解释清楚，再确认自己真的懂。",
  naval: "寻找杠杆，减少欲望合同。",
  "paul-graham": "从小而真实的问题开始。",
};

function quoteForAgent(agent: ApiAgent) {
  return publicAgentQuotes[agent.slug] ?? `用${agent.role_summary}拆解你的关键问题。`;
}

function mapAgent(agent: ApiAgent, index: number): AgentProfile {
  return {
    id: agent.id,
    displayName: agent.display_name,
    role: agent.role_summary,
    quote: quoteForAgent(agent),
    avatarSeed: agent.avatar_emoji || "🧠",
    accent: accents[index % accents.length] ?? "emerald",
    status: statusMap[agent.status] ?? "idle",
    lastActivity: agent.is_public_template ? "默认智囊" : "已蒸馏",
    sourceKind: agent.is_public_template ? "public" : "private",
  };
}

function sessionToSummary(session: FocusSession, agent?: AgentProfile): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    sessionType: session.session_type,
    currentStatus: session.current_status as SessionSummary["currentStatus"],
    agentIds: [session.agent_id],
    agentDisplayName: agent?.displayName,
    agentAvatarEmoji: agent?.avatarSeed,
    lastActivityAt: session.updated_at,
  };
}

function apiSessionToSummary(session: FocusSessionSummary): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    sessionType: session.session_type,
    currentStatus: session.current_status as SessionSummary["currentStatus"],
    agentIds: [session.agent_id],
    agentDisplayName: session.agent_display_name,
    agentAvatarEmoji: session.agent_avatar_emoji,
    lastMessagePreview: session.last_message_preview,
    lastActivityAt: session.last_activity_at,
  };
}

function upsertMessage(messages: Message[], next: Message) {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index === -1) {
    return [...messages, next];
  }
  const copy = [...messages];
  copy[index] = next;
  return copy;
}

function appendDelta(messages: Message[], event: StreamEventShape, workspaceID: string) {
  const messageID = event.message_id || `assistant-${event.turn_id}`;
  const index = messages.findIndex((message) => message.id === messageID);
  if (index === -1) {
    return [
      ...messages,
      {
        id: messageID,
        workspace_id: workspaceID,
        session_id: event.session_id,
        turn_id: event.turn_id,
        agent_id: event.agent_id,
        role: "assistant" as const,
        content: event.delta ?? "",
        status: event.event_type === "turn.failed" ? "failed" as const : "partial" as const,
        created_at: event.timestamp,
      },
    ];
  }
  const copy = [...messages];
  const current = copy[index];
  copy[index] = {
    ...current,
    content: current.content + (event.delta ?? ""),
    status: event.event_type === "turn.failed" ? "failed" : "partial",
  };
  return copy;
}

interface SaunaState {
  agents: AgentProfile[];
  sessions: SessionSummary[];
  streamEvents: StreamEventShape[];
  initialPromptsBySession: Record<string, InitialConsultationDraft>;
  turnsInFlightBySession: Record<string, boolean>;
  selectedAgentId: string;
  token?: string;
  identity?: AuthIdentity;
  providers: ProviderConfig[];
  distillationJobs: DistillationJob[];
  activeSession?: FocusSession;
  messagesBySession: Record<string, Message[]>;
  devCode?: string;
  authCodeSentEmail?: string;
  authResendAvailableAt?: number;
  authOperation: AuthOperation;
  apiStatus: LoadStatus;
  authStatus: ActionStatus;
  providerStatus: ActionStatus;
  distillationStatus: ActionStatus;
  sessionStatus: ActionStatus;
  streamStatus: ActionStatus;
  apiError?: string;
  authError?: string;
  authErrorCode?: string;
  providerError?: string;
  distillationError?: string;
  focusError?: string;
  setSelectedAgentId: (agentId: string) => void;
  clearFocusError: () => void;
  clearAuthError: () => void;
  loadPublicAgents: () => Promise<void>;
  loadWorkspaceAgents: (tokenOverride?: string) => Promise<void>;
  loadIdentity: () => Promise<void>;
  startEmail: (email: string) => Promise<AuthStartResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resetEmailChallenge: () => void;
  completeAuthSuccess: () => void;
  logout: () => Promise<void>;
  invalidateSession: () => void;
  loadProviders: (tokenOverride?: string) => Promise<void>;
  createProvider: (input: CreateProviderConfigInput) => Promise<ProviderConfig>;
  updateProvider: (id: string, input: UpdateProviderConfigInput) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  fetchProviderModels: (id: string) => Promise<FetchedModel[]>;
  discoverProviderModels: (input: DiscoverModelsInput) => Promise<FetchedModel[]>;
  testProviderChat: (id: string) => Promise<ProviderTestChatResult>;
  loadDistillationJobs: (tokenOverride?: string) => Promise<void>;
  createDistillationJob: (input: CreateDistillationJobInput) => Promise<DistillationJob>;
  loadFocusSessions: (tokenOverride?: string) => Promise<void>;
  openAgentSession: (agentId: string, title?: string) => Promise<FocusSession>;
  startConsultation: (agentId: string, content: string, title?: string) => Promise<FocusSession>;
  queueInitialPrompt: (key: string, draft: InitialConsultationDraft) => void;
  consumeInitialPrompt: (key: string, fallbackPrompt?: string) => InitialConsultationDraft;
  resumeSession: (sessionId: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  renameFocusSession: (sessionId: string, title: string) => Promise<void>;
  deleteFocusSession: (sessionId: string) => Promise<void>;
  sendTurn: (sessionId: string, content: string) => Promise<void>;
  retryTurn: (sessionId: string, turnId: string) => Promise<void>;
}

export const useSaunaStore = create<SaunaState>()(
  persist(
    (set, get) => ({
      agents: [],
      sessions: [],
      streamEvents: [],
      initialPromptsBySession: {},
      turnsInFlightBySession: {},
      selectedAgentId: "",
      providers: [],
      distillationJobs: [],
      messagesBySession: {},
      apiStatus: "idle",
      authStatus: "idle",
      authOperation: "idle",
      providerStatus: "idle",
      distillationStatus: "idle",
      sessionStatus: "idle",
      streamStatus: "idle",
      setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
      clearFocusError: () => set({ focusError: undefined }),
      clearAuthError: () => set({ authError: undefined, authErrorCode: undefined }),
      loadPublicAgents: async () => {
        set({ apiStatus: "loading", apiError: undefined });
        try {
          const { agents } = await createSaunaApiClient().listPublicAgents();
          const mappedAgents = (agents ?? []).map(mapAgent);
          const privateAgents = (get().agents ?? []).filter((agent) => agent.sourceKind === "private");
          const combined = [...mappedAgents, ...privateAgents];
          set({
            agents: combined,
            selectedAgentId: combined.some((agent) => agent.id === get().selectedAgentId)
              ? get().selectedAgentId
              : combined[0]?.id ?? "",
            apiStatus: "ready",
          });
          if (get().token) {
            void get().loadWorkspaceAgents();
          }
        } catch (error) {
          set({ agents: [], selectedAgentId: "", apiStatus: "error", apiError: humanizeApiError(error) });
        }
      },
      loadWorkspaceAgents: async (tokenOverride) => {
        const token = tokenOverride ?? get().token;
        if (!token) {
          return;
        }
        try {
          const { agents } = await createSaunaApiClient(token).listWorkspaceAgents();
          const publicAgents = (get().agents ?? []).filter((agent) => agent.sourceKind === "public");
          const mappedPrivate = (agents ?? []).map((agent, index) => mapAgent(agent, publicAgents.length + index));
          const combined = [...publicAgents, ...mappedPrivate];
          set({
            agents: combined,
            selectedAgentId: combined.some((agent) => agent.id === get().selectedAgentId)
              ? get().selectedAgentId
              : combined[0]?.id ?? "",
          });
        } catch (error) {
          if (classifySaunaApiError(error) === "unauthorized") throw error;
          // Public agents remain usable if private agent loading fails.
        }
      },
      loadIdentity: async () => {
        const { token } = get();
        if (!token) {
          return;
        }
        set({ authStatus: "loading", authError: undefined });
        try {
          const { identity } = await createSaunaApiClient(token).me();
          set({ identity, authStatus: "ready" });
          await get().loadProviders(token);
          await get().loadWorkspaceAgents(token);
          await get().loadDistillationJobs(token);
          await get().loadFocusSessions(token);
        } catch (error) {
          if (classifySaunaApiError(error) === "unauthorized") {
            set({ token: undefined, identity: undefined, providers: [], distillationJobs: [], activeSession: undefined, messagesBySession: {}, sessions: [], authCodeSentEmail: undefined, authResendAvailableAt: undefined, devCode: undefined, authStatus: "error", authOperation: "idle", authError: humanizeApiError(error), authErrorCode: "unauthorized", agents: (get().agents ?? []).filter((agent) => agent.sourceKind === "public"), selectedAgentId: "" });
            throw error;
          }
          set({ authStatus: "error", authError: humanizeApiError(error) });
        }
      },
      startEmail: async (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        set({ authStatus: "loading", authOperation: "sending_code", authError: undefined, authErrorCode: undefined, devCode: undefined });
        try {
          const result = await createSaunaApiClient().startEmail(normalizedEmail);
          set({
            authStatus: "ready",
            authOperation: "idle",
            devCode: result.dev_code,
            authCodeSentEmail: result.email,
            authResendAvailableAt: Date.now() + result.resend_after_seconds * 1000,
          });
          return result;
        } catch (error) {
          const message = humanizeApiError(error);
          const cooldown = error instanceof SaunaApiError && error.code === "verification_code_cooldown";
          set({
            authStatus: "error",
            authOperation: "idle",
            authError: message,
            authErrorCode: error instanceof SaunaApiError ? error.code : undefined,
            ...(cooldown
              ? {
                  authCodeSentEmail: normalizedEmail,
                  authResendAvailableAt: Date.now() + (error.retryAfterSeconds ?? 60) * 1000,
                }
              : {}),
          });
          throw error;
        }
      },
      verifyEmail: async (email, code) => {
        set({ authStatus: "loading", authOperation: "verifying_code", authError: undefined, authErrorCode: undefined });
        let result;
        try {
          result = await createSaunaApiClient().verifyEmail(email, code);
        } catch (error) {
          const message = humanizeApiError(error);
          set({ authStatus: "error", authOperation: "idle", authError: message, authErrorCode: error instanceof SaunaApiError ? error.code : undefined });
          throw error;
        }

        set({
          token: result.token,
          identity: result.identity,
          authStatus: "ready",
          authOperation: "login_success",
          devCode: undefined,
          authCodeSentEmail: undefined,
          authResendAvailableAt: undefined,
          authError: undefined,
          authErrorCode: undefined,
        });

        await Promise.allSettled([
          get().loadProviders(result.token),
          get().loadWorkspaceAgents(result.token),
          get().loadDistillationJobs(result.token),
          get().loadFocusSessions(result.token),
        ]);
      },
      resetEmailChallenge: () => set({
        authCodeSentEmail: undefined,
        authResendAvailableAt: undefined,
        devCode: undefined,
        authError: undefined,
        authErrorCode: undefined,
        authStatus: "idle",
        authOperation: "idle",
      }),
      completeAuthSuccess: () => set((state) => state.authOperation === "login_success" ? { authOperation: "idle" } : {}),
      invalidateSession: () => set({
        token: undefined,
        identity: undefined,
        providers: [],
        distillationJobs: [],
        activeSession: undefined,
        messagesBySession: {},
        sessions: [],
        initialPromptsBySession: {},
        turnsInFlightBySession: {},
        streamEvents: [],
        agents: (get().agents ?? []).filter((agent) => agent.sourceKind === "public"),
        selectedAgentId: "",
        authStatus: "error",
        authOperation: "idle",
        authResendAvailableAt: undefined,
        authError: "登录已过期，请重新登录。",
        authErrorCode: "unauthorized",
      }),
      logout: async () => {
        const token = get().token;
        set({ authStatus: "loading", authOperation: "logging_out", authError: undefined, authErrorCode: undefined });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          if (token) {
            await createSaunaApiClient(token).logout(controller.signal);
          }
        } catch {
          // Logout is local-first in outcome: stale or unreachable remote sessions must not trap the user.
        } finally {
          clearTimeout(timeout);
        }
        set({
          token: undefined,
          identity: undefined,
          providers: [],
          distillationJobs: [],
          activeSession: undefined,
          messagesBySession: {},
          sessions: [],
          initialPromptsBySession: {},
          turnsInFlightBySession: {},
          authCodeSentEmail: undefined,
          authResendAvailableAt: undefined,
          devCode: undefined,
          authStatus: "idle",
          authOperation: "idle",
          authError: undefined,
          authErrorCode: undefined,
          providerStatus: "idle",
          agents: (get().agents ?? []).filter((agent) => agent.sourceKind === "public"),
          selectedAgentId: "",
          streamEvents: [],
          focusError: undefined,
          providerError: undefined,
          distillationError: undefined,
        });
      },
      loadProviders: async (tokenOverride) => {
        const token = tokenOverride ?? get().token;
        if (!token) {
          return;
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const { provider_configs } = await createSaunaApiClient(token).listProviderConfigs();
          set({ providers: provider_configs ?? [], providerStatus: "ready" });
        } catch (error) {
          set({ providerStatus: "error", providerError: humanizeApiError(error) });
        }
      },
      createProvider: async (input) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const provider = await createSaunaApiClient(token).createProviderConfig({
            ...input,
            embedding_model: input.embedding_model ?? "",
            is_default: input.is_default ?? true,
          });
          const existing = (get().providers ?? []).filter((item) => item.id !== provider.id);
          const providers = provider.is_default ? [provider, ...existing.map((item) => ({ ...item, is_default: false }))] : [provider, ...existing];
          set({ providers, providerStatus: "ready" });
          return provider;
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      updateProvider: async (id, input) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const provider = await createSaunaApiClient(token).updateProviderConfig(id, {
            ...input,
            embedding_model: input.embedding_model ?? "",
            api_key: input.api_key ?? "",
            is_default: input.is_default ?? false,
          });
          const providers = (get().providers ?? []).map((item) => {
            if (item.id === provider.id) {
              return provider;
            }
            return provider.is_default ? { ...item, is_default: false } : item;
          });
          set({ providers, providerStatus: "ready" });
          return provider;
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      deleteProvider: async (id) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          await createSaunaApiClient(token).deleteProviderConfig(id);
          await get().loadProviders(token);
          set({ providerStatus: "ready" });
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      setDefaultProvider: async (id) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const provider = await createSaunaApiClient(token).setDefaultProviderConfig(id);
          set({
            providers: (get().providers ?? []).map((item) =>
              item.id === provider.id ? provider : { ...item, is_default: false },
            ),
            providerStatus: "ready",
          });
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      fetchProviderModels: async (id) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const { models } = await createSaunaApiClient(token).listProviderModels(id);
          set({ providerStatus: "ready" });
          return models ?? [];
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      discoverProviderModels: async (input) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const { models } = await createSaunaApiClient(token).discoverProviderModels(input);
          set({ providerStatus: "ready" });
          return models ?? [];
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },
      testProviderChat: async (id) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ providerStatus: "loading", providerError: undefined });
        try {
          const result = await createSaunaApiClient(token).testProviderChat(id);
          await get().loadProviders(token);
          set({ providerStatus: "ready" });
          return result;
        } catch (error) {
          const message = humanizeApiError(error);
          set({ providerStatus: "error", providerError: message });
          throw error;
        }
      },

      loadDistillationJobs: async (tokenOverride) => {
        const token = tokenOverride ?? get().token;
        if (!token) {
          return;
        }
        set({ distillationStatus: "loading", distillationError: undefined });
        try {
          const { jobs } = await createSaunaApiClient(token).listDistillationJobs();
          set({ distillationJobs: jobs ?? [], distillationStatus: "ready" });
        } catch (error) {
          set({ distillationStatus: "error", distillationError: humanizeApiError(error) });
        }
      },
      createDistillationJob: async (input) => {
        const token = get().token;
        if (!token) {
          throw new Error("请先登录。");
        }
        set({ distillationStatus: "loading", distillationError: undefined });
        try {
          const job = await createSaunaApiClient(token).createDistillationJob(input);
          set((state) => ({
            distillationJobs: [job, ...(state.distillationJobs ?? []).filter((item) => item.id !== job.id)],
            distillationStatus: "ready",
          }));
          window.setTimeout(() => {
            void get().loadDistillationJobs(token);
            void get().loadWorkspaceAgents(token);
          }, 1200);
          window.setTimeout(() => {
            void get().loadDistillationJobs(token);
            void get().loadWorkspaceAgents(token);
          }, 3200);
          return job;
        } catch (error) {
          const message = humanizeApiError(error);
          set({ distillationStatus: "error", distillationError: message });
          throw error;
        }
      },

      loadFocusSessions: async (tokenOverride) => {
        const token = tokenOverride ?? get().token;
        if (!token) {
          return;
        }
        set({ sessionStatus: "loading", focusError: undefined });
        try {
          const { sessions } = await createSaunaApiClient(token).listFocusSessions();
          set({ sessions: (sessions ?? []).map(apiSessionToSummary), sessionStatus: "ready" });
        } catch (error) {
          set({ sessionStatus: "error", focusError: humanizeApiError(error) });
        }
      },
      openAgentSession: async (agentId, title) => {
        const token = get().token;
        if (!token) {
          const error = "登录后才能使用你的 provider 开启会话。";
          set({ focusError: error });
          throw new Error(error);
        }
        if ((get().providers ?? []).length === 0) {
          await get().loadProviders(token);
        }
        if ((get().providers ?? []).length === 0) {
          const error = "先接入你的模型 provider 和 key。";
          set({ focusError: error });
          throw new Error(error);
        }
        set({ sessionStatus: "loading", focusError: undefined });
        try {
          const session = await createSaunaApiClient(token).createPublicAgentSession(agentId, title);
          const agent = (get().agents ?? []).find((item) => item.id === session.agent_id);
          const summary = sessionToSummary(session, agent);
          const sessions = [summary, ...get().sessions.filter((item) => item.id !== summary.id)];
          set({ activeSession: session, sessions, sessionStatus: "ready" });
          void get().loadFocusSessions(token);
          return session;
        } catch (error) {
          const message = humanizeApiError(error);
          set({ sessionStatus: "error", focusError: message });
          throw error;
        }
      },

      queueInitialPrompt: (key, draft) => {
        const content = draft.content.trim();
        if (!key || !content) return;
        const queued = { content, autoSend: draft.autoSend };
        writeConsultationDraft(key, queued);
        set((state) => ({
          initialPromptsBySession: { ...(state.initialPromptsBySession ?? {}), [key]: queued },
        }));
      },
      consumeInitialPrompt: (key, fallbackPrompt = "") => {
        const stored = readConsultationDraft(key);
        const queued = (get().initialPromptsBySession ?? {})[key] ?? stored;
        const result = queued ?? { content: fallbackPrompt.trim(), autoSend: false };
        set((state) => {
          const copy = { ...(state.initialPromptsBySession ?? {}) };
          delete copy[key];
          return { initialPromptsBySession: copy };
        });
        return result;
      },

      resumeSession: async (sessionId) => {
        const token = get().token;
        if (!token) {
          const error = "请先登录。";
          set({ focusError: error });
          throw new Error(error);
        }
        const summary = get().sessions.find((item) => item.id === sessionId);
        if (summary) {
          set({
            activeSession: {
              id: summary.id,
              workspace_id: get().identity?.workspace.id ?? "",
              session_type: summary.sessionType,
              title: summary.title,
              current_status: summary.currentStatus,
              agent_id: summary.agentIds[0] ?? "",
              agent_version_id: "",
              provider_config_id: "",
              created_at: summary.lastActivityAt ?? new Date().toISOString(),
              updated_at: summary.lastActivityAt ?? new Date().toISOString(),
            },
            selectedAgentId: summary.agentIds[0] ?? get().selectedAgentId,
          });
        }
        await get().loadMessages(sessionId);
      },
      renameFocusSession: async (sessionId, title) => {
        const token = get().token;
        const cleanTitle = title.trim();
        if (!token || !sessionId || !cleanTitle) {
          const error = cleanTitle ? "请先登录。" : "名称不能为空。";
          set({ focusError: error });
          throw new Error(error);
        }
        set({ sessionStatus: "loading", focusError: undefined });
        try {
          const session = await createSaunaApiClient(token).renameFocusSession(sessionId, cleanTitle);
          set((state) => ({
            activeSession: state.activeSession?.id === sessionId ? { ...state.activeSession, title: session.title, updated_at: session.updated_at } : state.activeSession,
            sessions: state.sessions.map((item) => (item.id === sessionId ? { ...item, title: session.title } : item)),
            sessionStatus: "ready",
          }));
        } catch (error) {
          set({ sessionStatus: "error", focusError: humanizeApiError(error) });
          throw error;
        }
      },
      deleteFocusSession: async (sessionId) => {
        const token = get().token;
        if (!token || !sessionId) {
          const error = "请先登录。";
          set({ focusError: error });
          throw new Error(error);
        }
        set({ sessionStatus: "loading", focusError: undefined });
        try {
          await createSaunaApiClient(token).deleteFocusSession(sessionId);
          set((state) => {
            const messagesBySession = { ...(state.messagesBySession ?? {}) };
            const initialPromptsBySession = { ...(state.initialPromptsBySession ?? {}) };
            const turnsInFlightBySession = { ...(state.turnsInFlightBySession ?? {}) };
            delete messagesBySession[sessionId];
            delete initialPromptsBySession[sessionId];
            delete turnsInFlightBySession[sessionId];
            return {
              activeSession: state.activeSession?.id === sessionId ? undefined : state.activeSession,
              sessions: state.sessions.filter((item) => item.id !== sessionId),
              messagesBySession,
              initialPromptsBySession,
              turnsInFlightBySession,
              sessionStatus: "ready",
              streamStatus: state.activeSession?.id === sessionId ? "ready" : state.streamStatus,
            };
          });
        } catch (error) {
          set({ sessionStatus: "error", focusError: humanizeApiError(error) });
          throw error;
        }
      },
      loadMessages: async (sessionId) => {
        const token = get().token;
        if (!token) {
          return;
        }
        set({ streamStatus: "loading" });
        try {
          const { messages } = await createSaunaApiClient(token).listMessages(sessionId);
          set((state) => ({
            messagesBySession: { ...(state.messagesBySession ?? {}), [sessionId]: messages ?? [] },
            streamStatus: "ready",
          }));
        } catch (error) {
          set({ streamStatus: "error", focusError: humanizeApiError(error) });
        }
      },
      startConsultation: async (agentId, content, title) => {
        const token = get().token;
        const workspaceID = get().identity?.workspace.id ?? "";
        const draftKey = `draft:${agentId}`;
        if ((get().turnsInFlightBySession ?? {})[draftKey]) {
          const active = get().activeSession;
          if (active) {
            return active;
          }
          throw new Error("咨询正在创建中。");
        }
        if (!token) {
          const error = "请先登录。";
          set({ focusError: error });
          throw new Error(error);
        }
        if ((get().providers ?? []).length === 0) {
          await get().loadProviders(token);
        }
        if ((get().providers ?? []).length === 0) {
          const error = "先接入你的模型 provider 和 key。";
          set({ focusError: error });
          throw new Error(error);
        }
        set((state) => ({ streamStatus: "loading", sessionStatus: "loading", focusError: undefined, turnsInFlightBySession: { ...(state.turnsInFlightBySession ?? {}), [draftKey]: true } }));
        try {
          const started = await createSaunaApiClient(token).startConsultation({ agent_id: agentId, content, title });
          const sessionId = started.session.id;
          const agent = (get().agents ?? []).find((item) => item.id === started.session.agent_id);
          const summary = sessionToSummary(started.session, agent);
          set((state) => {
            const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
            delete inFlight[draftKey];
            inFlight[sessionId] = true;
            return {
              activeSession: started.session,
              sessions: [summary, ...state.sessions.filter((item) => item.id !== summary.id)],
              messagesBySession: {
                ...(state.messagesBySession ?? {}),
                [sessionId]: upsertMessage((state.messagesBySession ?? {})[sessionId] ?? [], started.user_message),
              },
              streamStatus: "streaming",
              sessionStatus: "ready",
              turnsInFlightBySession: inFlight,
            };
          });
          void (async () => {
            try {
              await streamTurn(sessionId, started.turn.id, {
                token,
                onEvent: (event) => {
                  set((state) => {
                    const current = (state.messagesBySession ?? {})[sessionId] ?? [];
                    let messages = current;
                    if (event.event_type === "assistant.message.created") {
                      messages = upsertMessage(current, {
                        id: event.message_id,
                        workspace_id: workspaceID,
                        session_id: sessionId,
                        turn_id: event.turn_id,
                        agent_id: event.agent_id,
                        role: "assistant",
                        content: "",
                        status: "pending",
                        created_at: event.timestamp,
                      });
                    }
                    if (event.event_type === "assistant.delta") {
                      messages = appendDelta(messages, event, workspaceID);
                    }
                    if (event.event_type === "turn.completed" || event.event_type === "turn.failed") {
                      messages = messages.map((message) => {
                        if (message.id !== event.message_id) {
                          return message;
                        }
                        return { ...message, status: event.event_type === "turn.failed" ? "failed" : "complete", error: event.event_type === "turn.failed" ? event.error : undefined };
                      });
                    }
                    return {
                      streamEvents: [...state.streamEvents, event],
                      messagesBySession: { ...(state.messagesBySession ?? {}), [sessionId]: messages },
                      focusError: event.event_type === "turn.failed" ? event.error ?? "模型调用失败。" : state.focusError,
                    };
                  });
                },
              });
              await get().loadMessages(sessionId);
              await get().loadFocusSessions(token);
              set((state) => {
                const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
                delete inFlight[sessionId];
                return { streamStatus: "ready", turnsInFlightBySession: inFlight };
              });
            } catch (error) {
              const message = humanizeApiError(error);
              set((state) => {
                const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
                delete inFlight[sessionId];
                return { streamStatus: "error", focusError: message, turnsInFlightBySession: inFlight };
              });
            }
          })();
          return started.session;
        } catch (error) {
          const message = humanizeApiError(error);
          set((state) => {
            const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
            delete inFlight[draftKey];
            return { streamStatus: "error", sessionStatus: "error", focusError: message, turnsInFlightBySession: inFlight };
          });
          throw error;
        }
      },
      sendTurn: async (sessionId, content) => {
        const token = get().token;
        const workspaceID = get().identity?.workspace.id ?? "";
        if ((get().turnsInFlightBySession ?? {})[sessionId]) {
          return;
        }
        if (!token) {
          const error = "请先登录。";
          set({ focusError: error });
          throw new Error(error);
        }
        set((state) => ({ streamStatus: "loading", focusError: undefined, turnsInFlightBySession: { ...(state.turnsInFlightBySession ?? {}), [sessionId]: true } }));
        try {
          const result = await createSaunaApiClient(token).createTurn(sessionId, content);
          set((state) => {
            const current = (state.messagesBySession ?? {})[sessionId] ?? [];
            return {
              messagesBySession: {
                ...(state.messagesBySession ?? {}),
                [sessionId]: upsertMessage(current, result.user_message),
              },
              streamStatus: "streaming",
            };
          });

          await streamTurn(sessionId, result.turn.id, {
            token,
            onEvent: (event) => {
              set((state) => {
                const current = (state.messagesBySession ?? {})[sessionId] ?? [];
                let messages = current;
                if (event.event_type === "assistant.message.created") {
                  messages = upsertMessage(current, {
                    id: event.message_id,
                    workspace_id: workspaceID,
                    session_id: sessionId,
                    turn_id: event.turn_id,
                    agent_id: event.agent_id,
                    role: "assistant",
                    content: "",
                    status: "pending",
                    created_at: event.timestamp,
                  });
                }
                if (event.event_type === "assistant.delta") {
                  messages = appendDelta(messages, event, workspaceID);
                }
                if (event.event_type === "turn.completed" || event.event_type === "turn.failed") {
                  messages = messages.map((message) => {
                    if (message.id !== event.message_id) {
                      return message;
                    }
                    return { ...message, status: event.event_type === "turn.failed" ? "failed" : "complete", error: event.event_type === "turn.failed" ? event.error : undefined };
                  });
                }
                return {
                  streamEvents: [...state.streamEvents, event],
                  messagesBySession: { ...(state.messagesBySession ?? {}), [sessionId]: messages },
                  focusError: event.event_type === "turn.failed" ? event.error ?? "模型调用失败。" : state.focusError,
                };
              });
            },
          });
          set((state) => {
            const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
            delete inFlight[sessionId];
            return { streamStatus: "ready", turnsInFlightBySession: inFlight };
          });
          await get().loadMessages(sessionId);
          await get().loadFocusSessions(token);
        } catch (error) {
          const message = humanizeApiError(error);
          set((state) => {
            const inFlight = { ...(state.turnsInFlightBySession ?? {}) };
            delete inFlight[sessionId];
            return { streamStatus: "error", focusError: message, turnsInFlightBySession: inFlight };
          });
          throw error;
        }
      },
      retryTurn: async (sessionId, turnId) => {
        const token = get().token;
        const workspaceID = get().identity?.workspace.id ?? "";
        if (!token) throw new Error("请先登录。");
        if ((get().turnsInFlightBySession ?? {})[sessionId]) return;
        set((state) => ({ streamStatus: "loading", focusError: undefined, turnsInFlightBySession: { ...(state.turnsInFlightBySession ?? {}), [sessionId]: true } }));
        try {
          const { turn } = await createSaunaApiClient(token).retryTurn(sessionId, turnId);
          set((state) => ({
            messagesBySession: { ...(state.messagesBySession ?? {}), [sessionId]: ((state.messagesBySession ?? {})[sessionId] ?? []).filter((message) => !(message.turn_id === turnId && message.role === "assistant")) },
            streamStatus: "streaming",
          }));
          await streamTurn(sessionId, turn.id, {
            token,
            onEvent: (event) => set((state) => {
              const current = (state.messagesBySession ?? {})[sessionId] ?? [];
              let messages = current;
              if (event.event_type === "assistant.message.created") messages = upsertMessage(current, { id: event.message_id, workspace_id: workspaceID, session_id: sessionId, turn_id: event.turn_id, agent_id: event.agent_id, role: "assistant", content: "", status: "pending", created_at: event.timestamp });
              if (event.event_type === "assistant.delta") messages = appendDelta(messages, event, workspaceID);
              if (event.event_type === "turn.completed" || event.event_type === "turn.failed") messages = messages.map((message) => message.id === event.message_id ? { ...message, status: event.event_type === "turn.failed" ? "failed" : "complete", error: event.event_type === "turn.failed" ? event.error : undefined } : message);
              return { streamEvents: [...state.streamEvents, event], messagesBySession: { ...(state.messagesBySession ?? {}), [sessionId]: messages }, focusError: event.event_type === "turn.failed" ? event.error ?? "模型调用失败。" : state.focusError };
            }),
          });
          await get().loadMessages(sessionId);
          await get().loadFocusSessions(token);
          set((state) => { const inFlight = { ...(state.turnsInFlightBySession ?? {}) }; delete inFlight[sessionId]; return { streamStatus: "ready", turnsInFlightBySession: inFlight }; });
        } catch (error) {
          const message = humanizeApiError(error);
          set((state) => { const inFlight = { ...(state.turnsInFlightBySession ?? {}) }; delete inFlight[sessionId]; return { streamStatus: "error", focusError: message, turnsInFlightBySession: inFlight }; });
          throw error;
        }
      },
    }),
    {
      name: "sauna-session",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState) => migrateSaunaPersistedState(persistedState),
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
