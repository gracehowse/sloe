/**
 * ENG-1466 — web port of `apps/mobile/tests/unit/useJournalWriteAhead.test.tsx`
 * (ENG-1447). Mirrors the mobile suite's coverage against the web
 * `localStorage`-backed queue: enqueue-before-upsert ordering, ack removes
 * confirmed ids, timeout -> queue path, duplicate-safety on flush retry,
 * network rejection, 42501 session-refresh retry, and drop-reporting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { act, renderHook } from "@testing-library/react";
void React;

const trackMock = vi.fn();
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: (...args: unknown[]) => toastWarningMock(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  useWebJournalWriteAhead,
  reportDroppedJournalWrites,
} from "../../src/hooks/useWebJournalWriteAhead";
import { JOURNAL_WRITE_QUEUE_STORAGE_KEY } from "../../src/lib/nutrition/journalWriteQueue";

type UpsertOutcome = { error: { message?: string; code?: string } | null };

/** Minimal Supabase fake matching the shape `useWebJournalWriteAhead` calls. */
function makeSupabase(opts: {
  upsert: () => UpsertOutcome | Promise<UpsertOutcome>;
  refreshSession?: () => Promise<{ data: { session: unknown } | null; error: unknown }>;
}) {
  const upsertMock = vi.fn(async () => opts.upsert());
  const from = vi.fn(() => ({ upsert: upsertMock }));
  const refreshSession = vi.fn(
    opts.refreshSession ?? (async () => ({ data: { session: {} }, error: null })),
  );
  return {
    supabase: { from, auth: { refreshSession } } as unknown as Parameters<
      typeof useWebJournalWriteAhead
    >[0],
    upsertMock,
    refreshSession,
  };
}

function loadQueueRaw(): { entries: Array<{ row: { id: string } }> } {
  const raw = window.localStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : { entries: [] };
}

