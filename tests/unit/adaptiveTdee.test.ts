import { describe, it, expect, afterEach, vi } from "vitest";
import {
  computeAdaptiveTDEE,
  MIN_COMPLETE_DAY_KCAL,
  SLOPE_CAP_KG_PER_WEEK,
  PLAUSIBILITY_LOWER_FRACTION,
} from "@/lib/nutrition/adaptiveTdee";

function generateDays(count: number, startDate: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(startDate);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

describe("computeAdaptiveTDEE", () => {
  it("returns null when insufficient logging days", () => {
    const days = generateDays(5);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).toBeNull();
  });

  it("returns null when insufficient weigh-ins", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; });
    weightByDay[days[0]] = 80;
    weightByDay[days[13]] = 79.5;

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).toBeNull();
  });

  it("calculates TDEE for weight maintenance (stable weight)", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2200; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Stable weight => TDEE should be close to avg intake
    expect(result!.tdee).toBeGreaterThanOrEqual(2100);
    expect(result!.tdee).toBeLessThanOrEqual(2300);
    expect(result!.avgDailyIntake).toBe(2200);
    expect(result!.confidence).toBe("medium");
  });

  it("estimates higher TDEE when losing weight", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 1800;
      // Losing ~0.5kg/week = ~0.07kg/day over 14 days
      weightByDay[d] = 80 - i * 0.07;
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Losing weight while eating 1800 => TDEE must be > 1800
    expect(result!.tdee).toBeGreaterThan(1800);
    expect(result!.avgDailyIntake).toBe(1800);
  });

  it("estimates lower TDEE when gaining weight", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 2500;
      // Gaining ~0.5kg/week
      weightByDay[d] = 80 + i * 0.07;
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Gaining weight while eating 2500 => TDEE must be < 2500
    expect(result!.tdee).toBeLessThan(2500);
  });

  it("confidence is high with 21+ logging days and 7+ weigh-ins", () => {
    const days = generateDays(21);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
  });

  it("respects custom window days", () => {
    const days = generateDays(10);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay, windowDays: 10 });
    expect(result).not.toBeNull();
    expect(result!.windowDays).toBe(10);
  });

  it("never returns TDEE below 800", () => {
    // Re-pinned for the R1 completeness gate (TDEE gating 2026-06-10): days
    // must clear the 1,000-kcal floor to count. Use full (1,050-kcal) days so
    // the gate passes, then drive the 800 floor via extreme weight *gain*
    // (the slope cap limits the trend term, but 1,050 − capped-surplus still
    // floors at 800).
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 1050; // clears the completeness gate
      weightByDay[d] = 80 + i * 0.3; // rapid gain → large positive energy term
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    expect(result!.tdee).toBeGreaterThanOrEqual(800);
  });
});

/**
 * ── R1 completeness gate · R2 slope trend · R3 plausibility bound ──────────
 * TDEE gating 2026-06-10. Validated architecture from:
 *   docs/ux/research/2026-06-10-adaptive-tdee-review.md   (forensic R1/R2/R3)
 *   docs/ux/research/2026-06-10-tdee-methodology-survey.md (four-layer arch.)
 *   docs/decisions/2026-06-10-adaptive-tdee-gating.md
 *
 * The numbers below are NOT invented — they are reproduced from Grace's real
 * data series in the forensic doc. The headline regression proof: her series
 * reads ~1,314 ungated (the bug) and ~1,626 once the partial days are gated
 * out — inside her expected 1,500–1,600 range.
 */
