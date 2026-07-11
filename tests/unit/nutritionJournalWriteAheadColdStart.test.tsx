/**
 * ENG-1466 — integration-level kill-reload simulation for
 * `useNutritionJournalState`'s write-ahead wiring (web port of mobile's
 * ENG-1447 P0 fix: "relaunch silently reverts a committed food log").
 *
 * The primitive-level ordering (enqueue -> ack -> merge) is already proven
 * against an in-memory queue in `tests/unit/journalWriteAhead.test.ts`
 * ("kill-relaunch simulation" describe block). This file closes the loop
 * end-to-end through the REAL web wiring: `useNutritionJournalState`'s load
 * effect + `useWebJournalWriteAhead`'s `writeAhead`, against real jsdom
 * `localStorage` (the same storage `journalWriteQueueStorage.web.ts` uses in
 * production), proving the web integration — not just the shared lib —
 * survives a simulated crash.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
void React;

import { JOURNAL_WRITE_QUEUE_STORAGE_KEY } from "../../src/lib/nutrition/journalWriteQueue";

type UpsertOutcome = { error: { message?: string } | null };

/** Table-aware fake matching `nutritionJournalBulkInsert.test.tsx`'s shape. */
function makeSupabaseFake(opts: {
  upsertNutritionEntries: () => UpsertOutcome | Promise<UpsertOutcome>;
  selectRows?: Array<Record<string, unknown>>;
}) {
  return {
    from: (table: string) => ({
      select: (_cols?: string) => {
        const rows = table === "nutrition_entries" ? opts.selectRows ?? [] : [];
        const result = Promise.resolve({ data: rows, error: null });
        const chain: any = {
          limit: () => result,
          eq: () => chain,
          gte: () => chain,
          order: () => result,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      upsert: (_rows: unknown, _opts2?: unknown) => {
        if (table === "nutrition_entries") return Promise.resolve(opts.upsertNutritionEntries());
        return Promise.resolve({ error: null });
      },
      insert: (_rows: unknown) => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
}

vi.mock("../../src/lib/analytics/track.ts", () => ({ track: vi.fn(), isFeatureEnabled: () => false }));
vi.mock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(() => Promise.resolve()),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("../../src/context/appData/useRetryEnableDbTable.ts", () => ({
  useRetryEnableDbTable: () => {},
}));

describe("useNutritionJournalState — write-ahead kill-reload simulation (web)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("enqueue -> no ack (upsert never resolves, simulating a tab close) -> fresh mount hydrates the queued row", async () => {
    // "Session 1": the upsert hangs forever — the write is enqueued to
    // localStorage but never acked, simulating the tab closing/crashing
    // before the network round-trip resolves.
    vi.doMock("../../src/lib/supabase/browserClient.ts", () => ({
      supabase: makeSupabaseFake({
        upsertNutritionEntries: () => new Promise<UpsertOutcome>(() => {}),
        selectRows: [],
      }),
    }));
    const { useNutritionJournalState: useNJS1 } = await import(
      "../../src/context/appData/useNutritionJournalState"
    );

    const { result: session1 } = renderHook(() =>
      useNJS1({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-07-06",
      }),
    );

    await act(async () => {
      session1.current.addLoggedMealForDate("2026-07-06", {
        name: "Emergency snack",
        recipeTitle: "Emergency snack",
        time: "Snacks",
        calories: 150,
        protein: 5,
        carbs: 20,
        fat: 4,
      });
      // Flush the enqueue microtask (writeAhead awaits it before the
      // never-resolving upsert starts) without waiting on the hung upsert.
      await Promise.resolve();
      await Promise.resolve();
    });

    // The row is durable in localStorage even though the upsert never
    // resolved — this IS the write-ahead guarantee.
    const rawQueue = window.localStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    expect(rawQueue).toBeTruthy();
    const queue = JSON.parse(rawQueue!);
    expect(queue.entries).toHaveLength(1);
    expect(queue.entries[0].row.name).toBe("Emergency snack");

    // "Relaunch": simulate a crash by resetting modules and re-importing the
    // hook fresh (new closures, matching a real reload's blank-slate JS
    // state), then mount a brand-new instance with EMPTY initialByDay and a
    // server snapshot that (correctly) does not have the row yet either —
    // the network write never actually landed.
    vi.resetModules();
    vi.doMock("../../src/lib/supabase/browserClient.ts", () => ({
      supabase: makeSupabaseFake({
        upsertNutritionEntries: () => ({ error: null }),
        selectRows: [], // server never saw the row — the original upsert never landed
      }),
    }));
    const { useNutritionJournalState: useNJS2 } = await import(
      "../../src/context/appData/useNutritionJournalState"
    );

    const { result: session2 } = renderHook(() =>
      useNJS2({
        authedUserId: "user-1",
        initialByDay: {}, // genuinely empty — nothing survives a real kill except storage
        selectedDateKey: "2026-07-06",
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

    // The meal is visible after "relaunch" — hydrated from the write-ahead
    // queue, not lost. This is the ENG-1447/ENG-1466 P0 regression this
    // whole fix exists to prevent.
    const day = session2.current.nutritionByDay["2026-07-06"] ?? [];
    expect(day.map((m) => m.name)).toContain("Emergency snack");
  });

  it("enqueue -> ack (upsert succeeds) -> fresh mount does NOT duplicate the row", async () => {
    vi.doMock("../../src/lib/supabase/browserClient.ts", () => ({
      supabase: makeSupabaseFake({
        upsertNutritionEntries: () => ({ error: null }), // succeeds immediately
        selectRows: [],
      }),
    }));
    const { useNutritionJournalState: useNJS1 } = await import(
      "../../src/context/appData/useNutritionJournalState"
    );

    const { result: session1 } = renderHook(() =>
      useNJS1({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-07-06",
      }),
    );

    await act(async () => {
      session1.current.addLoggedMealForDate("2026-07-06", {
        name: "Confirmed snack",
        recipeTitle: "Confirmed snack",
        time: "Snacks",
        calories: 150,
        protein: 5,
        carbs: 20,
        fat: 4,
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Acked — the queue is empty because the upsert confirmed.
    const rawQueue = window.localStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : { entries: [] };
    expect(queue.entries ?? []).toHaveLength(0);

    // "Relaunch": fresh mount, server snapshot NOW has the row (the upsert
    // really did land server-side).
    vi.resetModules();
    vi.doMock("../../src/lib/supabase/browserClient.ts", () => ({
      supabase: makeSupabaseFake({
        upsertNutritionEntries: () => ({ error: null }),
        selectRows: [
          {
            id: "server-row-1",
            date_key: "2026-07-06",
            name: "Confirmed snack",
            recipe_title: "Confirmed snack",
            time_label: "Snacks",
            calories: 150,
            protein: 5,
            carbs: 20,
            fat: 4,
            fiber_g: null,
            water_ml: null,
            portion_multiplier: 1,
            source: "manual",
            nutrition_micros: {},
            recipe_id: null,
            eaten_at: "2026-07-06T12:00:00.000Z",
            created_at: "2026-07-06T12:00:00.000Z",
          },
        ],
      }),
    }));
    const { useNutritionJournalState: useNJS2 } = await import(
      "../../src/context/appData/useNutritionJournalState"
    );

    const { result: session2 } = renderHook(() =>
      useNJS2({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-07-06",
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

    const day = session2.current.nutritionByDay["2026-07-06"] ?? [];
    const matches = day.filter((m) => m.name === "Confirmed snack");
    // Exactly ONE row — the empty queue + server snapshot did not double it up.
    expect(matches).toHaveLength(1);
  });
});
