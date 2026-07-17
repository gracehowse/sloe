// @vitest-environment jsdom

/**
 * ENG-1525 — ProgressHierarchyV1 composer render contract (mobile).
 *
 * Web twin: `tests/unit/progressHierarchyWeb.test.tsx` — the SAME eight
 * contract points, pinned against the RN composer:
 *
 *   1. five section overlines in fixed order;
 *   2. the tinted hero renders ONLY in `show` mode (heroTint border/wash);
 *   3. `trends_only` → NO absolute kg/lb anywhere in the section;
 *   4. full opt-out (`hide`) → NO Trajectory section, This Week leads;
 *   5. §3 support line = maintenance − intake with CORRECT arithmetic;
 *   6. §2 headline reconciles BOTH the adherence average and the
 *      N-of-7 on-target count;
 *   7. §4 free-with-data = user-owned values AND the locked trend (delta 2);
 *   8. §5 restates NO streak/avg numerals.
 *
 * The canonical WeightChart is stubbed (its behaviour is pinned by its own
 * suite — `weightChartDomain` / `weightChartSwipePaging`); everything else
 * mounts real through the standard RN test shims.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

const COLORS = {
  text: "#221B26",
  textSecondary: "#655C6E",
  textTertiary: "#6E6874",
  background: "#F7F6FA",
  backgroundSecondary: "#F1F0F4",
  card: "#FFFFFF",
  cardBorder: "#EEEAF2",
  border: "#DDD8E2",
  borderStrong: "#C9C2D1",
  inputBg: "#F1F0F4",
  navPrimary: "#3B2A4D",
  overBudgetFg: "#925812",
  heroTint: "rgba(91, 59, 110, 0.11)",
  heroTintTo: "rgba(91, 59, 110, 0.045)",
  heroTintBorder: "rgba(91, 59, 110, 0.28)",
};

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => COLORS,
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#C8794E", primarySolid: "#A0552E" }),
  useTheme: () => ({ resolved: "light" }),
}));

vi.mock("@/lib/macroColors", () => ({
  useMacroColors: () => ({
    colors: { protein: "#7A9E7E", carbs: "#8A7FB8", fat: "#D6A24A", fibre: "#6E8FA6" },
    colorFor: () => "#7A9E7E",
  }),
}));

// The canonical chart is pinned by its own suite; stub it so the composer
// test exercises the hero's grammar, not Skia/SVG chart internals.
vi.mock("@/components/progress/WeightChart", () => ({
  WeightChart: () => null,
}));

vi.mock("@/lib/authedFetch", () => ({
  authedFetch: vi.fn(),
}));

vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => null,
}));

import {
  ProgressHierarchyV1,
  type ProgressHierarchyV1Props,
} from "../../components/progress/hierarchy/ProgressHierarchyV1";
import { computeWeightTrend } from "../../lib/progress/weightTrend";
import type { WeightGoalTimeline } from "../../lib/weightProjection";

// ---------------------------------------------------------------------------
// JSON-tree helpers (RNTL renders to a react-test-renderer JSON tree).
// ---------------------------------------------------------------------------

type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
};

function roots(tree: JsonNode | JsonNode[] | null): JsonNode[] {
  if (tree == null) return [];
  return Array.isArray(tree) ? tree : [tree];
}

/** Pre-order list of every testID in the tree. */
function collectTestIds(node: JsonNode | string, out: string[] = []): string[] {
  if (typeof node === "string") return out;
  if (typeof node.props?.testID === "string") out.push(node.props.testID);
  for (const child of node.children ?? []) collectTestIds(child, out);
  return out;
}