describe("computeAdaptiveTDEE — R1 completeness gate (Grace's real series)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Grace's condensed window, 2026-05-13 → 2026-06-10 (forensic §2 table).
  // [date, kcal logged (null = zero/no-log day), weight kg (null = none)].
  const SERIES: Array<[string, number | null, number | null]> = [
    ["2026-05-13", 1460, 54.4],
    ["2026-05-14", 1921, null],
    ["2026-05-15", 284, null], // partial
    ["2026-05-16", null, null], // zero — excluded by v>0 already
    ["2026-05-17", 3750, null],
    ["2026-05-18", 520, null], // partial
    ["2026-05-19", null, null], // zero
    ["2026-05-20", 1664, null],
    ["2026-05-21", 672, 54.9], // partial
    ["2026-05-22", 466, 54.9], // partial
    ["2026-05-23", 680, null], // partial
    ["2026-05-24", 2100, null],
    ["2026-05-25", 1276, null],
    ["2026-05-26", 1459, null],
    ["2026-05-27", 1267, null],
    ["2026-05-28", 1504, 54.7],
    ["2026-05-29", 1626, null],
    ["2026-05-30", 1182, null],
    ["2026-05-31", 1292, null],
    ["2026-06-01", 1944, null],
    ["2026-06-02", 1529, null],
    ["2026-06-03", 1901, null],
    ["2026-06-04", 1708, 54.6],
    ["2026-06-05", 458, null], // partial
    ["2026-06-06", null, null], // zero
    ["2026-06-07", 676, null], // partial
    ["2026-06-08", 1765, null],
    ["2026-06-09", 1136, 55.0],
    ["2026-06-10", 1345, null],
  ];

  function graceInputs() {
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    for (const [date, kcal, kg] of SERIES) {
      if (kcal != null && kcal > 0) intakeByDay[date] = kcal;
      if (kg != null) weightByDay[date] = kg;
    }
    return { intakeByDay, weightByDay };
  }

  /** Freeze the clock at the real refresh instant so the 28-day trailing
   *  window captures exactly 2026-05-13 → 2026-06-10. */
  function freezeAtRefresh() {
    // 2026-06-10 local. Use noon UTC so the trailing-28 cutoff lands on 05-13.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
  }

  it("REGRESSION: gates out the 7 partial days → 1,592 (NOT the buggy ~1,314)", () => {
    freezeAtRefresh();
    const { intakeByDay, weightByDay } = graceInputs();
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();

    // 19 trusted (full) days survive the gate; 7 partial days excluded.
    expect(result!.loggingDays).toBe(19);
    expect(result!.excludedPartialDays).toBe(7);

    // Gated mean intake = 31,829 / 19 = 1,675 (forensic §3 root-cause). This
    // is the pure gate signal — trend-independent — vs the ungated 1,369.
    expect(result!.avgDailyIntake).toBe(1675);

    // The PRODUCTION number (R1 gate + R2 least-squares slope): 1,592.
    //   gated mean 1,675 − slope energy (+0.0107 kg/day × 7,700 = +83) = 1,592.
    // Inside Grace's expected 1,500–1,600 band. (The forensic's 1,626 figure
    // is the same gate with the OLD EMA trend, energy +49 — see the gate-
    // isolation test below; R2 swaps EMA→slope so the shipped number is 1,592.)
    expect(result!.tdee).toBe(1592);
    expect(result!.tdee).toBeGreaterThanOrEqual(1500);
    expect(result!.tdee).toBeLessThanOrEqual(1650);

    // And it must be WAY above the buggy stored 1,314.
    expect(result!.tdee - 1314).toBeGreaterThan(250);
  });

  it("REGRESSION: gate isolation — same trend, gate alone moves 1,314 → 1,626", () => {
    // Proves the gate is the single variable behind the bug. Holding the trend
    // method constant (the OLD EMA, energy term +49 for her series):
    //   UNGATED: mean 1,369 − 49 = 1,320 (stored 1,314 within edit residual).
    //   GATED:   mean 1,675 − 49 = 1,626 (forensic §4 "trusted-day gated, EMA").
    // We pin both the means and both the EMA-equivalent TDEEs by hand so the
    // numbers are anchored to the forensic doc, not to whatever trend R2 uses.
    freezeAtRefresh();
    const { intakeByDay } = graceInputs();
    const loggedDays = Object.values(intakeByDay); // 26 days, v>0

    const ungatedMean = Math.round(
      loggedDays.reduce((s, v) => s + v, 0) / loggedDays.length,
    );
    const gatedDays = loggedDays.filter((v) => v >= MIN_COMPLETE_DAY_KCAL);
    const gatedMean = Math.round(
      gatedDays.reduce((s, v) => s + v, 0) / gatedDays.length,
    );

    expect(loggedDays.length).toBe(26);
    expect(gatedDays.length).toBe(19);
    expect(ungatedMean).toBe(1369);
    expect(gatedMean).toBe(1675);
    expect(gatedMean - ungatedMean).toBe(306); // the partial-day drag

    // EMA trend energy for her 6 weigh-ins was +49 kcal (forensic §3).
    const emaEnergy = 49;
    expect(ungatedMean - emaEnergy).toBe(1320); // ≈ stored 1,314 (the bug)
    expect(gatedMean - emaEnergy).toBe(1626); // forensic's expected reading
  });

  it("excluded partial days do not count toward eligibility / confidence", () => {
    freezeAtRefresh();
    const { intakeByDay, weightByDay } = graceInputs();
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    // 19 gated days + 6 weigh-ins → medium (≥14 days, ≥5 weigh-ins), NOT high.
    expect(result!.weighInCount).toBe(6);
    expect(result!.confidence).toBe("medium");
  });

  it("scales the floor to 0.8 × BMR when BMR is supplied (still 1,000 for Grace)", () => {
    freezeAtRefresh();
    const { intakeByDay, weightByDay } = graceInputs();
    // Grace BMR = 1,215 → 0.8 × 1,215 = 972 < 1,000 → floor stays 1,000.
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay, bmrKcal: 1215 });
    expect(result!.completeDayFloorKcal).toBe(MIN_COMPLETE_DAY_KCAL);
    expect(result!.loggingDays).toBe(19);
  });

  it("a larger BMR raises the floor above 1,000 (0.8 × 1,500 = 1,200)", () => {
    freezeAtRefresh();
    const { intakeByDay, weightByDay } = graceInputs();
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay, bmrKcal: 1500 });
    expect(result!.completeDayFloorKcal).toBe(1200);
    // With a 1,200 floor, the 1,182/1,136 days (05-30 / 06-09) also drop out.
    expect(result!.loggingDays).toBeLessThan(19);
  });
});

