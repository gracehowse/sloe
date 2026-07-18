// @vitest-environment jsdom

/**
 * ENG-1525 — ProgressHierarchyV1 composer render contract (web).
 *
 * Pins the 5-section hierarchy branch (`progress_hierarchy_v1` forced on by
 * rendering the composer directly — the host gate itself is covered by
 * `progressHierarchyFlagParity.test.ts`):
 *
 *   1. five section overlines in fixed order (Trajectory → This Week →
 *      Energy → Body composition → Your Week);
 *   2. the tinted hero renders ONLY in `show` mode (the one tinted card);
 *   3. `trends_only` → NO absolute weight anywhere in the section (the
 *      legal-signed 2026-07-01 dignity contract);
 *   4. full opt-out (`hide`) → NO Trajectory section, This Week leads;
 *   5. §3 support line = maintenance − intake with CORRECT arithmetic;
 *   6. §2 headline reconciles BOTH the adherence average and the
 *      N-of-7 on-target count (different numbers, never conflated);
 *   7. §4 free-with-data = user-owned values AND the locked trend (delta 2);
 *   8. §5 restates NO streak/avg numerals (they live in §2).
 *
 * Mobile twin: `apps/mobile/tests/unit/progressHierarchyMobile.test.tsx`.
 */

import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, within } from "@testing-library/react";

void React;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import {
  ProgressHierarchyV1,
  type ProgressHierarchyV1Props,
} from "../../src/app/components/suppr/progress-hierarchy/progress-hierarchy-v1";
import type { WeightGoalTimeline } from "../../src/lib/weightProjection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Meal = { calories?: number | null };
function buildByDay(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-07-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

const timeline: WeightGoalTimeline = {
  daysToGoal: 77,
  daysToGoalUncapped: 77,
  weeklyRateKg: 0.4,
  currentKg: 72.4,
  goalKg: 68,
  remainingKg: 4.4,
  trendDirection: "losing",
  cappedAtMaxDays: false,
};

/** Mon–Sun bars: 5 on-target days (≤ target, logged), 1 over, 1 empty. */
const weekDays = [
  { key: "2026-07-06", day: "Mon", calories: 1400, effectiveTarget: 1500 },
  { key: "2026-07-07", day: "Tue", calories: 1450, effectiveTarget: 1500 },
  { key: "2026-07-08", day: "Wed", calories: 1900, effectiveTarget: 1500 },
  { key: "2026-07-09", day: "Thu", calories: 1480, effectiveTarget: 1500 },
  { key: "2026-07-10", day: "Fri", calories: 1500, effectiveTarget: 1500 },
  { key: "2026-07-11", day: "Sat", calories: 0, effectiveTarget: 1500 },
  { key: "2026-07-12", day: "Sun", calories: 1350, effectiveTarget: 1500 },
];

function baseProps(): ProgressHierarchyV1Props {
  return {
    weightSurfaceMode: "show",
    hero: {
      isImperial: false,
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      timeline,
      weighInDayCount: 20,
      chartData: [
        { date: "1 Jul", value: 73.1, ma: 73.0 },
        { date: "8 Jul", value: 72.7, ma: 72.8 },
        { date: "15 Jul", value: 72.4, ma: 72.6, isToday: true },
      ],
      goalWeightChart: 68,
      showRawDots: true,
      byDay: buildByDay(7, 1500),
      targetCalories: 1500,
      maintenanceTdeeKcal: 2200,
      goal: "lose",
      normalizeGoalVocabulary: false,
      weekDeltaKg: -0.4,
      windowLabel: "This month",
      sparse: false,
      onLogWeight: vi.fn(),
    },
    week: {
      adherencePct: 82,
      onTargetCount: 5,
      days: weekDays,
      todayKey: "2026-07-12",
      macros: [
        { name: "Protein", pct: 92, color: "var(--macro-protein)" },
        { name: "Carbs", pct: 88, color: "var(--macro-carbs)" },
        { name: "Fat", pct: 104, color: "var(--macro-fat)" },
        { name: "Fibre", pct: 71, color: "var(--macro-fibre)" },
      ],
      streakDays: 4,
      freezesAvailable: 1,
      onOpenStreak: vi.fn(),
    },
    energy: {
      avgIntakeKcal: 1840,
      hasEnoughData: true,
      resolved: {
        kcal: 2073,
        source: "adaptive",
        confidence: "high",
        formulaKcal: 2000,
        adaptiveRejectedAsStale: false,
        adaptiveRejectedBelowFormula: false,
        rejectedAdaptiveKcal: null,
        measuredRejectedBelowFormula: false,
        rejectedMeasuredKcal: null,
      },
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      adaptiveProgress: null,
      expenditureCopy: null,
      expenditureSparkline: null,
      sex: "female",
      weightKg: 72.4,
      heightCm: 165,
      age: 30,
      activityLevel: "moderate",
      planPace: "steady",
      userGoal: "lose",
      goalCalories: 1500,
    },
    bodyComp: {
      userTier: "free",
      latestBodyFatPct: 24.1,
      latestLeanMassKg: 52.3,
    },
    yourWeek: {
      weekKey: "2026-W28",
      weekLabel: "6–12 Jul",
      headline: "A steady week — protein carried you.",
      usualMeal: { name: "Overnight oats", count: 3 },
      bestDay: { label: "Friday", calories: 1500, protein: 96 },
      shareText: "My week on Sloe",
    },
  };
}

const SECTION_ORDER = [
  "progress-hierarchy-hero",
  "progress-hierarchy-week",
  "progress-hierarchy-energy",
  "progress-hierarchy-body-comp",
  "progress-hierarchy-your-week",
];

function sectionIdsIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-testid^='progress-hierarchy-']")]
    .map((el) => el.getAttribute("data-testid")!)
    .filter((id) => id !== "progress-hierarchy-v1");
}

