"use client";

import { create } from "zustand";
import type { AuthIntent, AuthReason, ConsultationDraft, ProviderReason } from "@/lib/access-policy";

interface AuthModalState {
  open: boolean;
  reason: AuthReason;
  intent: AuthIntent;
}

interface ProviderModalState {
  open: boolean;
  mode: "create" | "repair";
  reason: ProviderReason;
}

interface AccessUIState {
  auth: AuthModalState;
  provider: ProviderModalState;
  openAuth: (reason?: AuthReason, intent?: AuthIntent) => void;
  closeAuth: () => void;
  clearAuthIntent: () => void;
  openProvider: (mode?: "create" | "repair", reason?: ProviderReason) => void;
  closeProvider: () => void;
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
  openProvider: (mode = "create", reason = "provider_missing") => set({ provider: { open: true, mode, reason } }),
  closeProvider: () => set((state) => ({ provider: { ...state.provider, open: false } })),
  preserveConsultation: (draft) => set((state) => ({ auth: { ...state.auth, intent: { kind: "consultation", draft } } })),
  consumeConsultation: (agentId) => {
    const intent = get().auth.intent;
    if (intent.kind !== "consultation") return undefined;
    if (agentId && intent.draft.agentId !== agentId) return undefined;
    set((state) => ({ auth: { ...state.auth, intent: { kind: "none" } } }));
    return intent.draft;
  },
  reset: () => set({ auth: initialAuth, provider: initialProvider }),
}));
