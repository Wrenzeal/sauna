import assert from "node:assert/strict";
import test from "node:test";
import {
  isAssistantMessageWorking,
  shouldRenderChatMessage,
} from "../focus-room-state.ts";

const assistant = (status: "pending" | "partial" | "complete" | "failed", content = "") => ({
  role: "assistant" as const,
  status,
  content,
});

test("working copy only appears for an empty in-flight assistant message", () => {
  assert.equal(isAssistantMessageWorking(assistant("pending"), true), true);
  assert.equal(isAssistantMessageWorking(assistant("partial"), true), true);
  assert.equal(isAssistantMessageWorking(assistant("pending"), false), false);
  assert.equal(isAssistantMessageWorking(assistant("failed"), true), false);
  assert.equal(isAssistantMessageWorking(assistant("partial", "已有回答"), true), false);
});

test("empty failed or stale assistant messages stay hidden", () => {
  assert.equal(shouldRenderChatMessage(assistant("failed"), false), false);
  assert.equal(shouldRenderChatMessage(assistant("pending"), false), false);
  assert.equal(shouldRenderChatMessage(assistant("complete"), false), false);
  assert.equal(shouldRenderChatMessage(assistant("failed", "部分回答"), false), true);
  assert.equal(
    shouldRenderChatMessage({ role: "user", status: "complete", content: "问题" }, false),
    true,
  );
});