/** Matches any absolute weight readout ("72.4 kg", "159,6 lb", "4 kg"…). */
const ABSOLUTE_WEIGHT_RE = /\d+([.,]\d+)?\s?(kg|lb)\b/;

// ---------------------------------------------------------------------------
// 1 + 2 — order + the one tinted hero (show mode)
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — section order + tinted hero (web)", () => {
  it("renders the 5 sections in fixed order with their overlines", () => {
    const { container, getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    expect(sectionIdsIn(container)).toEqual(SECTION_ORDER);

    const overline = (sectionId: string, text: string | RegExp) =>
      within(getByTestId(sectionId)).getByText(text);
    expect(overline("progress-hierarchy-hero", "Weight · toward goal")).toBeTruthy();
    expect(overline("progress-hierarchy-week", "This week")).toBeTruthy();
    expect(overline("progress-hierarchy-energy", "Energy")).toBeTruthy();
    // Free tier → the "· Pro" suffix on the §4 overline.
    expect(
      overline("progress-hierarchy-body-comp", "Body composition · Pro"),
    ).toBeTruthy();
    expect(overline("progress-hierarchy-your-week", "Your week")).toBeTruthy();
  });

  it("show mode: the hero is the ONE tinted card (data-hero-tint), no other section carries it", () => {
    const { container, getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    const tinted = container.querySelectorAll("[data-hero-tint='true']");
    expect(tinted).toHaveLength(1);
    expect(tinted[0]!.getAttribute("data-testid")).toBe("progress-hierarchy-hero");
    // The absolute-weight numeral is session-replay masked (ENG-534).
    expect(getByTestId("hierarchy-hero-kg").closest(".ph-mask")).not.toBeNull();
  });

  it("show mode: the smoothed rate + projection render with the honesty grammar", () => {
    const { getByTestId, getByText } = render(<ProgressHierarchyV1 {...baseProps()} />);
    // Smoothed signed rate (0.4 kg/wk losing → ↓, toward goal → sage class).
    const rate = getByTestId("hierarchy-hero-rate");
    expect(rate.textContent).toContain("↓ 0.4 kg / wk · trend");
    expect(rate.className).toContain("text-success");
    // Distance leads bold; date hedged; footnote honest.
    expect(getByTestId("hierarchy-hero-distance").textContent).toContain("4.4 kg to go");
    expect(getByTestId("hierarchy-hero-date").textContent).toContain("at this pace ~");
    expect(getByText("An estimate, not a promise.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3 — trends_only: no absolute weight, no tint
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — trends_only (web)", () => {
  it("renders the plain trend card with NO absolute kg/lb and NO tint", () => {
    const props = baseProps();
    props.weightSurfaceMode = "trends_only";
    const { container, getByTestId, queryByTestId } = render(
      <ProgressHierarchyV1 {...props} />,
    );
    const card = getByTestId("progress-hierarchy-trend-only");
    expect(card.textContent ?? "").not.toMatch(ABSOLUTE_WEIGHT_RE);
    // The tinted hero does not exist in this mode — the tint belongs to the
    // absolute-weight hero only.
    expect(queryByTestId("progress-hierarchy-hero")).toBeNull();
    expect(container.querySelector("[data-hero-tint='true']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4 — full opt-out: This Week promotes to the top slot
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — weight opt-out (web)", () => {
  it("hide mode: NO Trajectory section; This Week leads by position", () => {
    const props = baseProps();
    props.weightSurfaceMode = "hide";
    const { container, queryByTestId } = render(<ProgressHierarchyV1 {...props} />);
    expect(queryByTestId("progress-hierarchy-hero")).toBeNull();
    expect(queryByTestId("progress-hierarchy-trend-only")).toBeNull();
    expect(sectionIdsIn(container)).toEqual(SECTION_ORDER.slice(1));
  });
});

describe("ProgressHierarchyV1 — sparse weight with other progress (web, ENG-1578)", () => {
  it("lets available weekly evidence lead and moves weight setup into slot two", () => {
    const props = baseProps();
    props.promoteAvailableProgress = true;
    props.hero = { ...props.hero, sparse: true, chartData: [] };
    const { container } = render(<ProgressHierarchyV1 {...props} />);
    expect(sectionIdsIn(container)).toEqual([
      "progress-hierarchy-week",
      "progress-hierarchy-hero",
      "progress-hierarchy-energy",
      "progress-hierarchy-body-comp",
      "progress-hierarchy-your-week",
    ]);
  });

  it("keeps weight setup first when there is no other real progress", () => {
    const props = baseProps();
    props.promoteAvailableProgress = true;
    props.hero = { ...props.hero, sparse: true, chartData: [] };
    props.week = {
      ...props.week,
      adherencePct: null,
      onTargetCount: 0,
      streakDays: 0,
      days: props.week.days.map((day) => ({ ...day, calories: 0 })),
    };
    props.energy = { ...props.energy, hasEnoughData: false };
    props.yourWeek = { ...props.yourWeek, shareDisabled: true };
    const { container } = render(<ProgressHierarchyV1 {...props} />);
    expect(sectionIdsIn(container)[0]).toBe("progress-hierarchy-hero");
  });
});

// ---------------------------------------------------------------------------
// 5 — §3 Energy: the equation in words, correct arithmetic
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §3 Energy equation (web)", () => {
  it("deficit: lead numeral = maintenance − intake; support line spells the equation", () => {
    const { getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    // 2073 − 1840 = 233 (deficit).
    expect(getByTestId("hierarchy-energy-lead").textContent).toContain(
      (233).toLocaleString(),
    );
    expect(getByTestId("progress-hierarchy-energy").textContent).toContain(
      "Average daily deficit",
    );
    expect(getByTestId("hierarchy-energy-equation").textContent).toBe(
      `${(2073).toLocaleString()} maintenance − ${(1840).toLocaleString()} intake`,
    );
  });

  it("surplus: negative maintenance − intake flips the label and stays |Δ| in the lead", () => {
    const props = baseProps();
    props.energy = {
      ...props.energy,
      avgIntakeKcal: 2400,
      resolved: { ...props.energy.resolved!, kcal: 2000 },
    };
    const { getByTestId } = render(<ProgressHierarchyV1 {...props} />);
    // 2000 − 2400 = −400 → surplus of 400.
    expect(getByTestId("hierarchy-energy-lead").textContent).toContain(
      (400).toLocaleString(),
    );
    expect(getByTestId("progress-hierarchy-energy").textContent).toContain(
      "Average daily surplus",
    );
    expect(getByTestId("hierarchy-energy-equation").textContent).toBe(
      `${(2000).toLocaleString()} maintenance − ${(2400).toLocaleString()} intake`,
    );
  });

  it("below the story floor the numeral gives way — no confident deficit from one logged day", () => {
    const props = baseProps();
    props.energy = { ...props.energy, hasEnoughData: false };
    const { queryByTestId, getByTestId } = render(<ProgressHierarchyV1 {...props} />);
    expect(queryByTestId("hierarchy-energy-lead")).toBeNull();
    expect(queryByTestId("hierarchy-energy-equation")).toBeNull();
    expect(getByTestId("progress-hierarchy-energy").textContent).toContain(
      "An honest average needs a few more logged days",
    );
  });
});

// ---------------------------------------------------------------------------
// 5b — §1 overline honesty: "toward goal" only with real goal data
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §1 overline (web)", () => {
  it("drops the 'toward goal' suffix when there is no goal-weight data", () => {
    const props = baseProps();
    props.hero = { ...props.hero, goalWeightKg: null, timeline: null };
    const { getByTestId } = render(<ProgressHierarchyV1 {...props} />);
    const hero = getByTestId("progress-hierarchy-hero").textContent ?? "";
    expect(hero).toContain("Weight");
    expect(hero).not.toContain("toward goal");
  });
});

// ---------------------------------------------------------------------------
// 6 — §2 This Week: both stats, never conflated
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §2 headline (web)", () => {
  it("carries the adherence average AND the N-of-7 on-target count as distinct figures", () => {
    const { getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    const headline = getByTestId("hierarchy-week-headline").textContent ?? "";
    expect(headline).toContain("82");
    expect(headline).toContain("%");
    expect(headline).toContain("avg");
    expect(headline).toContain("5 of 7 days on target");
  });
});

// ---------------------------------------------------------------------------
// 7 — §4 Body composition: free-with-data = values AND lock (delta 2)
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §4 free tier with data (web)", () => {
  it("renders the user-owned values free AND the Pro lock on the trend layer", () => {
    const { getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    const values = getByTestId("hierarchy-body-comp-free-values");
    expect(values.textContent).toContain("24.1%");
    expect(values.textContent).toContain("52.3 kg");
    // The trend layer stays locked — both surfaces coexist.
    expect(getByTestId("hierarchy-body-comp-locked-trend")).toBeTruthy();
    expect(getByTestId("hierarchy-body-comp-pro-cta")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 8 — §5 Your Week: no restated streak/avg numerals
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §5 verdict layer (web)", () => {
  it("renders verdict + texture + share, with NO restated streak/avg numbers", () => {
    const { getByTestId } = render(<ProgressHierarchyV1 {...baseProps()} />);
    const section = getByTestId("progress-hierarchy-your-week");
    expect(getByTestId("hierarchy-your-week-verdict").textContent).toBe(
      "A steady week — protein carried you.",
    );
    expect(getByTestId("hierarchy-your-week-texture").textContent).toContain(
      "Overnight oats carried the week",
    );
    expect(getByTestId("hierarchy-your-week-share")).toBeTruthy();
    // §2 owns these numbers — the fixture's 82% avg and 4-day streak must
    // not echo here.
    const text = section.textContent ?? "";
    expect(text).not.toContain("82");
    expect(text).not.toContain("%");
    expect(text).not.toMatch(/streak/i);
  });
});