function findByTestId(node: JsonNode | string, id: string): JsonNode | null {
  if (typeof node === "string") return null;
  if (node.props?.testID === id) return node;
  for (const child of node.children ?? []) {
    const hit = findByTestId(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Concatenated text content of a subtree. */
function textOf(node: JsonNode | string | null): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  return (node.children ?? []).map((c) => textOf(c)).join("");
}

function sectionRoots(tree: JsonNode | JsonNode[] | null): string[] {
  const ids: string[] = [];
  for (const r of roots(tree)) collectTestIds(r, ids);
  return ids.filter(
    (id) => id.startsWith("progress-hierarchy-") && SECTION_IDS.includes(id),
  );
}

const SECTION_IDS = [
  "progress-hierarchy-trajectory-hero",
  "progress-hierarchy-trend-only",
  "progress-hierarchy-week",
  "progress-hierarchy-energy",
  "progress-hierarchy-body-comp",
  "progress-hierarchy-your-week",
];

/** Matches any absolute weight readout ("72.4 kg", "159,6 lb", "4 kg"…). */
const ABSOLUTE_WEIGHT_RE = /\d+([.,]\d+)?\s?(kg|lb)\b/;

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

/** ≥14 weigh-in days gates the projection DATE; 20 clears it. */
function buildWeightByDay(): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    out[`2026-06-${String(i + 1).padStart(2, "0")}`] = 73.5 - i * 0.05;
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

const weightByDay = buildWeightByDay();
const trend = computeWeightTrend(
  Object.entries(weightByDay).map(([dateISO, kg]) => ({
    dateISO,
    kg,
    source: "manual" as const,
  })),
  "1m",
  68,
  "2026-06-20",
);

const dayTotals = (
  key: string,
  label: string,
  calories: number,
): {
  key: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  effectiveTargetCalories: number;
  isSnapshot: boolean;
} => ({
  key,
  label,
  calories,
  protein: 90,
  carbs: 150,
  fat: 50,
  targetCalories: 1500,
  targetProtein: 110,
  targetCarbs: 160,
  targetFat: 55,
  effectiveTargetCalories: 1500,
  isSnapshot: false,
});

/** Mon–Sun: 5 on-target days (logged ≤ target), 1 over, 1 empty. */
const weekDays = [
  dayTotals("2026-07-06", "Mon", 1400),
  dayTotals("2026-07-07", "Tue", 1450),
  dayTotals("2026-07-08", "Wed", 1900),
  dayTotals("2026-07-09", "Thu", 1480),
  dayTotals("2026-07-10", "Fri", 1500),
  dayTotals("2026-07-11", "Sat", 0),
  dayTotals("2026-07-12", "Sun", 1350),
];

function baseProps(): ProgressHierarchyV1Props {
  return {
    mode: "show",
    trajectory: {
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      weightKgByDay: weightByDay,
      measurementSystem: "metric",
      trend,
      range: "1m",
      chartKey: "week:0",
      byDay: buildByDay(7, 1500),
      targetCalories: 1500,
      maintenanceTdeeKcal: 2200,
      userGoal: "lose",
      timeline,
      weekDeltaKg: -0.4,
      periodWindowLabel: "This month",
      onLogWeight: vi.fn(),
    },
    week: {
      adherencePct: 82,
      days: weekDays,
      todayKey: "2026-07-12",
      isCurrentWeek: true,
      macros: [
        { name: "Protein", pct: 92, color: "#7A9E7E" },
        { name: "Carbs", pct: 88, color: "#8A7FB8" },
        { name: "Fat", pct: 104, color: "#D6A24A" },
        { name: "Fibre", pct: 71, color: "#6E8FA6" },
      ],
      streakDays: 4,
      streakFreezesAvailable: 1,
      onOpenStreak: vi.fn(),
    },
    energy: {
      avgIntakeKcal: 1840,
      hasEnoughData: true,
      maintenanceKcal: 2073,
      isAdaptive: true,
      adaptiveConfidence: "high",
      qualifierLine: "Adaptive from your logs",
      periodLabel: "Last 30 days",
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      expenditureCopy: null,
      adaptiveProgress: null,
      maintenanceExplainer: null,
    },
    bodyComp: {
      userTier: "free",
      latestBodyFatPct: 24.1,
      latestLeanMassKg: 52.3,
      onOpenPaywall: vi.fn(),
    },
    yourWeek: {
      weekKey: "2026-W28",
      headline: "A steady week — protein carried you.",
      usualMealLine: "Overnight oats carried the week — logged 3 times.",
      bestDay: null,
      shareText: "My week on Sloe",
    },
  };
}

// ---------------------------------------------------------------------------
// 1 + 2 — order + the one tinted hero (show mode)
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — section order + tinted hero (mobile)", () => {
  it("renders the 5 sections in fixed order with their overlines", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    expect(sectionRoots(r.toJSON() as JsonNode | JsonNode[])).toEqual([
      "progress-hierarchy-trajectory-hero",
      "progress-hierarchy-week",
      "progress-hierarchy-energy",
      "progress-hierarchy-body-comp",
      "progress-hierarchy-your-week",
    ]);

    const overline = (id: string) =>
      textOf(findByTestId((r.toJSON() as JsonNode), id));
    expect(overline("progress-hierarchy-trajectory-overline")).toBe(
      "Weight · toward goal",
    );
    expect(overline("progress-hierarchy-week-overline")).toBe("This week");
    expect(overline("progress-hierarchy-energy-overline")).toBe("Energy");
    // Free tier → the "· Pro" suffix on the §4 overline.
    expect(overline("progress-hierarchy-body-comp-overline")).toBe(
      "Body composition · Pro",
    );
    expect(overline("progress-hierarchy-your-week-overline")).toBe("Your week");
  });

  it("show mode: the hero carries the heroTint hairline (the ONE tinted card)", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const hero = r.getByTestId("progress-hierarchy-trajectory-hero");
    const style = ([] as Array<Record<string, unknown>>)
      .concat(hero.props.style as Record<string, unknown>)
      .reduce((acc, s) => ({ ...acc, ...(s ?? {}) }), {});
    expect(style.borderColor).toBe(COLORS.heroTintBorder);
    // No other section renders the trend-only or a second tinted surface.
    expect(r.queryByTestId("progress-hierarchy-trend-only")).toBeNull();
  });

  it("show mode: smoothed rate + projection honesty grammar render", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const tree = r.toJSON() as JsonNode;
    // Smoothed signed rate (0.4 kg/wk, losing → toward goal).
    expect(textOf(findByTestId(tree, "progress-hierarchy-hero-rate"))).toContain(
      "0.4 kg / wk · trend",
    );
    const projection = textOf(findByTestId(tree, "progress-hierarchy-projection"));
    expect(projection).toContain("4.4 kg to go");
    expect(projection).toContain("at this pace ~");
    expect(projection).toContain("An estimate, not a promise.");
  });
});

