/**
 * F-13 (2026-04-19) — `updateStimulantsForDay` keeps
 * `profiles.extra_caffeine_by_day` and `profiles.extra_alcohol_g_by_day`
 * in sync with every successful `nutrition_entries` insert / delete.
 *
 * Covered:
 *  - increments the correct day by a proportional delta
 *  - decrements on delete (negative delta)
 *  - treats a missing / null / malformed map as `{}` (defensive)
 *  - clamps at 0 — a stale delete can never push the total negative
 *  - caffeine rounds to integer mg; alcohol rounds to 1 dp g
 *  - independent delta axes (only caffeine → only alcohol column changes)
 *  - zero-delta → no Supabase round-trip at all (hot-path cheapness)
 *  - read / write errors bubble up as `{ ok: false }` so the caller
 *    can log but the preceding `nutrition_entries` row is untouched
 */
import { describe, it, expect, vi } from "vitest";
import { updateStimulantsForDay } from "@/lib/nutrition/updateStimulantsForDay";

type Row = {
  extra_caffeine_by_day: Record<string, number> | null | unknown;
  extra_alcohol_g_by_day: Record<string, number> | null | unknown;
};

/** In-memory Supabase-shaped fake with the two columns under test. */
function makeSupabase(initial: Row, opts?: {
  readError?: { message?: string } | null;
  writeError?: { message?: string } | null;
  trackCalls?: (update: Record<string, unknown>) => void;
}) {
  let row = { ...initial };
  return {
    state: () => row,
    client: {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({
              data: opts?.readError ? null : row,
              error: opts?.readError ?? null,
            }),
          }),
        }),
        update: (update: Record<string, unknown>) => {
          opts?.trackCalls?.(update);
          if (!opts?.writeError) {
            if ("extra_caffeine_by_day" in update) {
              row.extra_caffeine_by_day = update.extra_caffeine_by_day as Record<string, number>;
            }
            if ("extra_alcohol_g_by_day" in update) {
              row.extra_alcohol_g_by_day = update.extra_alcohol_g_by_day as Record<string, number>;
            }
          }
          return {
            eq: async (_col: string, _val: string) => ({
              error: opts?.writeError ?? null,
            }),
          };
        },
      }),
    },
  };
}