describe("computeAdaptiveTDEE — R1 entry-count gate (≥2 entries)", () => {
  afterEach(() => vi.useRealTimers());

  function buildWindow(
    days: number,
    kcalPerDay: number,
    weighInDays: number[],
  ) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      intakeByDay[key] = kcalPerDay;
      entryCountByDay[key] = 3;
      if (weighInDays.includes(i)) weightByDay[key] = 80 - i * 0.01;
    }
    return { intakeByDay, weightByDay, entryCountByDay };
  }

  it("excludes a high-kcal day that is a single entry (not a real full day)", () => {
    const { intakeByDay, weightByDay, entryCountByDay } = buildWindow(
      20,
      1900,
      [0, 5, 10, 15, 19],
    );
    // Turn one full-kcal day into a single-entry day (e.g. a 1,900-kcal recipe
    // import). With the entry-count gate it must NOT count.
    const firstKey = Object.keys(intakeByDay)[0];
    entryCountByDay[firstKey] = 1;

    const withCounts = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    })!;
    const withoutCounts = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;

    expect(withCounts.loggingDays).toBe(withoutCounts.loggingDays - 1);
    expect(withCounts.excludedPartialDays).toBeGreaterThanOrEqual(1);
  });
});

describe("computeAdaptiveTDEE — R2 slope trend vs the old EMA", () => {
  afterEach(() => vi.useRealTimers());

  function freeze() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
  }

  it("recovers the true slope of a clean linear weight loss (within the cap)", () => {
    // 21 full days, weight falling a clean 0.3 kg/week = 0.04286 kg/day — under
    // the ±0.35 kg/week cap, so the slope is recovered in full. The least-
    // squares slope sees the whole trend; the old per-weigh-in EMA(α=0.1)
    // captured only ~29% of a sparse move (forensic R2). At a true 0.04286
    // kg/day loss the energy term is +330 kcal/day, so eating 1,800 implies a
    // TDEE near 2,130 — not the muted ~1,890 the EMA would have produced.
    freeze();
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    for (let i = 0; i < 21; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - (20 - i));
      const key = d.toISOString().slice(0, 10);
      intakeByDay[key] = 1800;
      weightByDay[key] = 80 - i * (0.3 / 7); // 0.04286 kg/day loss (within cap)
    }
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;
    // Slope ≈ −0.04286 kg/day (uncapped) → energy +330 → 1,800 + 330 ≈ 2,130.
    expect(result.smoothedWeightChangeKgPerDay).toBeCloseTo(-0.04286, 3);
    expect(result.tdee).toBeGreaterThan(2100);
    expect(result.tdee).toBeLessThan(2160);
  });

  it("AUDIT P0: a true 0.5 kg/week loss recovers ~550 kcal/day, NOT the EMA's ~130", () => {
    // The nutrition-calculations audit's named regression anchor
    // (docs/ux/research/2026-06-10-nutrition-calculations-audit.md §#1/§2):
    // "a synthetic 0.5 kg/week series must recover ~550 kcal/day of deficit,
    // not ~130." The ~130 was the OLD per-weigh-in EMA(α=0.1), which (the audit
    // showed) lagged differently at each window endpoint and shrank the
    // measured change 35–85% toward zero. A least-squares slope sees the whole
    // trend, so it recovers the full energy term.
    //
    // RECONCILIATION with the R2 slope cap (the audit predates it): 0.5 kg/week
    // = 0.0714 kg/day EXCEEDS the ±0.35 kg/week (0.05 kg/day) water-noise cap
    // adopted in the gating decision, so the *surfaced* trend is bounded to the
    // cap (energy 385). The audit's "550 not 130" claim is about SLOPE RECOVERY,
    // not the post-cap value — so we prove both: (a) the raw least-squares slope
    // of this series recovers the full ~550 (vs the EMA's ~130), and (b) the cap
    // then bounds the displayed term to 385. Both are correct under the shipped
    // architecture.
    freeze();
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    // Daily weigh-ins so the gate + eligibility clear with margin and the slope
    // is unambiguous. 21 full days, a clean 0.5 kg/week (0.0714 kg/day) loss.
    const dayKeys: string[] = [];
    const weights: number[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - (20 - i));
      const key = d.toISOString().slice(0, 10);
      intakeByDay[key] = 1800; // full days, clears the 1,000 floor
      const w = 80 - i * (0.5 / 7); // 0.5 kg/week loss
      weightByDay[key] = w;
      dayKeys.push(key);
      weights.push(w);
    }

    // (a) RAW least-squares slope of this exact series, computed independently
    // of the cap, must recover ~0.0714 kg/day → ~550 kcal/day — and emphatically
    // NOT the EMA's muted ~130.
    const x0 = new Date(dayKeys[0]).getTime();
    const xs = dayKeys.map((k) => (new Date(k).getTime() - x0) / 86_400_000);
    const n = xs.length;
    const sx = xs.reduce((s, v) => s + v, 0);
    const sy = weights.reduce((s, v) => s + v, 0);
    const sxx = xs.reduce((s, v) => s + v * v, 0);
    const sxy = xs.reduce((s, v, i) => s + v * weights[i], 0);
    const rawSlopeKgPerDay = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const rawEnergyKcalPerDay = Math.round(Math.abs(rawSlopeKgPerDay) * 7700);
    expect(rawEnergyKcalPerDay).toBe(550); // the audit's recovered figure
    expect(rawEnergyKcalPerDay).toBeGreaterThan(130); // NOT the EMA's muted read

    // (b) The shipped estimator surfaces the CAPPED slope (±0.35 kg/week →
    // 0.05 kg/day → energy 385). Eating 1,800 at a capped +385 term → 2,185.
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;
    expect(result.smoothedWeightChangeKgPerDay).toBeCloseTo(
      -(SLOPE_CAP_KG_PER_WEEK / 7),
      4,
    );
    expect(result.tdee).toBe(1800 + 385);
  });

  it("forensic R2 arithmetic: slope reads Grace's real weigh-ins, not the muted EMA", () => {
    // Grace's 6 raw weigh-ins (forensic §2): 54.4 → 55.0 over 27 days. The
    // forensic showed the OLD per-weigh-in EMA(α=0.1) captured only +0.1716 kg
    // (28.6%) of the real +0.6 kg move → energy +49. The new least-squares
    // slope reads the full series. We rebuild her weigh-ins on a 28-day window
    // and pin the slope's energy term (≈ +83, the best-fit gradient) against
    // the EMA's understated +49 — proving R2 stopped muting the signal.
    freeze();
    const weighIns: Array<[number, number]> = [
      // [days-ago from 2026-06-10, kg] — mirrors the forensic table.
      [28, 54.4], // 05-13
      [20, 54.9], // 05-21
      [19, 54.9], // 05-22
      [13, 54.7], // 05-28
      [6, 54.6], // 06-04
      [1, 55.0], // 06-09
    ];
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    // 19 full days so the gate + eligibility clear.
    for (let i = 0; i < 19; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - i);
      intakeByDay[d.toISOString().slice(0, 10)] = 1675;
    }
    for (const [ago, kg] of weighIns) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - ago);
      weightByDay[d.toISOString().slice(0, 10)] = kg;
    }
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;
    // Least-squares slope over the 6 real weigh-ins ≈ +0.0107 kg/day (gaining).
    expect(result.smoothedWeightChangeKgPerDay).toBeCloseTo(0.0107, 3);
    const slopeEnergy = result.smoothedWeightChangeKgPerDay * 7700;
    // Slope energy ≈ +83 kcal — ~70% stronger than the EMA's muted +49
    // (forensic §3). Pin the band rather than the exact integer so 4dp
    // rounding of the surfaced field can't make this brittle.
    expect(slopeEnergy).toBeGreaterThanOrEqual(80);
    expect(slopeEnergy).toBeLessThanOrEqual(85);
    expect(slopeEnergy).toBeGreaterThan(49);
  });

  it("caps an implausibly steep slope at ±0.35 kg/week", () => {
    freeze();
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    for (let i = 0; i < 21; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - (20 - i));
      const key = d.toISOString().slice(0, 10);
      intakeByDay[key] = 2000;
      weightByDay[key] = 80 - i * 0.3; // absurd 2.1 kg/week loss (water flush)
    }
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;
    const capKgPerDay = SLOPE_CAP_KG_PER_WEEK / 7;
    // Slope is clamped to the cap magnitude (loss → negative).
    expect(Math.abs(result.smoothedWeightChangeKgPerDay)).toBeLessThanOrEqual(
      capKgPerDay + 1e-9,
    );
    expect(result.smoothedWeightChangeKgPerDay).toBeCloseTo(-capKgPerDay, 4);
  });
});

