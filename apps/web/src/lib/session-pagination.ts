import type { SessionSummary } from "@/types/sauna";

export function mergeSessionPages(
  current: SessionSummary[],
  incoming: SessionSummary[],
): SessionSummary[] {
  const merged = [...current];
  const indexes = new Map(merged.map((session, index) => [session.id, index]));

  for (const session of incoming) {
    const existingIndex = indexes.get(session.id);
    if (existingIndex === undefined) {
      indexes.set(session.id, merged.length);
      merged.push(session);
      continue;
    }
    merged[existingIndex] = session;
  }

  return merged;
}
