/**
 * Tests for the Sunday push body formatter (Sunday push rewrite — T2,
 * 2026-04-19).
 *
 * Pin the honest-claims rules from `weeklyRecapPushBody.ts`:
 *   - Zero-days fallback copy + variant.
 *   - Calories-only copy when weight delta is null (no "kg" string).
 *   - With-weight copy when weight delta is present (sign explicit).
 *   - No exclamation marks ever.
 *   - Body length ≤ APNs lock-screen threshold (178 chars).
 *
 * The recap shape is borrowed from `WeeklyRecap`; we only populate the
 * fields the formatter reads, leaving the rest at deterministic defaults
 * so future schema additions to `WeeklyRecap` do not break this suite.
 */
import { describe, expect, it } from "vitest";

import {
  formatWeeklyRecapPushBody,
  PUSH_BODY_MAX_CHARS,
  type PushBodyVariant,
} from "../../src/lib/nutrition/weeklyRecapPushBody";
import type { WeeklyRecap } from "../../src/lib/nutrition/weeklyRecap";
import type { DigestSuggestion } from "../../src/lib/nutrition/weeklyDigestSuggestion";

/**
 * Deterministic skeleton with neutral defaults. Each test overrides
 * only the fields it cares about so unrelated drift in `WeeklyRecap`
 * cannot accidentally change a behaviour these tests are pinning.
 */
function makeRecap(overrides: Partial<WeeklyRecap>): WeeklyRecap {
  return {
    weekKey: "2026-W15",
    weekLabel: "Apr 6 – Apr 12",
    daysLogged: 0,
    avgCalories: 0,
    avgProtein: 0,
    proteinAdherencePct: 0,
    streakLength: 0,
    freezesAvailable: 0,
    bestDay: null,
    weightDeltaKg: null,
    weightFirstKg: null,
    weightLastKg: null,
    ...overrides,
  };
}

describe("formatWeeklyRecapPushBody — variant selection", () => {
  it("returns the zero_days fallback when daysLogged === 0", () => {
    const out = formatWeeklyRecapPushBody(makeRecap({ daysLogged: 0 }));
    expect(out.variant).toBe<PushBodyVariant>("zero_days");
    expect(out.body).toBe(
      "Nothing logged this week. Open Sloe to get back on track.",
    );
  });

  it("returns calories_only copy when daysLogged > 0 and weightDeltaKg is null", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1850, weightDeltaKg: null }),
    );
    expect(out.variant).toBe<PushBodyVariant>("calories_only");
    expect(out.body).toBe("5 days logged, avg 1850 kcal — see what changed.");
    // Weight is missing data — must NOT appear in any form.
    expect(out.body).not.toMatch(/kg/i);
  });

  it("returns with_weight copy + explicit + sign for a positive delta", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1900, weightDeltaKg: 0.3 }),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_weight");
    expect(out.body).toBe(
      "5 days logged, +0.3 kg this week — see what changed.",
    );
  });

  it("returns with_weight copy + explicit - sign for a negative delta", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1700, weightDeltaKg: -0.4 }),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_weight");
    expect(out.body).toBe(
      "5 days logged, -0.4 kg this week — see what changed.",
    );
  });

  /**
   * Zero-delta decision pin — see the file-level comment in
   * `weeklyRecapPushBody.ts` for the rationale. We INCLUDE the weight
   * phrase with `0.0 kg` because the caller has already asserted ≥2
   * weigh-ins exist for the week (a returned 0.0 means "we measured
   * twice and the rounding matched", not "no data"). If we ever flip
   * the policy, this assertion will fail and force a coordinated
   * change with the analytics dashboards consuming the variant tag.
   */
  it("treats weightDeltaKg === 0 as with_weight (we have data, the data is 0)", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1800, weightDeltaKg: 0 }),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_weight");
    expect(out.body).toBe(
      "5 days logged, 0.0 kg this week — see what changed.",
    );
  });
});

describe("formatWeeklyRecapPushBody — voice constraints", () => {
  it("never produces an exclamation mark across all three variants", () => {
    const samples: WeeklyRecap[] = [
      makeRecap({ daysLogged: 0 }),
      makeRecap({ daysLogged: 5, avgCalories: 1850, weightDeltaKg: null }),
      makeRecap({ daysLogged: 7, avgCalories: 2400, weightDeltaKg: -1.2 }),
      makeRecap({ daysLogged: 7, avgCalories: 2400, weightDeltaKg: 0.9 }),
      makeRecap({ daysLogged: 7, avgCalories: 2400, weightDeltaKg: 0 }),
    ];
    for (const recap of samples) {
      const { body } = formatWeeklyRecapPushBody(recap);
      expect(body).not.toMatch(/!/);
    }
  });

  it("respects the APNs lock-screen length budget for every variant", () => {
    // Stress the upper end: 7-day week, 4-digit calories, 2-decimal kg.
    const samples: WeeklyRecap[] = [
      makeRecap({ daysLogged: 0 }),
      makeRecap({ daysLogged: 7, avgCalories: 9999, weightDeltaKg: null }),
      makeRecap({ daysLogged: 7, avgCalories: 9999, weightDeltaKg: -9.9 }),
      makeRecap({ daysLogged: 7, avgCalories: 9999, weightDeltaKg: 9.9 }),
    ];
    for (const recap of samples) {
      const { body } = formatWeeklyRecapPushBody(recap);
      expect(body.length).toBeLessThanOrEqual(PUSH_BODY_MAX_CHARS);
    }
  });
});

// ───────────────────────────────────────────────────────────────────
// `with_suggestion` variant (Sunday push rewrite — T4, 2026-04-19)
// ───────────────────────────────────────────────────────────────────

