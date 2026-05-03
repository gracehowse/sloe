/**
 * Tracking-extras autoupdate (2026-05-02) — central `bumpStimulantsForLoggedMeal`
 * helper that any meal-log commit path can call to bump the daily caffeine
 * + alcohol totals on `profiles`.
 *
 * Covered:
 *  - reads `caffeineMg` / `alcoholG` from `meal.micros` (canonical home)
 *  - falls back to top-level fields (legacy / synthetic shapes, e.g. AI items)
 *  - skips supabase round-trip entirely when both values are 0 / missing
 *  - skips supabase round-trip when both values are non-finite / negative
 *  - forwards positive values to `updateStimulantsForDay` unchanged
 *  - bulk variant sums across an array and rounds correctly
 *  - bulk variant skips round-trip when ALL meals are stimulant-free
 *  - bulk variant integer caffeine + 1dp alcohol rounding matches
 *    `updateStimulantsForDay`'s single-meal expectation
 */
import { describe, it, expect, vi } from "vitest";
import {
  bumpStimulantsForLoggedMeal,
  bumpStimulantsForLoggedMeals,
  readStimulantBumpFromMeal,
  readStimulantBumpFromMeals,
} from "@/lib/nutrition/bumpStimulantsForLoggedMeal";

type CapturedUpdate = Record<string, unknown> | null;

function makeSupabase(initial: {
  caff: Record<string, number>;
  alc: Record<string, number>;
}) {
  let captured: CapturedUpdate = null;
  let updateCallCount = 0;
  let readCallCount = 0;
  return {
    captured: () => captured,
    updateCallCount: () => updateCallCount,
    readCallCount: () => readCallCount,
    client: {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => {
              readCallCount += 1;
              return {
                data: {
                  extra_caffeine_by_day: initial.caff,
                  extra_alcohol_g_by_day: initial.alc,
                },
                error: null,
              };
            },
          }),
        }),
        update: (u: Record<string, unknown>) => {
          captured = u;
          updateCallCount += 1;
          return {
            eq: async (_col: string, _val: string) => ({ error: null }),
          };
        },
      }),
    },
  };
}

