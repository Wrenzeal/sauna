"use client";

import { create } from "zustand";
import {
  providerRepairResultForSave,
  type AuthIntent,
  type AuthReason,
  type ConsultationDraft,
  type ProviderModalContext,
  type ProviderReason,
  type ProviderRepairResult,
} from "@/lib/access-policy";

interface AuthModalState {
  open: boolean;
  reason: AuthReason;
  intent: AuthIntent;
}

interface ProviderModalState {
  open: boolean;
  mode: "create" | "repair";
  reason: ProviderReason;
  context?: ProviderModalContext;
}

interface AccessUIState {
  auth: AuthModalState;
  provider: ProviderModalState;
  providerRepairResult?: ProviderRepairResult;
  openAuth: (reason?: AuthReason, intent?: AuthIntent) => void;
  closeAuth: () => void;
  clearAuthIntent: () => void;
  openProvider: (
    mode?: "create" | "repair",
    reason?: ProviderReason,
    context?: ProviderModalContext,
  ) => void;
  closeProvider: () => void;
  completeProviderSave: (providerId: string) => void;
  clearProviderRepairResult: (sessionId?: string) => void;
  preserveConsultation: (draft: ConsultationDraft) => void;
  consumeConsultation: (agentId?: string) => ConsultationDraft | undefined;
  reset: () => void;
}

const initialAuth: AuthModalState = { open: false, reason: "entry_login", intent: { kind: "none" } };
const initialProvider: ProviderModalState = { open: false, mode: "create", reason: "provider_missing" };

export const useAccessUIStore = create<AccessUIState>((set, get) => ({
  auth: initialAuth,
  provider: initialProvider,
  openAuth: (reason = "entry_login", intent = { kind: "none" }) => set({ auth: { open: true, reason, intent } }),
  closeAuth: () => set((state) => ({ auth: { ...state.auth, open: false } })),
  clearAuthIntent: () => set((state) => ({ auth: { ...state.auth, intent: { kind: "none" } } })),
  openProvider: (mode = "create", reason = "provider_missing", context) => set({
    provider: { open: true, mode, reason, context },
    providerRepairResult: undefined,
  }),
  closeProvider: () => set((state) => ({ provider: { ...state.provider, open: false } })),
  completeProviderSave: (providerId) => set((state) => ({
    provider: { ...state.provider, open: false },
    providerRepairResult: providerRepairResultForSave(state.provider.context, providerId),
  })),
  clearProviderRepairResult: (sessionId) => set((state) => ({
    providerRepairResult:
      !sessionId || state.providerRepairResult?.sessionId === sessionId
        ? undefined
        : state.providerRepairResult,
  })),
  preserveConsultation: (draft) => set((state) => ({ auth: { ...state.auth, intent: { kind: "consultation", draft } } })),
  consumeConsultation: (agentId) => {
    const intent = get().auth.intent;
    if (intent.kind !== "consultation") return undefined;
    if (agentId && intent.draft.agentId !== agentId) return undefined;
    set((state) => ({ auth: { ...state.auth, intent: { kind: "none" } } }));
    return intent.draft;
  },
  reset: () => set({ auth: initialAuth, provider: initialProvider, providerRepairResult: undefined }),
}));