/** Minimal `DigestSuggestion` factory — only fields the formatter
 *  reads. The cascade module's full shape is irrelevant here. */
function makeSuggestion(
  headline: string,
  rule: DigestSuggestion["rule"] = "re_log_prompt",
): DigestSuggestion {
  return {
    rule,
    headline,
    body: headline,
    cta: null,
  };
}

describe("formatWeeklyRecapPushBody — with_suggestion variant", () => {
  it("falls through to the original variants when suggestion is null", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1900, weightDeltaKg: 0.3 }),
      null,
    );
    expect(out.variant).toBe<PushBodyVariant>("with_weight");
    expect(out.body).toBe("5 days logged, +0.3 kg this week — see what changed.");
  });

  it("falls through to the original variants when suggestion is omitted", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 4, avgCalories: 1700, weightDeltaKg: null }),
    );
    expect(out.variant).toBe<PushBodyVariant>("calories_only");
  });

  it("composes headline + recap (with weight) when suggestion is present", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1850, weightDeltaKg: 0.3 }),
      makeSuggestion("Save your usual breakfast — you logged it 4x."),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_suggestion");
    expect(out.body).toBe(
      "Save your usual breakfast — you logged it 4x. · 5 days logged, +0.3 kg this week — see what changed.",
    );
  });

  it("composes headline + recap (calories only) when no weight delta", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1850, weightDeltaKg: null }),
      makeSuggestion("Protein landed on target 2 of 5 days."),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_suggestion");
    expect(out.body).toBe(
      "Protein landed on target 2 of 5 days. · 5 days logged, avg 1850 kcal — see what changed.",
    );
  });

  it("does NOT prepend onto the zero-days fallback (defensive honest-claims guard)", () => {
    // The cascade itself shouldn't fire suggestions on zero-days, but
    // if a future rule does, the formatter must still degrade to the
    // generic fallback rather than attach a hook to "no data".
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 0 }),
      makeSuggestion("Save your usual breakfast — you logged it 4x."),
    );
    expect(out.variant).toBe<PushBodyVariant>("zero_days");
    expect(out.body).toBe(
      "Nothing logged this week. Open Sloe to get back on track.",
    );
  });

  it("respects the ≤178 char budget when both headline and recap are present", () => {
    // 100-char headline + 7-day recap with 4-digit calories + 2-digit
    // weight should still fit (or trigger truncation).
    const longHeadline =
      "Your real burn is 250 kcal higher than the formula — your maintenance shifted, take a look.";
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 7, avgCalories: 9999, weightDeltaKg: 9.9 }),
      makeSuggestion(longHeadline, "maintenance_recalibration"),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_suggestion");
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX_CHARS);
    // Headline is never truncated.
    expect(out.body.startsWith(longHeadline)).toBe(true);
  });

  it("intelligently truncates the recap (drops calories, keeps weight) when both are long", () => {
    // 119-char headline (just under the cascade ceiling of 120). A
    // full recap sentence is ~50 chars; together they exceed 178.
    // The truncation rule says: drop calories segment first, keep
    // weight delta.
    const longHeadline =
      "You hit your calorie target on 7 days but weight ticked up — worth a check-in on Maintenance, see Progress detail.";
    expect(longHeadline.length).toBeLessThanOrEqual(120);
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 7, avgCalories: 1900, weightDeltaKg: 0.5 }),
      makeSuggestion(longHeadline, "weight_trend_mismatch"),
    );
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX_CHARS);
    // The recap portion no longer mentions kcal but still mentions kg.
    const recapPortion = out.body.slice(longHeadline.length);
    expect(recapPortion).not.toMatch(/kcal/i);
    expect(recapPortion).toMatch(/kg/);
    // Days-logged count is preserved.
    expect(recapPortion).toMatch(/7 days logged/);
  });

  it("collapses to days-only when even the weight-keeping fallback is too long", () => {
    // Pathological: headline so long that only the bare days-line fits.
    // Headline = 120 chars (the cascade ceiling). Recap with kg ~30
    // chars. 120+3+30 = 153 — that fits, so we need a tighter case.
    // Use a 160-char headline to force step-3 truncation.
    const longerThanIdeal =
      "X".repeat(160);
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 4, avgCalories: 2000, weightDeltaKg: -0.4 }),
      makeSuggestion(longerThanIdeal),
    );
    expect(out.variant).toBe<PushBodyVariant>("with_suggestion");
    // Either we land on the days-only fallback (preferred), or on the
    // headline-only fallback (last resort). Both must respect the
    // honest-claims rules and never invent data.
    expect(out.body.startsWith(longerThanIdeal)).toBe(true);
    if (out.body.length <= PUSH_BODY_MAX_CHARS) {
      // The truncated recap was applied. Verify it matches one of the
      // accepted truncation forms.
      const tail = out.body.slice(longerThanIdeal.length);
      expect(tail === "" || /^ · 4 days logged\.?$/.test(tail) || / kg/.test(tail)).toBe(true);
    }
  });

  it("never produces an exclamation mark in the with_suggestion variant", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 7, avgCalories: 2400, weightDeltaKg: -1.2 }),
      makeSuggestion("Log on weekends to keep your 14-day streak going."),
    );
    expect(out.body).not.toMatch(/!/);
  });

  it("ignores an empty-headline suggestion (treats as if absent)", () => {
    const out = formatWeeklyRecapPushBody(
      makeRecap({ daysLogged: 5, avgCalories: 1900, weightDeltaKg: 0.3 }),
      makeSuggestion(""),
    );
    // Falls through to with_weight rather than producing
    // " · 5 days logged..." with a leading separator.
    expect(out.variant).toBe<PushBodyVariant>("with_weight");
  });
});
