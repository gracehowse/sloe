// @vitest-environment jsdom

/**
 * ENG-740 — merged Week-Digest card render pins (mobile).
 *
 * Mirror of `tests/unit/digestBlended.test.tsx` (web). Pins that the
 * blended card structure (hero + metric strip + PATTERN row +
 * maintenance row) renders, the hero tone wiring, the suppression
 * gates, the empty state, and that `<Digest>` dispatches between the
 * blended and legacy layouts on the `blended` prop.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    backgroundSecondary: "#F2EFEA",
    card: "#fff",
    cardElevated: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
    primaryForeground: "#fff",
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

import { isFeatureEnabled } from "@/lib/analytics";
import { Digest, type DigestProps } from "../../components/Digest";
import type { DigestBlendedExtras } from "@suppr/nutrition-core/digest";

const baseProps: DigestProps = {
  weekKey: "2026-W21",
  weekLabel: "May 18–24",
  daysLogged: 7,
  mealsLogged: 22,
  headline: "Closest to target: Saturday.",
  stats: {
    streakDays: 7,
    streakFreezesAvailable: 0,
    avgCalories: 1017,
    avgProtein: 53,
    proteinAdherencePct: 52,
    weightDeltaKg: 0,
    weightFirstKg: 54.9,
    weightLastKg: 54.9,
  },
  narrative: {
    closestToTarget: { label: "Saturday", protein: 42, calories: 680 },
    maintenanceLine:
      "Maintenance landed around 1,568 kcal this week — formula said 1,670.",
    usualMeal: null,
  },
  shareText: "My week on Suppr",
  state: "success",
  onShare: () => {},
  onDismiss: () => {},
};

const extras: DigestBlendedExtras = {
  dayOfWeekPattern: {
    highDay: "Sunday",
    lowDay: "Friday",
    deltaKcal: 1657,
    highDayAvg: 2400,
    lowDayAvg: 743,
  },
  closestDayTargetCalories: 901,
};

describe("DigestBlended — structure (mobile)", () => {
  it("renders the hero, metric strip, PATTERN row, and maintenance row", () => {
    const { getByTestId } = render(
      <Digest blended blendedExtras={extras} onAdjustPace={() => {}} {...baseProps} />,
    );
    expect(getByTestId("digest")).toBeTruthy();
    expect(getByTestId("digest-hero-day")).toBeTruthy();
    expect(getByTestId("digest-hero-track")).toBeTruthy();
    expect(getByTestId("digest-stat-strip")).toBeTruthy();
    expect(getByTestId("digest-pattern-summary")).toBeTruthy();
    expect(getByTestId("digest-maintenance-line")).toBeTruthy();
    expect(getByTestId("digest-adjust-pace")).toBeTruthy();
  });

  it("renders the closest-day name + calories + protein supporting line", () => {
    const { getByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} />,
    );
    expect(getByTestId("digest-hero-day").props.children).toBe("Saturday");
    // The calories node nests the number + a "kcal" Text child; assert
    // the leading numeric child rather than serialising React nodes.
    const cal = getByTestId("digest-hero-calories");
    const calChildren = ([] as unknown[]).concat(cal.props.children);
    expect(calChildren[0]).toBe("680");
    // Protein supporting line children = [42, "g protein · …"] → join.
    const proteinText = ([] as unknown[])
      .concat(getByTestId("digest-hero-protein").props.children)
      .join("");
    expect(proteinText).toContain("42g protein");
  });

  it("renders the PATTERN delta", () => {
    const { getByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} />,
    );
    // delta node children = ["+", "1,657", " kcal"] → join + assert.
    const delta = getByTestId("digest-pattern-delta");
    const text = ([] as unknown[]).concat(delta.props.children).join("");
    expect(text).toContain("1,657");
  });
});

describe("DigestBlended — suppression gates (mobile)", () => {
  it("omits the hero track when there is no per-day target", () => {
    const { queryByTestId, getByTestId } = render(
      <Digest
        blended
        blendedExtras={{ dayOfWeekPattern: null, closestDayTargetCalories: null }}
        {...baseProps}
      />,
    );
    expect(queryByTestId("digest-hero-track")).toBeNull();
    expect(getByTestId("digest-hero-calories")).toBeTruthy();
  });

  it("suppresses the PATTERN row under 4 logged days", () => {
    const { queryByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} daysLogged={3} state="partial" />,
    );
    expect(queryByTestId("digest-pattern")).toBeNull();
  });

  it("suppresses the maintenance row when the line is null", () => {
    const { queryByTestId } = render(
      <Digest
        blended
        blendedExtras={extras}
        {...baseProps}
        narrative={{ ...baseProps.narrative, maintenanceLine: null }}
      />,
    );
    expect(queryByTestId("digest-maintenance-line")).toBeNull();
  });

  it("renders a calm empty hero without inventing numbers", () => {
    const { getByTestId, queryByTestId } = render(
      <Digest
        blended
        blendedExtras={extras}
        {...baseProps}
        daysLogged={0}
        state="empty"
        headline="Quiet week."
        narrative={{ closestToTarget: null, maintenanceLine: null, usualMeal: null }}
      />,
    );
    expect(getByTestId("digest-hero-empty")).toBeTruthy();
    expect(queryByTestId("digest-pattern")).toBeNull();
    expect(queryByTestId("digest-maintenance-line")).toBeNull();
  });
});

describe("Digest dispatcher — flag gating (mobile)", () => {
  it("renders the LEGACY layout when `blended` is absent", () => {
    const { getByTestId, queryByTestId } = render(<Digest {...baseProps} />);
    expect(getByTestId("digest")).toBeTruthy();
    // Legacy renders the closest-to-target sentence node; blended doesn't.
    expect(getByTestId("digest-closest-to-target")).toBeTruthy();
    expect(queryByTestId("digest-hero-day")).toBeNull();
  });

  it("renders the BLENDED layout when `blended` is true", () => {
    const { getByTestId, queryByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} />,
    );
    expect(getByTestId("digest-hero-day")).toBeTruthy();
    expect(queryByTestId("digest-closest-to-target")).toBeNull();
  });
});

describe("DigestBlended — hero fill gate (progress_digest_beige_v2, mobile)", () => {
  afterEach(() => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
  });

  it("keeps the opaque legacy beige when the flag is OFF", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const { getByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} />,
    );
    expect(getByTestId("digest-hero").props.style.backgroundColor).toBe("#F2EFEA");
  });

  it("pulls the hero to web's muted/40 tint when the flag is ON", () => {
    // Sloe oat-secondary #F2EFEA + 40% alpha (`66`) composites over the white
    // card — web parity (the hero passes the secondary surface through + alpha).
    vi.mocked(isFeatureEnabled).mockImplementation(
      (flag: string) => flag === "progress_digest_beige_v2",
    );
    const { getByTestId } = render(
      <Digest blended blendedExtras={extras} {...baseProps} />,
    );
    expect(getByTestId("digest-hero").props.style.backgroundColor).toBe("#F2EFEA66");
  });
});
