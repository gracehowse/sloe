import { describe, expect, it, vi } from "vitest";

import {
  writeAheadEnqueue,
  withUpsertTimeout,
  ackWrittenIds,
  queueRowsAsByDayFallback,
  UPSERT_TIMEOUT,
  type JournalWriteQueueIO,
} from "@/lib/nutrition/journalWriteAhead";
import {
  emptyJournalWriteQueue,
  enqueueJournalUpserts,
  type JournalWriteQueue,
} from "@/lib/nutrition/journalWriteQueue";
import { mergeJournalByDay } from "@/lib/nutrition/mergeJournalByDay";

/** In-memory queue IO stand-in for AsyncStorage/localStorage. */
function makeMemoryIO(initial: JournalWriteQueue = emptyJournalWriteQueue()): JournalWriteQueueIO & {
  current: () => JournalWriteQueue;
} {
  let state = initial;
  return {
    load: async () => state,
    save: async (q) => {
      state = q;
    },
    current: () => state,
  };
}

describe("journalWriteAhead — writeAheadEnqueue (ordering)", () => {
  it("persists rows to the queue and returns the updated queue", async () => {
    const io = makeMemoryIO();
    const result = await writeAheadEnqueue(io, "2026-07-06", [{ id: "a", calories: 100 }]);
    expect(result.entries.map((e) => e.row.id)).toEqual(["a"]);
    // Saved, not just returned — a fresh load reflects it.
    expect((await io.load()).entries).toHaveLength(1);
  });

  it("enqueue happens BEFORE any network attempt can be observed — the queue is durable synchronously w.r.t. the caller awaiting it", async () => {
    const io = makeMemoryIO();
    const networkCalls: string[] = [];
    // Simulate the real call-site order: enqueue, THEN attempt network.
    await writeAheadEnqueue(io, "2026-07-06", [{ id: "a" }]);
    // If the process were killed right here (before the next line), the row
    // must already be recoverable from storage.
    expect((await io.load()).entries.map((e) => e.row.id)).toEqual(["a"]);
    networkCalls.push("upsert-attempted");
    expect(networkCalls).toEqual(["upsert-attempted"]);
  });

  it("is a no-op for an empty row list (still returns the current queue)", async () => {
    const io = makeMemoryIO();
    const before = await io.load();
    const result = await writeAheadEnqueue(io, "2026-07-06", []);
    expect(result).toEqual(before);
  });
});