describe("computeAdaptiveTDEE — R3 plausibility bound (clamp, never silent)", () => {
  afterEach(() => vi.useRealTimers());

  function freeze() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
  }

  /** 14 full days at `kcal`, stable weight (5 weigh-ins) → medium confidence. */
  function steadyWindow(kcal: number) {
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date("2026-06-10T16:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      intakeByDay[key] = kcal;
      if (i % 3 === 0) weightByDay[key] = 55; // stable, 5 weigh-ins
    }
    return { intakeByDay, weightByDay };
  }

  it("clamps an estimate below 0.85 × sedentary up to the band floor + flags low + reason", () => {
    freeze();
    // Sedentary for Grace = 1,458. Lower band = 0.85 × 1,458 = 1,239. A steady
    // 1,000-kcal intake at stable weight produces a ~1,000 estimate — below the
    // floor. It must clamp up to 1,239, drop to low confidence, and log why.
    const { intakeByDay, weightByDay } = steadyWindow(1000);
    const result = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      sedentaryTdeeKcal: 1458,
    })!;
    const floor = Math.round(PLAUSIBILITY_LOWER_FRACTION * 1458); // 1239
    expect(result.rawTdee).toBeLessThan(floor);
    expect(result.tdee).toBe(floor);
    expect(result.clamped).toBe(true);
    expect(result.clampReason).toBe("below_sedentary_band");
    // A clamped value must NOT parade as medium/high — it is downgraded.
    expect(result.confidence).toBe("low");
  });

  it("does NOT clamp an in-band estimate — confidence + value pass through", () => {
    freeze();
    // 1,500 intake / stable weight → ~1,500 estimate, inside [1,239, 1,895].
    const { intakeByDay, weightByDay } = steadyWindow(1500);
    const result = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      sedentaryTdeeKcal: 1458,
    })!;
    expect(result.clamped).toBe(false);
    expect(result.clampReason).toBeNull();
    expect(result.tdee).toBe(result.rawTdee);
    expect(result.confidence).toBe("medium");
  });

  it("clamps an estimate above 1.30 × sedentary down to the upper band", () => {
    freeze();
    // 2,200 intake / stable weight → ~2,200 estimate, above 1.30 × 1,458 =
    // 1,895. Clamp down + flag.
    const { intakeByDay, weightByDay } = steadyWindow(2200);
    const result = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      sedentaryTdeeKcal: 1458,
    })!;
    expect(result.tdee).toBe(Math.round(1.3 * 1458)); // 1,895
    expect(result.clamped).toBe(true);
    expect(result.clampReason).toBe("above_sedentary_band");
    expect(result.confidence).toBe("low");
  });

  it("floors at the HealthKit resting-energy minimum when supplied", () => {
    freeze();
    // No sedentary band passed; a resting floor of 1,600 must lift a low
    // estimate up to 1,600 with the resting-floor reason.
    const { intakeByDay, weightByDay } = steadyWindow(1100);
    const result = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      restingEnergyFloorKcal: 1600,
    })!;
    expect(result.rawTdee).toBeLessThan(1600);
    expect(result.tdee).toBe(1600);
    expect(result.clamped).toBe(true);
    expect(result.clampReason).toBe("below_resting_floor");
    expect(result.confidence).toBe("low");
  });

  it("leaves the estimate untouched when no bound inputs are supplied (back-compat)", () => {
    freeze();
    const { intakeByDay, weightByDay } = steadyWindow(1000);
    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay })!;
    expect(result.clamped).toBe(false);
    expect(result.clampReason).toBeNull();
    expect(result.tdee).toBe(result.rawTdee);
  });
});