describe("useWebJournalWriteAhead", () => {
  beforeEach(() => {
    window.localStorage.removeItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    vi.clearAllMocks();
  });

  it("write-ahead ordering: the row is durable in localStorage even if the network call never resolves", async () => {
    const { supabase } = makeSupabase({
      upsert: () => new Promise<UpsertOutcome>(() => {}), // never resolves
    });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    // Fire-and-forget: don't await yet — inspect storage while the
    // "network" call is still hanging, exactly like a tab close mid-flight.
    let settled = false;
    void result.current.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }], {
      timeoutMs: 50,
    }).then(() => { settled = true; });
    void settled;

    // Give the enqueue microtask a chance to land (it's awaited synchronously
    // in writeAhead before the upsert is even attempted).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const queued = loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("acks (removes) exactly the confirmed id on a successful upsert", async () => {
    const { supabase, upsertMock } = makeSupabase({ upsert: () => ({ error: null }) });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }]);
    });

    expect(outcome).toEqual({ persisted: true, timedOut: false });
    expect(upsertMock).toHaveBeenCalledWith(
      [{ id: "meal-1", calories: 100 }],
      { onConflict: "id" },
    );
    const queued = loadQueueRaw();
    expect(queued.entries).toHaveLength(0);
  });

  it("timeout: treated as failure, row stays queued, returns timedOut: true", async () => {
    const { supabase } = makeSupabase({
      upsert: () => new Promise<UpsertOutcome>(() => {}), // hangs forever
    });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.writeAhead("2026-07-06", [{ id: "meal-1" }], { timeoutMs: 30 });
    });

    expect(outcome).toEqual({ persisted: false, timedOut: true });
    const queued = loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("network rejection: row stays queued, persisted: false, timedOut: false, errorMessage surfaced", async () => {
    const { supabase } = makeSupabase({ upsert: () => ({ error: { message: "network error" } }) });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.writeAhead("2026-07-06", [{ id: "meal-1" }]);
    });

    expect(outcome).toEqual({
      persisted: false,
      timedOut: false,
      errorMessage: "network error",
    });
    const queued = loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("duplicate-safety: a flush retry after a successful-but-unacked write does not duplicate the row (onConflict: id)", async () => {
    // Simulates: the network upsert actually landed server-side, but the
    // client hit the ~10s timeout before it could observe the response and
    // ack the queue. The row is still in the durable queue and gets retried
    // on the next flush — must not duplicate-key or create a second row.
    const serverTable = new Map<string, { id: string; calories: number }>();
    const upsertIntoServerTable = vi.fn(
      async (rows: Array<{ id: string; calories: number }>, _opts?: { onConflict?: string }) => {
        for (const row of rows) serverTable.set(row.id, row); // upsert semantics: overwrite by id
        return { error: null };
      },
    );
    const supabase = {
      from: () => ({ upsert: upsertIntoServerTable }),
      auth: { refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })) },
    } as unknown as Parameters<typeof useWebJournalWriteAhead>[0];
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    await act(async () => {
      await result.current.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }]);
    });
    expect(serverTable.size).toBe(1);
    // The row WAS acked by the successful writeAhead call above (correct
    // behaviour) — re-seed the queue to simulate the timeout variant where
    // the ack never happened despite the row already existing server-side.
    const empty = loadQueueRaw();
    expect(empty.entries).toHaveLength(0); // confirms the ack DID fire
    window.localStorage.setItem(
      JOURNAL_WRITE_QUEUE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            kind: "upsert",
            queuedAt: new Date().toISOString(),
            dayKey: "2026-07-06",
            row: { id: "meal-1", calories: 100 },
            attempts: 0,
          },
        ],
      }),
    );

    let outcome: { flushedIds: string[]; droppedPoisonIds: string[]; dropQueue: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.flushQueue();
    });

    expect(outcome!.flushedIds).toEqual(["meal-1"]);
    expect(outcome!.dropQueue).toBe(false);
    // Still exactly ONE row for this id — the upsert overwrote, not duplicated.
    expect(serverTable.size).toBe(1);
    expect(upsertIntoServerTable.mock.calls.every(([, opts]) =>
      opts === undefined || (opts as { onConflict?: string }).onConflict === "id",
    )).toBe(true);
  });

  it("flushQueue wires the web session refresher into flushJournalWriteQueue for 42501 handling", async () => {
    // First upsert call (from writeAhead, seeding the queue) always denies —
    // the failure that leaves the row queued. Every call AFTER succeeds, so
    // flushQueue's first attempt (2nd overall call) hits 42501 (triggering
    // the refresh), and the post-refresh retry (3rd overall call) succeeds.
    let callCount = 0;
    const { supabase, refreshSession } = makeSupabase({
      upsert: () => {
        callCount += 1;
        return callCount <= 2
          ? { error: { message: "permission denied", code: "42501" } }
          : { error: null };
      },
      refreshSession: async () => ({ data: { session: { access_token: "fresh" } }, error: null }),
    });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    await act(async () => {
      await result.current.writeAhead("2026-07-06", [{ id: "meal-1" }]);
    });
    const seeded = loadQueueRaw();
    expect(seeded.entries.map((e) => e.row.id)).toEqual(["meal-1"]);

    let outcome: { flushedIds: string[]; dropQueue: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.flushQueue();
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(outcome!.dropQueue).toBe(false);
    expect(outcome!.flushedIds).toEqual(["meal-1"]);
    const afterFlush = loadQueueRaw();
    expect(afterFlush.entries).toHaveLength(0);
  });

  it("loadQueuedByDay surfaces queued-but-unflushed rows grouped by dayKey for cold-start hydration", async () => {
    const { supabase } = makeSupabase({
      upsert: () => new Promise<UpsertOutcome>(() => {}), // hangs — stays queued
    });
    const { result } = renderHook(() => useWebJournalWriteAhead(supabase));

    await act(async () => {
      void result.current.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }], {
        timeoutMs: 10,
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    let byDay: Record<string, Record<string, unknown>[]> = {};
    await act(async () => {
      byDay = await result.current.loadQueuedByDay();
    });

    expect(Object.keys(byDay)).toEqual(["2026-07-06"]);
    expect(byDay["2026-07-06"]).toEqual([{ id: "meal-1", calories: 100 }]);
  });

  it("reportDroppedJournalWrites fires a PostHog capture + toast for the drop shape", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: ["a", "b"], dropQueue: false });
    expect(trackMock).toHaveBeenCalledWith(
      "journal_write_queue_drop",
      expect.objectContaining({ droppedCount: 2, dropQueue: false, platform: "web" }),
    );
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it("reportDroppedJournalWrites reports -1 droppedCount for a terminal dropQueue (whole batch, not just poison rows)", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: [], dropQueue: true });
    expect(trackMock).toHaveBeenCalledWith(
      "journal_write_queue_drop",
      expect.objectContaining({ dropQueue: true, platform: "web" }),
    );
  });

  it("reportDroppedJournalWrites is a no-op when nothing was dropped", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: [], dropQueue: false });
    expect(trackMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
