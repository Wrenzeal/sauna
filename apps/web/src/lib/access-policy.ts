export type AuthReason = "entry_login" | "consultation_guard" | "protected_action" | "protected_route" | "reauth";
export type ProviderReason = "provider_missing" | "provider_required" | "provider_repair";

export interface ConsultationDraft {
  agentId: string;
  content: string;
  sourceRoute: string;
}

export type AuthIntent =
  | { kind: "none" }
  | { kind: "consultation"; draft: ConsultationDraft }
  | { kind: "route"; returnTo: string }
  | { kind: "protected_action"; returnTo: string };

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "open_auth"; reason: AuthReason; intent: AuthIntent }
  | { kind: "open_provider"; mode: "create" | "repair"; reason: ProviderReason }
  | { kind: "locked" };

export function decideModelAction(input: {
  authenticated: boolean;
  providerReady: boolean;
  intent: AuthIntent;
}): AccessDecision {
  if (!input.authenticated) {
    return { kind: "open_auth", reason: "consultation_guard", intent: input.intent };
  }
  if (!input.providerReady) {
    return { kind: "open_provider", mode: "create", reason: "provider_missing" };
  }
  return { kind: "allow" };
}

export function decidePrivateRoute(authenticated: boolean): AccessDecision {
  return authenticated ? { kind: "allow" } : { kind: "locked" };
}

export interface PersistedSaunaStateV2 {
  token?: string;
}

export function migrateSaunaPersistedState(value: unknown): PersistedSaunaStateV2 {
  if (!value || typeof value !== "object") return {};
  const token = (value as { token?: unknown }).token;
  return typeof token === "string" && token.trim() ? { token } : {};
}