describe("updateStimulantsForDay", () => {
  it("increments the correct day by the delta (insert)", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": 50 },
      extra_alcohol_g_by_day: {},
    });
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 80,
      alcoholG: 0,
    });
    expect(res).toEqual({ ok: true, caffeineMg: 130, alcoholG: 0 });
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-19": 130 });
  });

  it("decrements on delete (negative delta)", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": 120 },
      extra_alcohol_g_by_day: { "2026-04-19": 14.3 },
    });
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: -64,
      alcoholG: -7.2,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.caffeineMg).toBe(56);
      expect(res.alcoholG).toBe(7.1);
    }
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-19": 56 });
    expect(state().extra_alcohol_g_by_day).toEqual({ "2026-04-19": 7.1 });
  });

  it("missing column value is treated as 0 (defensive)", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: null,
      extra_alcohol_g_by_day: undefined as unknown,
    });
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 30,
      alcoholG: 2,
    });
    expect(res.ok).toBe(true);
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-19": 30 });
    expect(state().extra_alcohol_g_by_day).toEqual({ "2026-04-19": 2 });
  });

  it("clamps at 0 when a decrement would push below zero", async () => {
    // A stale delete arriving after the map was already zeroed must
    // not mint a negative.
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": 10 },
      extra_alcohol_g_by_day: {},
    });
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: -50,
      alcoholG: 0,
    });
    expect(res.ok).toBe(true);
    // Zero dayValue drops the key entirely (keeps the map clean).
    expect(state().extra_caffeine_by_day).toEqual({});
  });

  it("drops map entries that reach 0 so the object stays lean", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": 64, "2026-04-18": 95 },
      extra_alcohol_g_by_day: {},
    });
    await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: -64,
      alcoholG: 0,
    });
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-18": 95 });
  });

  it("ignores malformed map entries on read (non-number, negative)", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": "not a number", "bad-key": 50, "2026-04-18": -5 } as unknown,
      extra_alcohol_g_by_day: {},
    });
    await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 10,
      alcoholG: 0,
    });
    // Only the new write lands; the "bad-key" and negative are dropped.
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-19": 10 });
  });

  it("zero-delta call skips the Supabase round-trip entirely", async () => {
    const trackCalls = vi.fn<(update: Record<string, unknown>) => void>();
    const { client } = makeSupabase(
      { extra_caffeine_by_day: { "2026-04-19": 50 }, extra_alcohol_g_by_day: {} },
      { trackCalls },
    );
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 0,
      alcoholG: 0,
    });
    expect(res.ok).toBe(true);
    expect(trackCalls).not.toHaveBeenCalled();
  });

  it("independent columns — caffeine-only delta does not touch alcohol map", async () => {
    const trackCalls = vi.fn<(update: Record<string, unknown>) => void>();
    const { client } = makeSupabase(
      {
        extra_caffeine_by_day: {},
        extra_alcohol_g_by_day: { "2026-04-19": 7 },
      },
      { trackCalls },
    );
    await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 40,
      alcoholG: 0,
    });
    expect(trackCalls).toHaveBeenCalledTimes(1);
    const [payload] = trackCalls.mock.calls[0]!;
    expect("extra_caffeine_by_day" in payload).toBe(true);
    expect("extra_alcohol_g_by_day" in payload).toBe(false);
  });

  it("invalid date key → ok:false, no write", async () => {
    const trackCalls = vi.fn<(update: Record<string, unknown>) => void>();
    const { client } = makeSupabase(
      { extra_caffeine_by_day: {}, extra_alcohol_g_by_day: {} },
      { trackCalls },
    );
    const res = await updateStimulantsForDay(client as any, "user-1", "not-a-date", {
      caffeineMg: 40,
      alcoholG: 0,
    });
    expect(res.ok).toBe(false);
    expect(trackCalls).not.toHaveBeenCalled();
  });

  it("missing user id → ok:false, no write", async () => {
    const trackCalls = vi.fn<(update: Record<string, unknown>) => void>();
    const { client } = makeSupabase(
      { extra_caffeine_by_day: {}, extra_alcohol_g_by_day: {} },
      { trackCalls },
    );
    const res = await updateStimulantsForDay(client as any, "", "2026-04-19", {
      caffeineMg: 40,
      alcoholG: 0,
    });
    expect(res.ok).toBe(false);
    expect(trackCalls).not.toHaveBeenCalled();
  });

  it("surfaces read errors as ok:false (caller logs, no rollback)", async () => {
    const { client } = makeSupabase(
      { extra_caffeine_by_day: {}, extra_alcohol_g_by_day: {} },
      { readError: { message: "boom" } },
    );
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 40,
      alcoholG: 0,
    });
    expect(res).toEqual({ ok: false, error: "boom" });
  });

  it("surfaces write errors as ok:false", async () => {
    const { client } = makeSupabase(
      { extra_caffeine_by_day: {}, extra_alcohol_g_by_day: {} },
      { writeError: { message: "network" } },
    );
    const res = await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 40,
      alcoholG: 0,
    });
    expect(res).toEqual({ ok: false, error: "network" });
  });

  it("alcohol rounds to 1 dp g on the day total", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: {},
      extra_alcohol_g_by_day: { "2026-04-19": 9.1 },
    });
    await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 0,
      alcoholG: 5.25, // + 5.25 → 14.35 → rounds to 14.4
    });
    expect(state().extra_alcohol_g_by_day).toEqual({ "2026-04-19": 14.4 });
  });

  it("caffeine rounds to integer mg on the day total", async () => {
    const { client, state } = makeSupabase({
      extra_caffeine_by_day: { "2026-04-19": 50.4 } as unknown as Record<string, number>,
      extra_alcohol_g_by_day: {},
    });
    await updateStimulantsForDay(client as any, "user-1", "2026-04-19", {
      caffeineMg: 9.6,
      alcoholG: 0,
    });
    // 50.4 + 9.6 = 60.0 exactly — assert the stored value is an integer.
    expect(state().extra_caffeine_by_day).toEqual({ "2026-04-19": 60 });
  });
});
