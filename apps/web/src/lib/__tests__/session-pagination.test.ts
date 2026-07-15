import assert from "node:assert/strict";
import test from "node:test";

import { mergeSessionPages } from "../session-pagination.ts";
import type { SessionSummary } from "../../types/sauna.ts";

function session(id: string, title = id): SessionSummary {
  return {
    id,
    title,
    sessionType: "focus_room",
    currentStatus: "active",
    agentIds: [],
  };
}

test("session pagination appends older pages in order", () => {
  assert.deepEqual(
    mergeSessionPages([session("newest"), session("middle")], [session("oldest")]).map((item) => item.id),
    ["newest", "middle", "oldest"],
  );
});

test("session pagination updates duplicate rows without repeating them", () => {
  const merged = mergeSessionPages(
    [session("newest"), session("boundary", "old title")],
    [session("boundary", "updated title"), session("oldest")],
  );

  assert.deepEqual(merged.map((item) => item.id), ["newest", "boundary", "oldest"]);
  assert.equal(merged[1]?.title, "updated title");
});
