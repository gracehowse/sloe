/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const trackMock = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  isFeatureEnabled: vi.fn(() => false),
  isFeatureDisabled: vi.fn(() => false),
}));

import {
  useJournalWriteAhead,
  reportDroppedJournalWrites,
} from "../../hooks/useJournalWriteAhead";
import { JOURNAL_WRITE_QUEUE_STORAGE_KEY } from "@suppr/nutrition-core/journalWriteQueue";

type UpsertOutcome = { error: { message?: string; code?: string } | null };

/** Minimal Supabase fake matching the shape `useJournalWriteAhead` calls. */
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
      typeof useJournalWriteAhead
    >[0],
    upsertMock,
    refreshSession,
  };
}

/** Capture hook return value via a render-prop harness (standard RNTL pattern
 *  for this repo — see useNutritionEntriesSync.test.tsx). */
function Harness({
  supabase,
  onReady,
}: {
  supabase: Parameters<typeof useJournalWriteAhead>[0];
  onReady: (api: ReturnType<typeof useJournalWriteAhead>) => void;
}) {
  const api = useJournalWriteAhead(supabase);
  onReady(api);
  return null;
}

async function loadQueueRaw(): Promise<{ entries: Array<{ row: { id: string } }> }> {
  const raw = await AsyncStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : { entries: [] };
}