describe("journalWriteAhead — withUpsertTimeout", () => {
  it("resolves with the promise's value when it settles before the timeout", async () => {
    const fast = Promise.resolve({ error: null });
    const outcome = await withUpsertTimeout(fast, 1000);
    expect(outcome).toEqual({ error: null });
  });

  it("resolves to UPSERT_TIMEOUT when the promise never settles in time", async () => {
    vi.useFakeTimers();
    try {
      const hung = new Promise(() => {
        /* never resolves — simulates a dead connection */
      });
      const outcomePromise = withUpsertTimeout(hung, 10_000);
      await vi.advanceTimersByTimeAsync(10_001);
      const outcome = await outcomePromise;
      expect(outcome).toBe(UPSERT_TIMEOUT);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resolve to the timeout sentinel before the deadline", async () => {
    vi.useFakeTimers();
    try {
      let resolveHung: (v: { error: null }) => void;
      const hung = new Promise<{ error: null }>((resolve) => {
        resolveHung = resolve;
      });
      const outcomePromise = withUpsertTimeout(hung, 10_000);
      await vi.advanceTimersByTimeAsync(5_000);
      resolveHung!({ error: null });
      const outcome = await outcomePromise;
      expect(outcome).toEqual({ error: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts a PromiseLike (not just a strict Promise) — supabase-js query builders are thenable", async () => {
    const thenable: PromiseLike<{ error: null }> = {
      then(onfulfilled) {
        return Promise.resolve({ error: null }).then(onfulfilled);
      },
    };
    const outcome = await withUpsertTimeout(thenable, 1000);
    expect(outcome).toEqual({ error: null });
  });
});

describe("journalWriteAhead — ackWrittenIds", () => {
  it("removes exactly the confirmed ids, leaving others queued", async () => {
    const queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-07-06", [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    const io = makeMemoryIO(queue);
    await ackWrittenIds(io, ["a", "c"]);
    expect(io.current().entries.map((e) => e.row.id)).toEqual(["b"]);
  });

  it("re-loads immediately before acking so a concurrently-enqueued row is never clobbered", async () => {
    const queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-07-06", [{ id: "a" }]);
    const io = makeMemoryIO(queue);
    // Simulate a row landing in storage AFTER the caller captured its own
    // snapshot of the queue but BEFORE ackWrittenIds re-loads.
    const withConcurrent = enqueueJournalUpserts(queue, "2026-07-06", [{ id: "concurrent" }]);
    await io.save(withConcurrent);

    await ackWrittenIds(io, ["a"]);
    expect(io.current().entries.map((e) => e.row.id)).toEqual(["concurrent"]);
  });

  it("is a no-op for an empty id list", async () => {
    const queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-07-06", [{ id: "a" }]);
    const io = makeMemoryIO(queue);
    await ackWrittenIds(io, []);
    expect(io.current().entries.map((e) => e.row.id)).toEqual(["a"]);
  });
});

describe("journalWriteAhead — queueRowsAsByDayFallback (cold-start hydration)", () => {
  it("groups queued rows by dayKey", () => {
    let queue = enqueueJournalUpserts(emptyJournalWriteQueue(), "2026-07-06", [
      { id: "a", calories: 100 },
    ]);
    queue = enqueueJournalUpserts(queue, "2026-07-05", [{ id: "b", calories: 200 }]);
    const byDay = queueRowsAsByDayFallback(queue);
    expect(byDay["2026-07-06"]?.map((r) => r.id)).toEqual(["a"]);
    expect(byDay["2026-07-05"]?.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns an empty map for an empty queue", () => {
    expect(queueRowsAsByDayFallback(emptyJournalWriteQueue())).toEqual({});
  });
});

describe("journalWriteAhead — kill-relaunch simulation", () => {
  it("enqueue → no ack (simulated crash before upsert resolves) → fresh load merges the queued row into the journal", async () => {
    const io = makeMemoryIO();
    // Step 1: write-ahead enqueue (this always completes before any network
    // attempt in the real call sites).
    await writeAheadEnqueue(io, "2026-07-06", [
      { id: "meal-1", date_key: "2026-07-06", name: "Snacks", calories: 150 },
    ]);
    // Simulated crash: the process dies here, before the upsert (or its ack)
    // ever runs. No `ackWrittenIds` call happens.

    // "Fresh load" after relaunch: in-memory state starts empty ({}), exactly
    // like a real cold start — nothing survives process death except what's
    // in durable storage.
    const freshInMemoryByDay = {};
    const queuedByDay = queueRowsAsByDayFallback(await io.load());
    const queuedMeals = Object.fromEntries(
      Object.entries(queuedByDay).map(([k, rows]) => [k, rows.map((r) => ({ id: String(r.id) }))]),
    );
    // Mirrors the TodayScreen call site: mergeJournalByDay(loaded, mergeJournalByDay(queuedMeals, prev)).
    const serverSnapshot = {}; // server hasn't seen this row yet either.
    const merged = mergeJournalByDay(serverSnapshot, mergeJournalByDay(queuedMeals, freshInMemoryByDay));

    expect(merged["2026-07-06"]?.map((m) => m.id)).toEqual(["meal-1"]);
  });

  it("enqueue → ack → fresh load does NOT duplicate the row (queue is empty, server snapshot is authoritative)", async () => {
    const io = makeMemoryIO();
    await writeAheadEnqueue(io, "2026-07-06", [
      { id: "meal-1", date_key: "2026-07-06", name: "Snacks", calories: 150 },
    ]);
    // Upsert confirmed — ack removes it from the queue.
    await ackWrittenIds(io, ["meal-1"]);

    const queuedByDay = queueRowsAsByDayFallback(await io.load());
    expect(queuedByDay).toEqual({});

    // Server snapshot now has the row (the upsert landed).
    const serverSnapshot = { "2026-07-06": [{ id: "meal-1" }] };
    const merged = mergeJournalByDay(serverSnapshot, mergeJournalByDay({}, {}));
    expect(merged["2026-07-06"]?.map((m) => m.id)).toEqual(["meal-1"]);
    expect(merged["2026-07-06"]).toHaveLength(1);
  });

  it("a row that's BOTH still-queued AND already on the server is not duplicated by the merge (id-based dedupe)", async () => {
    const io = makeMemoryIO();
    // Row was written ahead, the upsert actually succeeded server-side, but a
    // hung response meant the client never got to call ackWrittenIds (e.g.
    // the timeout fired). It's still sitting in the queue.
    await writeAheadEnqueue(io, "2026-07-06", [{ id: "meal-1" }]);
    const queuedByDay = queueRowsAsByDayFallback(await io.load());
    const queuedMeals = Object.fromEntries(
      Object.entries(queuedByDay).map(([k, rows]) => [k, rows.map((r) => ({ id: String(r.id) }))]),
    );
    const serverSnapshot = { "2026-07-06": [{ id: "meal-1" }] };
    const merged = mergeJournalByDay(serverSnapshot, mergeJournalByDay(queuedMeals, {}));
    expect(merged["2026-07-06"]).toHaveLength(1);
  });
});
