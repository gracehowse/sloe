import { describe, expect, it } from "vitest";

import {
  bumpJournalQueueAttempts,
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

  it("enqueued rows start at zero attempts and reset on re-enqueue", () => {
    let queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-06-15", [{ id: "a" }]);
    expect(queue.entries[0]?.attempts).toBe(0);
    queue = bumpJournalQueueAttempts(bumpJournalQueueAttempts(queue));
    expect(queue.entries[0]?.attempts).toBe(2);
    // Re-enqueueing the same id (an edit / fresh data) clears the retry budget.
    queue = enqueueJournalUpserts(queue, "2026-06-15", [{ id: "a", calories: 50 }]);
    expect(queue.entries[0]?.attempts).toBe(0);
  });

  it("parseJournalWriteQueue defaults missing attempts to 0 and floors bad values", () => {
    const parsed = parseJournalWriteQueue({
      version: 1,
      entries: [
        { kind: "upsert", dayKey: "2026-06-15", row: { id: "a" } },
        { kind: "upsert", dayKey: "2026-06-15", row: { id: "b" }, attempts: 3.9 },
        { kind: "upsert", dayKey: "2026-06-15", row: { id: "c" }, attempts: -2 },
      ],
    });
    expect(parsed.entries.map((e) => e.attempts)).toEqual([0, 3, 0]);
  });

  it("bumpJournalQueueAttempts is a no-op on an empty queue", () => {
    const empty = emptyJournalWriteQueue();
    expect(bumpJournalQueueAttempts(empty)).toBe(empty);
  });
});
