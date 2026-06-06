// @vitest-environment jsdom
/**
 * Activity & energy — Sloe `TD1 · Activity & energy` re-skin (Today re-skin
 * unit 3, 2026-06-03). Figma 459:2 /
 * `docs/prototypes/stitch-sloe/today-activity.html`.
 *
 * Two components share the TD1 frame: `TodayActivityCard` (Steps & activity)
 * and `TodayActivityBonusCard` (Energy balance + 7-day rolling). The
 * pre-existing maintenance-tile contracts stay covered by
 * `todayActivityBonusCardMaintenanceTile.test.tsx` (all still green). This
 * file pins the NEW re-skin surface:
 *   1. Steps & activity renders the steps count / goal + active energy.
 *   2. Energy balance promotes the NET to a headline (testID
 *      `today-activity-bonus-net-headline`) and the supporting tile row is
 *      Burned / Eaten (+ Maintenance, gated) — NO "Net" tile.
 *   3. The P2-31 honesty rule survives: with nothing eaten, the net headline
 *      reads neutral (it's just the burn, not a real balance).
 *   4. The 7-day rolling rollup still renders its three derived lines, inside
 *      its own rounded Sloe card.
 *   5. Label case matches the Figma TD1 exactly (corrected 2026-06-04 — a
 *      prior pass Title-cased these): section headers ("Energy balance") stay
 *      Title case; the stat-tile labels (BURNED · EATEN · MAINTENANCE), the
 *      slider axis labels (DEFICIT · MAINTENANCE · SURPLUS) and the
 *      7-DAY ROLLING overline are UPPERCASE small-caps.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayActivityCard } from "../../components/today/TodayActivityCard";
import { TodayActivityBonusCard } from "../../components/today/TodayActivityBonusCard";

void React;

const NOOP = () => undefined;

const STYLES = { card: {}, cardTitle: {} };

/** Flatten a possibly-nested RN style prop into one object. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

/**
 * The Figma TD1 frame puts the stat-tile labels (BURNED · EATEN ·
 * MAINTENANCE), the slider axis labels (DEFICIT · MAINTENANCE · SURPLUS) and
 * the 7-DAY ROLLING overline in UPPERCASE small-caps — `Type.label` carries
 * `textTransform: "uppercase"` + letter-spacing.
 */
function expectUppercase(node: { props: { style?: unknown } }) {
  const style = flattenStyle(node.props?.style);
  expect(style.textTransform).toBe("uppercase");
}

/** Section headers ("Steps & activity", "Energy balance") stay Title case. */
function expectTitleCase(node: { props: { style?: unknown } }) {
  const style = flattenStyle(node.props?.style);
  expect(style.textTransform).not.toBe("uppercase");
}

describe("TodayActivityCard — TD1 Steps & activity", () => {
  it("renders the steps count over its goal and the active energy", () => {
    const { getByText } = render(
      <TodayActivityCard
        dayLabel="Today"
        stepsCount={4200}
        dailyStepsGoal={10000}
        activityBurnKcal={310}
        styles={STYLES}
        textColor="#221B26"
        textSecondaryColor="#6A6072"
        textTertiaryColor="#9B93A3"
        borderColor="#E8E2EC"
      />,
    );
    expect(getByText("Steps & activity")).toBeTruthy();
    // Steps count + goal render in one Text ("4,200 / 10,000").
    expect(getByText(/4,200/)).toBeTruthy();
    expect(getByText(/10,000/)).toBeTruthy();
    // Active energy value + unit render in one Text ("310 kcal").
    expect(getByText(/310/)).toBeTruthy();
  });

  it("shows an em-dash + connect hint when no active energy is synced", () => {
    const { getByText } = render(
      <TodayActivityCard
        dayLabel="Today"
        stepsCount={null}
        dailyStepsGoal={10000}
        activityBurnKcal={null}
        styles={STYLES}
        textColor="#221B26"
        textSecondaryColor="#6A6072"
        textTertiaryColor="#9B93A3"
        borderColor="#E8E2EC"
      />,
    );
    expect(getByText(/Active calories appear here once a source is connected/)).toBeTruthy();
  });
});

type BonusProps = React.ComponentProps<typeof TodayActivityBonusCard>;