// ---------------------------------------------------------------------------
// 3 — trends_only: no absolute weight, no tinted hero
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — trends_only (mobile)", () => {
  it("renders the plain trend card with NO absolute kg/lb and NO tinted hero", () => {
    const props = baseProps();
    props.mode = "trends_only";
    const r = render(<ProgressHierarchyV1 {...props} />);
    const card = findByTestId(r.toJSON() as JsonNode, "progress-hierarchy-trend-only");
    expect(card).not.toBeNull();
    expect(textOf(card)).not.toMatch(ABSOLUTE_WEIGHT_RE);
    expect(r.queryByTestId("progress-hierarchy-trajectory-hero")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4 — full opt-out: This Week promotes to the top slot
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — weight opt-out (mobile)", () => {
  it("hide mode: NO Trajectory section; This Week leads by position", () => {
    const props = baseProps();
    props.mode = "hide";
    const r = render(<ProgressHierarchyV1 {...props} />);
    expect(r.queryByTestId("progress-hierarchy-trajectory-hero")).toBeNull();
    expect(r.queryByTestId("progress-hierarchy-trend-only")).toBeNull();
    expect(sectionRoots(r.toJSON() as JsonNode | JsonNode[])).toEqual([
      "progress-hierarchy-week",
      "progress-hierarchy-energy",
      "progress-hierarchy-body-comp",
      "progress-hierarchy-your-week",
    ]);
  });
});

describe("ProgressHierarchyV1 — sparse weight with other progress (mobile, ENG-1578)", () => {
  it("lets available weekly evidence lead and moves weight setup into slot two", () => {
    const props = baseProps();
    props.promoteAvailableProgress = true;
    props.trajectory = {
      ...props.trajectory!,
      trend: { ...props.trajectory!.trend, points: [] },
      weightKgByDay: {},
      latestWeightKg: null,
    };
    const r = render(<ProgressHierarchyV1 {...props} />);
    expect(sectionRoots(r.toJSON() as JsonNode | JsonNode[])).toEqual([
      "progress-hierarchy-week",
      "progress-hierarchy-trajectory-hero",
      "progress-hierarchy-energy",
      "progress-hierarchy-body-comp",
      "progress-hierarchy-your-week",
    ]);
  });
});

// ---------------------------------------------------------------------------
// 5 — §3 Energy: the equation in words, correct arithmetic
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §3 Energy equation (mobile)", () => {
  it("deficit: lead numeral = maintenance − intake; support line spells the equation", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const tree = r.toJSON() as JsonNode;
    // 2073 − 1840 = 233 (deficit).
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy-deficit"))).toContain(
      (233).toLocaleString(),
    );
    const section = textOf(findByTestId(tree, "progress-hierarchy-energy"));
    expect(section).toContain("Average daily deficit");
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy-equation"))).toBe(
      `${(2073).toLocaleString()} maintenance − ${(1840).toLocaleString()} intake`,
    );
  });

  it("surplus: negative maintenance − intake flips the label and stays |Δ| in the lead", () => {
    const props = baseProps();
    props.energy = { ...props.energy!, avgIntakeKcal: 2400, maintenanceKcal: 2000 };
    const r = render(<ProgressHierarchyV1 {...props} />);
    const tree = r.toJSON() as JsonNode;
    // 2000 − 2400 = −400 → surplus of 400.
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy-deficit"))).toContain(
      (400).toLocaleString(),
    );
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy"))).toContain(
      "Average daily surplus",
    );
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy-equation"))).toBe(
      `${(2000).toLocaleString()} maintenance − ${(2400).toLocaleString()} intake`,
    );
  });

  it("§5 quiet week: verdict renders, Share pill does not (shareText null)", () => {
    const props = baseProps();
    props.yourWeek = { ...props.yourWeek!, headline: "Quiet week.", shareText: null, usualMealLine: null, bestDay: null };
    const r = render(<ProgressHierarchyV1 {...props} />);
    const tree = r.toJSON() as JsonNode;
    expect(textOf(findByTestId(tree, "progress-hierarchy-your-week-verdict"))).toBe("Quiet week.");
    expect(findByTestId(tree, "progress-hierarchy-your-week-share")).toBeNull();
  });

  it("below the story floor the numeral gives way — no confident deficit from one logged day", () => {
    const props = baseProps();
    props.energy = { ...props.energy!, hasEnoughData: false };
    const r = render(<ProgressHierarchyV1 {...props} />);
    const tree = r.toJSON() as JsonNode;
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy-deficit"))).toBe("—");
    expect(findByTestId(tree, "progress-hierarchy-energy-equation")).toBeNull();
    expect(textOf(findByTestId(tree, "progress-hierarchy-energy"))).toContain(
      "An honest average needs a few more logged days",
    );
  });

  it("confidence renders as bare overline text (Adaptive · high confidence)", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    expect(
      textOf(findByTestId(r.toJSON() as JsonNode, "progress-hierarchy-energy-confidence")),
    ).toBe("Adaptive · high confidence");
  });
});