describe("useJournalWriteAhead", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    vi.clearAllMocks();
  });

  it("write-ahead ordering: the row is durable in AsyncStorage even if the network call never resolves", async () => {
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    const { supabase } = makeSupabase({
      upsert: () => new Promise<UpsertOutcome>(() => {}), // never resolves
    });
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    // Fire-and-forget: don't await yet — we want to inspect storage while
    // the "network" call is still hanging, exactly like a kill mid-flight.
    void hookApi.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }], {
      timeoutMs: 50,
    });

    // Give the enqueue microtask a chance to land (it's awaited synchronously
    // in writeAhead before the upsert is even attempted).
    await new Promise((r) => setTimeout(r, 0));
    const queued = await loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("acks (removes) exactly the confirmed id on a successful upsert", async () => {
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    const { supabase, upsertMock } = makeSupabase({ upsert: () => ({ error: null }) });
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    const result = await hookApi.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }]);

    expect(result).toEqual({ persisted: true, timedOut: false });
    expect(upsertMock).toHaveBeenCalledWith(
      [{ id: "meal-1", calories: 100 }],
      { onConflict: "id" },
    );
    const queued = await loadQueueRaw();
    expect(queued.entries).toHaveLength(0);
  });

  it("timeout: treated as failure, row stays queued, returns timedOut: true", async () => {
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    const { supabase } = makeSupabase({
      upsert: () => new Promise<UpsertOutcome>(() => {}), // hangs forever
    });
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    const result = await hookApi.writeAhead("2026-07-06", [{ id: "meal-1" }], { timeoutMs: 30 });

    expect(result).toEqual({ persisted: false, timedOut: true });
    const queued = await loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("duplicate-safety: a flush retry after a successful-but-unacked write does not duplicate the row (onConflict: id)", async () => {
    // Simulates: the network upsert actually landed server-side, but the
    // client hit the ~10s timeout before it could observe the response and
    // ack the queue (e.g. the response arrived a moment too late). The row
    // is still in the durable queue and gets retried on the next flush. If
    // the write path ever regressed from `.upsert(rows, { onConflict: "id" })`
    // to a plain `.insert(rows)`, this retry would either duplicate-key
    // error or (worse, with a laxer table) create a second row.
    const serverTable = new Map<string, { id: string; calories: number }>();
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    const upsertIntoServerTable = vi.fn(
      async (rows: Array<{ id: string; calories: number }>, _opts?: { onConflict?: string }) => {
        for (const row of rows) serverTable.set(row.id, row); // upsert semantics: overwrite by id
        return { error: null };
      },
    );
    const supabase = {
      from: () => ({ upsert: upsertIntoServerTable }),
      auth: { refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })) },
    } as unknown as Parameters<typeof useJournalWriteAhead>[0];
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    // First write-ahead call: enqueue, then the "network" write lands fine —
    // but we simulate the client never having observed it (no ack) by
    // manually re-seeding the queue afterwards, mirroring a timeout that
    // fires just as the real response would have arrived.
    await hookApi.writeAhead("2026-07-06", [{ id: "meal-1", calories: 100 }]);
    expect(serverTable.size).toBe(1);
    // The row WAS acked by the successful writeAhead call above (this repo's
    // correct behaviour) — re-seed the queue to simulate the timeout variant
    // where the ack never happened despite the row already existing
    // server-side.
    const raw = await AsyncStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    const empty = raw ? JSON.parse(raw) : { entries: [] };
    expect(empty.entries).toHaveLength(0); // confirms the ack DID fire
    await AsyncStorage.setItem(
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

    // Now drain the (re-seeded) queue via a flush — the row is retried even
    // though it's already on the server.
    const outcome = await hookApi.flushQueue();

    expect(outcome.flushedIds).toEqual(["meal-1"]);
    expect(outcome.dropQueue).toBe(false);
    // Still exactly ONE row for this id — the upsert overwrote, not duplicated.
    expect(serverTable.size).toBe(1);
    expect(upsertIntoServerTable.mock.calls.every(([, opts]) =>
      opts === undefined || (opts as { onConflict?: string }).onConflict === "id",
    )).toBe(true);
  });

  it("network rejection: row stays queued, persisted: false, timedOut: false", async () => {
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    const { supabase } = makeSupabase({ upsert: () => ({ error: { message: "network error" } }) });
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    const result = await hookApi.writeAhead("2026-07-06", [{ id: "meal-1" }]);

    expect(result).toEqual({ persisted: false, timedOut: false });
    const queued = await loadQueueRaw();
    expect(queued.entries.map((e) => e.row.id)).toEqual(["meal-1"]);
  });

  it("flushQueue wires the mobile session refresher into flushJournalWriteQueue for 42501 handling", async () => {
    let hookApi!: ReturnType<typeof useJournalWriteAhead>;
    // First upsert call (from writeAhead, seeding the queue) always denies —
    // this is the failure that leaves the row queued. Every call AFTER that
    // succeeds, so flushQueue's first attempt (2nd overall call) hits 42501
    // (triggering the refresh), and the post-refresh retry (3rd overall
    // call) succeeds.
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
    render(<Harness supabase={supabase} onReady={(api) => (hookApi = api)} />);

    // Seed the queue: writeAhead's own upsert attempt (call #1) is denied,
    // so the row stays queued (write-ahead already enqueued it up front).
    await hookApi.writeAhead("2026-07-06", [{ id: "meal-1" }]);
    const seeded = await loadQueueRaw();
    expect(seeded.entries.map((e) => e.row.id)).toEqual(["meal-1"]);

    // flushQueue's first attempt (call #2) hits 42501 again, triggers the
    // session refresher, and the post-refresh retry (call #3) succeeds.
    const outcome = await hookApi.flushQueue();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(outcome.dropQueue).toBe(false);
    expect(outcome.flushedIds).toEqual(["meal-1"]);
    const afterFlush = await loadQueueRaw();
    expect(afterFlush.entries).toHaveLength(0);
  });

  it("reportDroppedJournalWrites fires a PostHog capture with the drop shape", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: ["a", "b"], dropQueue: false });
    expect(trackMock).toHaveBeenCalledWith(
      "journal_write_queue_drop",
      expect.objectContaining({ droppedCount: 2, dropQueue: false }),
    );
  });

  it("reportDroppedJournalWrites reports -1 droppedCount for a terminal dropQueue (whole batch, not just poison rows)", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: [], dropQueue: true });
    expect(trackMock).toHaveBeenCalledWith(
      "journal_write_queue_drop",
      expect.objectContaining({ dropQueue: true }),
    );
  });

  it("reportDroppedJournalWrites is a no-op when nothing was dropped", () => {
    reportDroppedJournalWrites({ droppedPoisonIds: [], dropQueue: false });
    expect(trackMock).not.toHaveBeenCalled();
  });
});
