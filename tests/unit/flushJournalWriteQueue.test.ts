import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  flushJournalWriteQueue,
  reconcileQueueAfterFlush,
} from "../../src/lib/nutrition/flushJournalWriteQueue";
import {
  enqueueJournalUpserts,
  emptyJournalWriteQueue,
  parseJournalWriteQueue,
  MAX_JOURNAL_FLUSH_ATTEMPTS,
} from "../../src/lib/nutrition/journalWriteQueue";

type UpsertResult = { error: { message?: string; code?: string } | null };

/** Minimal fake: `from().upsert(rows)` is awaited directly for `{ error }`. */
function makeSupabase(upsert: (rows: Array<{ id: string }>) => UpsertResult) {
  const fn = vi.fn((rows: Array<{ id: string }>) => Promise.resolve(upsert(rows)));
  const client = { from: () => ({ upsert: fn }) } as unknown as SupabaseClient;
  return { client, fn };
}

const queueOf = (ids: string[]) =>
  enqueueJournalUpserts(
    emptyJournalWriteQueue(),
    "2026-06-15",
    ids.map((id) => ({ id, calories: 100 })),
  );

describe("flushJournalWriteQueue", () => {
  it("on success removes only the ids it sent — never blanket-empties", async () => {
    const { client } = makeSupabase(() => ({ error: null }));
    const queue = queueOf(["a", "b"]);
    const result = await flushJournalWriteQueue(client, queue);

    expect(result.flushedIds.sort()).toEqual(["a", "b"]);
    expect(result.remaining.entries).toHaveLength(0);
    expect(result.dropQueue).toBe(false);
  });

  it("reconcile preserves a row enqueued during the flush round-trip", async () => {
    const { client } = makeSupabase(() => ({ error: null }));
    const sent = queueOf(["a", "b"]);
    const result = await flushJournalWriteQueue(client, sent);
    // Simulate a 3rd failed write that landed in storage mid-flush.
    const latest = enqueueJournalUpserts(sent, "2026-06-15", [{ id: "c", calories: 200 }]);

    const next = reconcileQueueAfterFlush(sent, latest, result);
    expect(next.entries.map((e) => e.row.id)).toEqual(["c"]);
  });

  it("keeps the queue on an expired JWT (transient, refreshable) — does NOT drop", async () => {
    const { client, fn } = makeSupabase(() => ({
      error: { message: "JWT expired" },
    }));
    const queue = queueOf(["a"]);
    const result = await flushJournalWriteQueue(client, queue);

    expect(result.dropQueue).toBe(false);
    expect(result.flushedIds).toHaveLength(0);
    expect(result.remaining.entries).toHaveLength(1);
    // Attempt counter bumped; no row-by-row isolation yet (single bulk call).
    expect(result.remaining.entries[0]?.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("drops the queue only on a terminal RLS/permission denial", async () => {
    const { client } = makeSupabase(() => ({
      error: { message: "permission denied for table nutrition_entries", code: "42501" },
    }));
    const queue = queueOf(["a", "b"]);
    const result = await flushJournalWriteQueue(client, queue);

    expect(result.dropQueue).toBe(true);
    expect(result.remaining.entries).toHaveLength(0);

    // Reconcile drops the sent ids but keeps a concurrently-enqueued row.
    const latest = enqueueJournalUpserts(queue, "2026-06-15", [{ id: "c", calories: 1 }]);
    const next = reconcileQueueAfterFlush(queue, latest, result);
    expect(next.entries.map((e) => e.row.id)).toEqual(["c"]);
  });

  it("isolates and evicts a poison row once it exhausts its retry budget", async () => {
    // One entry already near the cap, one fresh. Bulk keeps failing; the next
    // bump tips the poison row over MAX and triggers row-by-row isolation.
    const queue = parseJournalWriteQueue({
      version: 1,
      entries: [
        { kind: "upsert", dayKey: "2026-06-15", row: { id: "good" }, attempts: 0 },
        {
          kind: "upsert",
          dayKey: "2026-06-15",
          row: { id: "poison" },
          attempts: MAX_JOURNAL_FLUSH_ATTEMPTS - 1,
        },
      ],
    });
    const { client, fn } = makeSupabase((rows) => {
      if (rows.length > 1) return { error: { message: "503 timeout" } }; // bulk fails
      return rows[0]?.id === "poison"
        ? { error: { message: "insert violates foreign key constraint" } }
        : { error: null };
    });

    const result = await flushJournalWriteQueue(client, queue);

    expect(result.flushedIds).toEqual(["good"]);
    expect(result.droppedPoisonIds).toEqual(["poison"]);
    expect(result.remaining.entries).toHaveLength(0);
    // 1 bulk + 2 per-row isolation calls.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("keeps retrying in bulk before the cap (no premature isolation)", async () => {
    const { client, fn } = makeSupabase(() => ({ error: { message: "network error" } }));
    const queue = queueOf(["a", "b"]);
    const result = await flushJournalWriteQueue(client, queue);

    expect(result.flushedIds).toHaveLength(0);
    expect(result.droppedPoisonIds).toHaveLength(0);
    expect(result.remaining.entries.every((e) => e.attempts === 1)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1); // single bulk attempt, no isolation
  });
});