// ---------------------------------------------------------------------------
// 6 — §2 This Week: both stats, never conflated
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §2 headline (mobile)", () => {
  it("carries the adherence average AND the N-of-7 on-target count as distinct figures", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const headline = textOf(
      findByTestId(r.toJSON() as JsonNode, "progress-hierarchy-week-headline"),
    );
    expect(headline).toContain("82%");
    expect(headline).toContain("avg");
    expect(headline).toContain("5 of 7 days on target");
  });
});

// ---------------------------------------------------------------------------
// 7 — §4 Body composition: free-with-data = values AND lock (delta 2)
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §4 free tier with data (mobile)", () => {
  it("renders the user-owned values free AND the Pro lock on the trend layer", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const tree = r.toJSON() as JsonNode;
    const values = textOf(findByTestId(tree, "progress-hierarchy-body-comp-values"));
    expect(values).toContain("24.1%");
    expect(values).toContain("52.3 kg");
    // The trend layer stays locked — both surfaces coexist.
    expect(findByTestId(tree, "progress-hierarchy-body-comp-locked-trend")).not.toBeNull();
    expect(r.getByTestId("progress-hierarchy-body-comp-paywall")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 8 — §5 Your Week: no restated streak/avg numerals
// ---------------------------------------------------------------------------

describe("ProgressHierarchyV1 — §5 verdict layer (mobile)", () => {
  it("renders verdict + texture + share, with NO restated streak/avg numbers", () => {
    const r = render(<ProgressHierarchyV1 {...baseProps()} />);
    const tree = r.toJSON() as JsonNode;
    expect(
      textOf(findByTestId(tree, "progress-hierarchy-your-week-verdict")),
    ).toBe("A steady week — protein carried you.");
    expect(
      textOf(findByTestId(tree, "progress-hierarchy-your-week-texture")),
    ).toContain("Overnight oats carried the week");
    expect(r.getByTestId("progress-hierarchy-your-week-share")).toBeTruthy();
    // §2 owns these numbers — the fixture's 82% avg and 4-day streak must
    // not echo here.
    const text = textOf(findByTestId(tree, "progress-hierarchy-your-week"));
    expect(text).not.toContain("82");
    expect(text).not.toContain("%");
    expect(text).not.toMatch(/streak/i);
  });
});
