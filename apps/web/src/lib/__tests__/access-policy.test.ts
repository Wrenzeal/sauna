import assert from "node:assert/strict";
import test from "node:test";
import { decideModelAction, decidePrivateRoute, migrateSaunaPersistedState } from "../access-policy.ts";
import { SaunaApiError, classifySaunaApiError } from "../sauna-api.ts";

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
  assert.equal(classifySaunaApiError(new TypeError("network")), "ordinary");
});