function bonusProps(overrides: Partial<BonusProps> = {}): BonusProps {
  return {
    isToday: true,
    hasBurnData: true,
    totalBurnKcal: 2100,
    consumedCalories: 1500,
    effectiveCalorieGoal: 1800,
    basalBurnKcal: 1500,
    activityBurnKcal: 600,
    todayActivityBudgetAddon: 0,
    dayWorkouts: [],
    trackerWeekSummaryKeys: [],
    activityBurnByDay: {},
    basalBurnByDay: {},
    byDay: {},
    weekSummaryMode: "rolling",
    onOpenBurnDetail: NOOP,
    styles: STYLES,
    textColor: "#221B26",
    textSecondaryColor: "#6A6072",
    textTertiaryColor: "#9B93A3",
    borderColor: "#E8E2EC",
    cardColor: "#F6F5F2",
    cardBorderColor: "#E8E2EC",
    maintenanceTdeeKcal: null,
    profileSex: "male",
    profileWeightKg: 80,
    profileHeightCm: 180,
    profileAge: 30,
    profileActivityLevel: "sedentary",
    maintenanceSource: "formula",
    maintenanceConfidence: null,
    ...overrides,
  };
}

describe("TodayActivityBonusCard — TD1 Energy balance hero", () => {
  it("labels the hero 'Net energy' with a deficit chip and promotes net to a headline", () => {
    const { getByText, getByTestId } = render(
      <TodayActivityBonusCard {...bonusProps({ totalBurnKcal: 2100, consumedCalories: 1500 })} />,
    );
    expect(getByText("Net energy")).toBeTruthy();
    expect(getByTestId("today-activity-bonus-net-chip")).toBeTruthy();
    const headline = getByTestId("today-activity-bonus-net-headline");
    // net = 2100 - 1500 = 600 deficit.
    expect(headline).toBeTruthy();
    expect(getByText("600")).toBeTruthy();
    expect(getByText("kcal deficit")).toBeTruthy();
    expect(getByText(/You've burned 600 more than you've eaten today\./)).toBeTruthy();
  });

  it("the supporting tile row is Burned / Eaten — no 'Net' tile (it's the headline now)", () => {
    const { getByText, queryByText } = render(
      <TodayActivityBonusCard {...bonusProps()} />,
    );
    expect(getByText("Burned")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
    // The old "Net deficit"/"Net surplus" tile label must be gone from the
    // tile row (net is the headline; the tile label "Net …" no longer exists).
    expect(queryByText("Net deficit")).toBeNull();
    expect(queryByText("Net surplus")).toBeNull();
  });

  it("renders the stat-tile + axis labels in UPPERCASE small-caps (Figma TD1 'BURNED · EATEN · MAINTENANCE')", () => {
    const { getByText, getAllByText } = render(
      <TodayActivityBonusCard {...bonusProps({ maintenanceTdeeKcal: 1216 })} />,
    );
    // Supporting tile row labels — restored to the Figma's UPPERCASE
    // treatment ("BURNED / EATEN / MAINTENANCE") via Type.label.
    expectUppercase(getByText("Burned"));
    expectUppercase(getByText("Eaten"));
    // "Maintenance" appears twice (the stat tile + the slider axis label);
    // BOTH must be UPPERCASE.
    getAllByText("Maintenance").forEach(expectUppercase);
    // Energy-balance axis labels under the calm slider (DEFICIT · SURPLUS).
    // "Deficit" also appears on the state chip — assert ≥1 axis label.
    getAllByText("Deficit").forEach(expectUppercase);
    expectUppercase(getByText("Surplus"));
    // "Net energy" is an overline label (uppercase via Type.label).
    expectUppercase(getByText("Net energy"));
  });

  it("when nothing is eaten, shows burned-so-far subline and a deficit chip", () => {
    const { getByText, getByTestId } = render(
      <TodayActivityBonusCard {...bonusProps({ totalBurnKcal: 500, consumedCalories: 0 })} />,
    );
    expect(getByTestId("today-activity-bonus-net-headline")).toBeTruthy();
    expect(getByText("kcal deficit")).toBeTruthy();
    expect(getByText(/500 kcal burned so far · no food logged yet\./)).toBeTruthy();
  });

  it("renders a surplus headline when more was eaten than burned", () => {
    const { getByText } = render(
      <TodayActivityBonusCard {...bonusProps({ totalBurnKcal: 1500, consumedCalories: 2100 })} />,
    );
    // net = 1500 - 2100 = -600 → surplus of 600.
    expect(getByText("600")).toBeTruthy();
    expect(getByText("kcal surplus")).toBeTruthy();
  });
});

describe("TodayActivityBonusCard — TD1 stat-tile icons", () => {
  // The Figma TD1 (459:2 / `today-activity.html`) puts a small calm glyph
  // beside each stat label: Burned = flame, Eaten = fork/utensils,
  // Maintenance = target. The lucide shim renders each icon as a host node
  // whose `accessibilityLabel` is the icon's display name, so we can assert
  // the icons actually render (not just a source-text pin).
  it("renders Flame on Burned, Utensils on Eaten, Target on Maintenance", () => {
    const { getByLabelText, getAllByLabelText } = render(
      <TodayActivityBonusCard {...bonusProps({ maintenanceTdeeKcal: 1216 })} />,
    );
    // Eaten + Maintenance glyphs are unique to their tiles.
    expect(getByLabelText("Utensils")).toBeTruthy();
    expect(getByLabelText("Target")).toBeTruthy();
    // Flame renders on the Burned tile (and, separately, on the burn-
    // breakdown card below) — at least one Flame must be present.
    expect(getAllByLabelText("Flame").length).toBeGreaterThanOrEqual(1);
  });

  it("omits the Target (Maintenance) icon when there's no maintenance tile", () => {
    const { queryByLabelText, queryByTestId } = render(
      <TodayActivityBonusCard {...bonusProps({ maintenanceTdeeKcal: null })} />,
    );
    // No maintenance tile → no Target glyph, and the tile gate still holds.
    expect(queryByTestId("today-activity-bonus-maintenance-tile")).toBeNull();
    expect(queryByLabelText("Target")).toBeNull();
    // Burned + Eaten icons still render on their tiles.
    expect(queryByLabelText("Utensils")).toBeTruthy();
  });
});

describe("TodayActivityBonusCard — TD1 burn-breakdown card (Sloe re-skin)", () => {
  // Grace 2026-06-04: re-skin the burn/bonus card to the Sloe language
  // (Newsreader headline number, Inter labels, a single calm lucide flame,
  // Sloe rounded card) but DO NOT lose the Active / Resting / +bonus
  // breakdown, the honey "+bonus", or the chevron.
  function burnCardProps(overrides: Partial<BonusProps> = {}): BonusProps {
    return bonusProps({
      basalBurnKcal: 1355,
      activityBurnKcal: 252,
      totalBurnKcal: 1607,
      consumedCalories: 1289,
      todayActivityBudgetAddon: 318,
      onShowBurnProvenance: NOOP,
      ...overrides,
    });
  }

  it("keeps the Active / Resting / +bonus breakdown after the re-skin", () => {
    const { getByText, getByTestId } = render(<TodayActivityBonusCard {...burnCardProps()} />);
    // The headline kcal number (basal + active = 1,607) renders on the card.
    expect(getByTestId("today-burn-card-headline").props.children).toBe("1,607");
    // The breakdown must survive the re-skin (the load-bearing ask).
    expect(getByText("Active 252")).toBeTruthy();
    expect(getByText("Resting 1,355")).toBeTruthy();
    expect(getByText("+318 bonus earned")).toBeTruthy();
  });

  it("renders the headline kcal number in Newsreader (Type.headline → serif family)", () => {
    const { getByTestId } = render(<TodayActivityBonusCard {...burnCardProps()} />);
    // Sloe re-skin: the burn headline number reads in Newsreader, not the
    // old fontSize:13/700 weight. Type.headline is the serif-medium family.
    const headline = flattenStyle(getByTestId("today-burn-card-headline").props.style);
    expect(headline.fontFamily).toBe("Newsreader_500Medium");
    // And it is NOT the old heavy 700 weight.
    expect(headline.fontWeight).not.toBe("700");
  });

  it("uses a single calm lucide Flame on the burn card (not the old Ionicons flame-outline)", () => {
    // With no maintenance tile there's exactly one Flame on the stat row
    // (Burned) + one on the burn card = two; with the breakdown present the
    // burn-card flame is the second. Assert both flames render via lucide.
    const { getAllByLabelText } = render(
      <TodayActivityBonusCard {...burnCardProps({ maintenanceTdeeKcal: null })} />,
    );
    // Burned-tile Flame + burn-card Flame.
    expect(getAllByLabelText("Flame").length).toBe(2);
  });

  it("keeps the honey hue on the +bonus and stays sentence-case (not UPPERCASE)", () => {
    const { getByText } = render(<TodayActivityBonusCard {...burnCardProps()} />);
    const bonus = flattenStyle(getByText("+318 bonus earned").props.style);
    // Honey is the AA-safe `activitySolid` (ENG-885): the base #D6A24A honey is
    // fill-only (2.3:1 even on white — never passes as text). Theme-aware: light
    // #8A5A14 / dark #E0B25E. The earned-reward identity stays honey, just readable.
    expect(["#8A5A14", "#E0B25E"]).toContain(bonus.color);
    // Sentence-case (Figma "+318 bonus earned"), NOT the uppercase Type.label.
    expect(bonus.textTransform).not.toBe("uppercase");
  });

  it("keeps the F-131 provenance Info affordance after the re-skin", () => {
    const { getByTestId } = render(<TodayActivityBonusCard {...burnCardProps()} />);
    // The explain-in-place Info icon (testID) must survive the redesign.
    expect(getByTestId("today-burn-provenance-info")).toBeTruthy();
  });
});

describe("TodayActivityBonusCard — TD1 7-day rolling", () => {
  it("renders energy balance, burn breakdown, and weekly rollup as separate flat cards", () => {
    const { getByTestId } = render(
      <TodayActivityBonusCard
        {...bonusProps({ basalBurnKcal: 1355, activityBurnKcal: 252 })}
      />,
    );
    expect(getByTestId("today-energy-balance-card")).toBeTruthy();
    expect(getByTestId("today-burn-breakdown-card")).toBeTruthy();
  });

  it("renders the rolling header + the three derived lines inside its own flat card", () => {
    // Two logged days with burn + food so the weekly section shows.
    const keys = ["2026-06-01", "2026-06-02"];
    const { getByText, getByTestId } = render(
      <TodayActivityBonusCard
        {...bonusProps({
          trackerWeekSummaryKeys: keys,
          activityBurnByDay: { "2026-06-01": 400, "2026-06-02": 500 },
          basalBurnByDay: { "2026-06-01": 1500, "2026-06-02": 1500 },
          byDay: {
            "2026-06-01": [{ id: "a", name: "x", calories: 1500, protein: 0, carbs: 0, fat: 0 } as any],
            "2026-06-02": [{ id: "b", name: "y", calories: 1600, protein: 0, carbs: 0, fat: 0 } as any],
          },
        })}
      />,
    );
    // `weekSummaryHeading("rolling")` returns "7-day rolling summary"
    // (copy unchanged by the re-skin — only the overline treatment changed).
    expect(getByText("7-day rolling summary")).toBeTruthy();
    expect(getByText(/Avg daily (deficit|surplus)/)).toBeTruthy();
    expect(getByText(/Weekly (deficit|surplus)/)).toBeTruthy();
    expect(getByText(/Projected weekly (loss|gain)/)).toBeTruthy();
    expect(getByTestId("today-weekly-rolling-card")).toBeTruthy();
  });

  it("renders the 7-DAY ROLLING overline in UPPERCASE (Figma TD1; Type.label)", () => {
    const keys = ["2026-06-01", "2026-06-02"];
    const { getByText } = render(
      <TodayActivityBonusCard
        {...bonusProps({
          trackerWeekSummaryKeys: keys,
          activityBurnByDay: { "2026-06-01": 400, "2026-06-02": 500 },
          basalBurnByDay: { "2026-06-01": 1500, "2026-06-02": 1500 },
          byDay: {
            "2026-06-01": [{ id: "a", name: "x", calories: 1500, protein: 0, carbs: 0, fat: 0 } as any],
            "2026-06-02": [{ id: "b", name: "y", calories: 1600, protein: 0, carbs: 0, fat: 0 } as any],
          },
        })}
      />,
    );
    // The overline uses `Type.label` (textTransform: uppercase + letter-
    // spacing) so the Title-case STRING ("7-day rolling summary") renders as
    // the Figma's "7-DAY ROLLING …". The text node stays the verbatim string
    // (textTransform is render-only) so getByText still matches it.
    expectUppercase(getByText("7-day rolling summary"));
  });
});

describe("TodayActivityBonusCard — TD1 energy-balance calm slider", () => {
  it("renders the gradient track (sage→frost→amber) as a real SVG gradient, not a 3-segment flex", () => {
    const { UNSAFE_getByProps } = render(
      <TodayActivityBonusCard {...bonusProps({ totalBurnKcal: 2100, consumedCalories: 1500 })} />,
    );
    // The calm slider draws a `react-native-svg` LinearGradient with the
    // sage (deficit) and amber (surplus) stops — the prototype's
    // linear-gradient(90deg,#5E7C5A,…,#C9892C). The shim forwards SVG nodes
    // as host Views carrying their props, so the gradient id is queryable.
    const grad = UNSAFE_getByProps({ id: "energyBalanceTrack" });
    expect(grad).toBeTruthy();
    // Sage deficit stop + amber surplus stop both present.
    expect(UNSAFE_getByProps({ stopColor: "#5E7C5A" })).toBeTruthy();
    expect(UNSAFE_getByProps({ stopColor: "#C8794E" })).toBeTruthy();
  });

  it("omits the slider entirely when there's no burn data and nothing eaten", () => {
    const { UNSAFE_queryByProps } = render(
      <TodayActivityBonusCard
        {...bonusProps({ hasBurnData: false, totalBurnKcal: 0, consumedCalories: 0 })}
      />,
    );
    // No burn + no food → the energy-balance bar (and its gradient) must not
    // render (the headline falls back to the connect hint).
    expect(UNSAFE_queryByProps({ id: "energyBalanceTrack" })).toBeNull();
  });
});
