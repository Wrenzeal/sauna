import assert from "node:assert/strict";
import test from "node:test";
import { decideModelAction, decidePrivateRoute, focusDraftKey, migrateSaunaPersistedState, pageTransitionKey, resendSecondsRemaining, resolveAuthModalStage, resolveFocusSessionId, shouldReleaseAdoptedFocusSession } from "../access-policy.ts";
import { SaunaApiError, classifySaunaApiError, humanizeApiError } from "../sauna-api.ts";

const draft = { kind: "consultation" as const, draft: { agentId: "agent-1", content: "一个问题", sourceRoute: "/lobby" } };

test("anonymous consultation opens auth and preserves draft", () => {
  assert.deepEqual(decideModelAction({ authenticated: false, providerReady: false, intent: draft }), {
    kind: "open_auth", reason: "consultation_guard", intent: draft,
  });
});

test("authenticated consultation without provider opens provider setup", () => {
  assert.deepEqual(decideModelAction({ authenticated: true, providerReady: false, intent: draft }), {
    kind: "open_provider", mode: "create", reason: "provider_missing",
  });
});

test("private routes lock before authentication", () => {
  assert.equal(decidePrivateRoute(false).kind, "locked");
  assert.equal(decidePrivateRoute(true).kind, "allow");
});

test("persist migration keeps only a valid token", () => {
  assert.deepEqual(migrateSaunaPersistedState({ token: "token", identity: { secret: true }, activeSession: { id: "private" }, selectedAgentId: "private-agent" }), { token: "token" });
  assert.deepEqual(migrateSaunaPersistedState({ token: "" }), {});
  assert.deepEqual(migrateSaunaPersistedState(null), {});
});

test("structured API errors map to access recovery paths", () => {
  assert.equal(classifySaunaApiError(new SaunaApiError(401, "unauthorized", "expired")), "unauthorized");
  assert.equal(classifySaunaApiError(new SaunaApiError(409, "provider_config_required", "missing")), "provider_required");
  assert.equal(classifySaunaApiError(new SaunaApiError(502, "provider_request_failed", "bad upstream")), "provider_failure");
  assert.equal(classifySaunaApiError(new SaunaApiError(502, "request_failed", "bad gateway")), "ordinary");
  assert.equal(classifySaunaApiError(new SaunaApiError(400, "invalid_verification_code", "invalid")), "ordinary");
  assert.equal(classifySaunaApiError(new TypeError("network")), "ordinary");
});

test("verification feedback uses dedicated copy and retry metadata", () => {
  assert.equal(
    humanizeApiError(new SaunaApiError(400, "invalid_verification_code", "invalid")),
    "验证码错误或已失效，请检查后重试。",
  );
  assert.equal(
    humanizeApiError(new SaunaApiError(429, "verification_code_cooldown", "wait", 42)),
    "验证码已发送，请在 42 秒后重试。",
  );
});

test("resend countdown rounds up and stops at zero", () => {
  assert.equal(resendSecondsRemaining(61_001, 1_001), 60);
  assert.equal(resendSecondsRemaining(2_001, 1_001), 1);
  assert.equal(resendSecondsRemaining(1_001, 1_001), 0);
  assert.equal(resendSecondsRemaining(undefined, 1_001), 0);
});

test("login success takes precedence over cleared verification challenge state", () => {
  assert.equal(resolveAuthModalStage("idle", false), "email");
  assert.equal(resolveAuthModalStage("idle", true), "code");
  assert.equal(resolveAuthModalStage("verifying_code", true), "verifying");
  assert.equal(resolveAuthModalStage("login_success", false), "success");
  assert.equal(resolveAuthModalStage("login_success", true), "success");
});

test("focus room draft and transition helpers keep first-send state stable", () => {
  assert.equal(focusDraftKey("agent-1"), "draft:agent-1");
  assert.equal(pageTransitionKey("/focus-room/new"), "/focus-room");
  assert.equal(pageTransitionKey("/focus-room/session-1"), "/focus-room");
  assert.equal(pageTransitionKey("/lobby"), "/lobby");
});

test("an adopted real session survives failures until the route catches up", () => {
  assert.equal(resolveFocusSessionId("new", "session-1"), "session-1");
  assert.equal(resolveFocusSessionId("new"), "new");
  assert.equal(resolveFocusSessionId("session-2", "session-1"), "session-2");
  assert.equal(shouldReleaseAdoptedFocusSession("new", "session-1"), false);
  assert.equal(shouldReleaseAdoptedFocusSession("session-1", "session-1"), true);
  assert.equal(shouldReleaseAdoptedFocusSession("session-2", "session-1"), true);
});
