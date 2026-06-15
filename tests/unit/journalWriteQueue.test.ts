import { describe, expect, it } from "vitest";

import {
  enqueueJournalUpserts,
  emptyJournalWriteQueue,
  parseJournalWriteQueue,
  removeJournalQueuedIds,
} from "../../src/lib/nutrition/journalWriteQueue";

describe("journalWriteQueue", () => {
  it("enqueueJournalUpserts dedupes by meal id", () => {
    const rowA = { id: "meal-a", user_id: "u1", date_key: "2026-06-15" };
    const rowB = { id: "meal-b", user_id: "u1", date_key: "2026-06-15" };
    let queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-06-15", [rowA]);
    queue = enqueueJournalUpserts(queue, "2026-06-15", [{ ...rowA, calories: 500 }, rowB]);
    expect(queue.entries).toHaveLength(2);
    expect((queue.entries.find((e) => e.row.id === "meal-a")?.row as { calories?: number }).calories).toBe(
      500,
    );
  });

  it("parseJournalWriteQueue drops malformed entries", () => {
    const parsed = parseJournalWriteQueue({
      version: 1,
      entries: [{ kind: "upsert", dayKey: "2026-06-15", row: { id: "ok" } }, { kind: "nope" }],
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.row.id).toBe("ok");
  });

  it("removeJournalQueuedIds removes flushed ids", () => {
    const queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-06-15", [
      { id: "a" },
      { id: "b" },
    ]);
    const next = removeJournalQueuedIds(queue, ["a"]);
    expect(next.entries.map((e) => e.row.id)).toEqual(["b"]);
  });
});