describe("readStimulantBumpFromMeal", () => {
  it("reads from meal.micros when present", () => {
    expect(
      readStimulantBumpFromMeal({
        micros: { caffeineMg: 95, alcoholG: 0 },
      }),
    ).toEqual({ caffeineMg: 95, alcoholG: 0 });
  });

  it("falls back to top-level fields when micros is missing", () => {
    expect(
      readStimulantBumpFromMeal({ caffeineMg: 80, alcoholG: 14 }),
    ).toEqual({ caffeineMg: 80, alcoholG: 14 });
  });

  it("prefers micros over top-level when both are present", () => {
    expect(
      readStimulantBumpFromMeal({
        micros: { caffeineMg: 95, alcoholG: 14 },
        caffeineMg: 9999, // ignored — micros wins
        alcoholG: 9999,
      }),
    ).toEqual({ caffeineMg: 95, alcoholG: 14 });
  });

  it("returns 0 / 0 for an empty meal", () => {
    expect(readStimulantBumpFromMeal({})).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("rejects non-finite + negative values (no inventing)", () => {
    expect(
      readStimulantBumpFromMeal({
        micros: { caffeineMg: NaN, alcoholG: -3 } as unknown as Record<string, number>,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });
});

describe("readStimulantBumpFromMeals", () => {
  it("sums caffeine + alcohol across an array", () => {
    const sum = readStimulantBumpFromMeals([
      { micros: { caffeineMg: 80, alcoholG: 0 } },
      { micros: { caffeineMg: 0, alcoholG: 14 } },
      { micros: { caffeineMg: 120, alcoholG: 14 } },
    ]);
    expect(sum).toEqual({ caffeineMg: 200, alcoholG: 28 });
  });

  it("rounds caffeine to integer mg + alcohol to 1 dp g", () => {
    const sum = readStimulantBumpFromMeals([
      { micros: { caffeineMg: 0.4 } },
      { micros: { caffeineMg: 0.4 } },
      // 0.8 rounds to 1
      { micros: { alcoholG: 1.234 } },
      { micros: { alcoholG: 1.234 } },
      // 2.468 rounds to 2.5
    ]);
    expect(sum).toEqual({ caffeineMg: 1, alcoholG: 2.5 });
  });

  it("returns 0 / 0 for an empty array", () => {
    expect(readStimulantBumpFromMeals([])).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("ignores stimulant-free meals", () => {
    const sum = readStimulantBumpFromMeals([
      { calories: 400 } as unknown as { micros?: Record<string, number> },
      { calories: 200 } as unknown as { micros?: Record<string, number> },
    ]);
    expect(sum).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });
});

describe("bumpStimulantsForLoggedMeal — single-meal bump", () => {
  it("bumps daily totals when meal.micros has caffeine", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeal(
      sb.client as any,
      "user-1",
      "2026-05-02",
      { micros: { caffeineMg: 95 } },
    );
    expect(res).toEqual({ ok: true, caffeineMg: 95, alcoholG: 0 });
    expect(sb.updateCallCount()).toBe(1);
    expect((sb.captured() as Record<string, unknown>).extra_caffeine_by_day).toEqual({
      "2026-05-02": 95,
    });
  });

  it("bumps daily totals when meal.micros has alcohol", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeal(
      sb.client as any,
      "user-1",
      "2026-05-02",
      { micros: { alcoholG: 14 } },
    );
    expect(res).toEqual({ ok: true, caffeineMg: 0, alcoholG: 14 });
    expect((sb.captured() as Record<string, unknown>).extra_alcohol_g_by_day).toEqual({
      "2026-05-02": 14,
    });
  });

  it("skips supabase entirely when both values are 0 / missing", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeal(
      sb.client as any,
      "user-1",
      "2026-05-02",
      { calories: 400 } as unknown as { micros?: Record<string, number> },
    );
    expect(res).toEqual({ ok: true, caffeineMg: 0, alcoholG: 0 });
    expect(sb.updateCallCount()).toBe(0);
    expect(sb.readCallCount()).toBe(0);
  });

  it("skips supabase when caffeine is non-finite", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeal(
      sb.client as any,
      "user-1",
      "2026-05-02",
      { micros: { caffeineMg: NaN } as unknown as Record<string, number> },
    );
    expect(res).toEqual({ ok: true, caffeineMg: 0, alcoholG: 0 });
    expect(sb.updateCallCount()).toBe(0);
  });

  it("forwards top-level fields when micros is missing (AI-item shape)", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeal(
      sb.client as any,
      "user-1",
      "2026-05-02",
      { caffeineMg: 190, alcoholG: 0 },
    );
    expect(res).toEqual({ ok: true, caffeineMg: 190, alcoholG: 0 });
    expect((sb.captured() as Record<string, unknown>).extra_caffeine_by_day).toEqual({
      "2026-05-02": 190,
    });
  });
});

describe("bumpStimulantsForLoggedMeals — bulk bump", () => {
  it("sums across the array and fires ONE supabase write", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeals(
      sb.client as any,
      "user-1",
      "2026-05-02",
      [
        { micros: { caffeineMg: 80 } },
        { micros: { caffeineMg: 120 } },
        { micros: { alcoholG: 14 } },
      ],
    );
    expect(res).toEqual({ ok: true, caffeineMg: 200, alcoholG: 14 });
    expect(sb.updateCallCount()).toBe(1);
  });

  it("skips supabase entirely when ALL meals are stimulant-free", async () => {
    const sb = makeSupabase({ caff: {}, alc: {} });
    const res = await bumpStimulantsForLoggedMeals(
      sb.client as any,
      "user-1",
      "2026-05-02",
      [
        { calories: 400 } as unknown as { micros?: Record<string, number> },
        { calories: 200 } as unknown as { micros?: Record<string, number> },
      ],
    );
    expect(res).toEqual({ ok: true, caffeineMg: 0, alcoholG: 0 });
    expect(sb.updateCallCount()).toBe(0);
    expect(sb.readCallCount()).toBe(0);
  });

  it("preserves existing day totals when bumping from non-zero baseline", async () => {
    const sb = makeSupabase({
      caff: { "2026-05-02": 95 },
      alc: { "2026-05-02": 14 },
    });
    const res = await bumpStimulantsForLoggedMeals(
      sb.client as any,
      "user-1",
      "2026-05-02",
      [{ micros: { caffeineMg: 80, alcoholG: 14 } }],
    );
    expect(res).toEqual({ ok: true, caffeineMg: 175, alcoholG: 28 });
  });
});
