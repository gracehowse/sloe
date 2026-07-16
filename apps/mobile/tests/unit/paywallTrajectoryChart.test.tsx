// @vitest-environment jsdom

/**
 * ENG-969 — PaywallTrajectoryChart render pins (mobile).
 *
 * The projection MATHS is pinned by the shared `computeTrajectory` /
 * `projectWeight` suites; these tests pin the paywall RENDER contract:
 *   - a REAL projection (≥5 logged days + a weight) draws the chart, hero,
 *     and the "estimate, not a promise" footnote;
 *   - a below-floor (placeholder) or no-weight input renders NOTHING — a
 *     conversion surface never nags "log 5 more days" and never fabricates a
 *     forecast.
 *
 * Tests the pure `PaywallTrajectoryChartView` (data-prop-driven) so no
 * Supabase / auth mock is needed.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
  }),
}));

// The pure View under test never touches these, but the data-loading sibling
// in the same module imports them at module load — stub so the client isn't
// constructed (no `supabaseUrl` in the test env).
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ session: null }) }));

import { PaywallTrajectoryChartView } from "../../components/paywall/PaywallTrajectoryChart";

type Meal = { calories?: number | null };
function buildDays(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-05-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

describe("PaywallTrajectoryChartView — projection state (mobile)", () => {
  it("renders the chart, hero kg + horizon, basis, and honest footnote", () => {
    const { getByTestId } = render(
      <PaywallTrajectoryChartView
        byDay={buildDays(7, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
        maintenanceTdeeKcal={2200}
        goal="lose"
      />,
    );
    expect(getByTestId("paywall-trajectory-chart")).toBeTruthy();
    expect(getByTestId("paywall-trajectory-svg")).toBeTruthy();

    const heroEl = getByTestId("paywall-trajectory-hero-kg");
    const heroChildren = ([] as unknown[]).concat(heroEl.props.children);
    const flatHeroText = heroChildren
      .map((c: unknown) =>
        c !== null && typeof c === "object" && "props" in (c as object)
          ? ([] as unknown[]).concat((c as { props: { children: unknown } }).props.children).join("")
          : String(c),
      )
      .join("");
    expect(flatHeroText).toContain("kg");

    const when = ([] as unknown[])
      .concat(getByTestId("paywall-trajectory-when").props.children)
      .join("");
    expect(when).toContain("weeks");
  });
});

describe("PaywallTrajectoryChartView — never fabricates / nags (mobile)", () => {
  it("renders nothing below the projection floor (no placeholder nag on a paywall)", () => {
    const { queryByTestId } = render(
      <PaywallTrajectoryChartView byDay={buildDays(3, 1500)} latestWeightKg={70} targetCalories={1500} />,
    );
    expect(queryByTestId("paywall-trajectory-chart")).toBeNull();
    expect(queryByTestId("paywall-trajectory-svg")).toBeNull();
  });

  it("renders nothing when there is no current weight", () => {
    const { queryByTestId } = render(
      <PaywallTrajectoryChartView byDay={buildDays(7, 1500)} latestWeightKg={null} targetCalories={1500} />,
    );
    expect(queryByTestId("paywall-trajectory-chart")).toBeNull();
  });

  it("renders nothing when no days are logged at all", () => {
    const { queryByTestId } = render(
      <PaywallTrajectoryChartView byDay={{}} latestWeightKg={70} targetCalories={1500} />,
    );
    expect(queryByTestId("paywall-trajectory-chart")).toBeNull();
  });
});

describe("PaywallTrajectoryChartView — calm mode (ENG-1444/LEGAL-011)", () => {
  it("renders nothing when calmMode is true, even with a valid projection", () => {
    const { queryByTestId } = render(
      <PaywallTrajectoryChartView
        byDay={buildDays(7, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
        maintenanceTdeeKcal={2200}
        goal="lose"
        calmMode
      />,
    );
    expect(queryByTestId("paywall-trajectory-chart")).toBeNull();
  });
});
