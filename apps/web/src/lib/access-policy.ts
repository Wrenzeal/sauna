export interface InitialConsultationDraft {
  content: string;
  autoSend: boolean;
}

export function focusDraftKey(agentId: string): string {
  return `draft:${agentId}`;
}

export function pageTransitionKey(pathname: string): string {
  return pathname.startsWith("/focus-room/") ? "/focus-room" : pathname;
}

export function resolveFocusSessionId(
  routeSessionId: string,
  adoptedSessionId?: string,
): string {
  return routeSessionId === "new" && adoptedSessionId
    ? adoptedSessionId
    : routeSessionId;
}

export function shouldReleaseAdoptedFocusSession(
  routeSessionId: string,
  adoptedSessionId?: string,
): boolean {
  return Boolean(adoptedSessionId && routeSessionId !== "new");
}

export type AuthOperation = "idle" | "sending_code" | "verifying_code" | "login_success" | "logging_out";
export type AuthModalStage = "email" | "code" | "verifying" | "success";

export function resolveAuthModalStage(operation: AuthOperation, codeSent: boolean): AuthModalStage {
  if (operation === "login_success") return "success";
  if (operation === "verifying_code") return "verifying";
  return codeSent ? "code" : "email";
}

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

export function resendSecondsRemaining(availableAt: number | undefined, now: number): number {
  if (!availableAt || availableAt <= now) return 0;
  return Math.ceil((availableAt - now) / 1000);
}
