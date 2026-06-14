// @vitest-environment jsdom
/**
 * TodayDashboardMacroTiles — per-tile progress bar (RE-ADDED 2026-06-04,
 * Grace measured-spec pass against the Stitch `today.html` reference).
 *
 * The thin macro-coloured bar under each tile's value row was the founder's
 * #1 structural gap: the mock tiles carry a `h-1 … rounded-full` bar (a
 * frost-mist track + macro-colour fill at %-width), but it had been dropped
 * in the interim "Figma 01" pass. This test renders the tiles and pins the
 * bar back as OBSERVABLE behaviour, so removing it again breaks CI:
 *   - every tracked macro renders its bar element, and
 *   - the fill width reflects min(current/target, 1), and
 *   - reference-only macros (sugar/sodium — generic reference, not a
 *     personal target) render a DE-EMPHASISED fill so the bar never reads as
 *     a hit goal.
 *
 * Harness mirrors `todayHeroRingSloeChipStats.test.tsx` (jsdom +
 * @testing-library/react-native, no provider). This test asserts only the
 * progress-bar behaviour; the tile's resting-card elevation (now an
 * unconditional soft lift via `useCardElevation`) is covered separately by
 * `cardElevationVariants.test.tsx`.
 */
import * as React from "react";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

// ENG-1099: the per-tile bar + the value-softening are the LEGACY (flag-off)
// path — the recipe-tier tile (today_tracker_tier_v1, default-on) drops the bar
// and uses macro-hue value colour. Force the flag OFF so these tests exercise
// the legacy bar/value they pin.
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  isFeatureEnabled: (flag: string) =>
    flag === "today_tracker_tier_v1" ? false : true,
}));

import { TodayDashboardMacroTiles } from "../../components/today/TodayDashboardMacroTiles";
import { Accent } from "../../constants/theme";

void React;

const baseProps = {
  totals: { protein: 96, carbs: 142, fat: 44, fiber: 18 },
  targets: { protein: 140, carbs: 200, fat: 68, fiber: 30 },
  totalWaterMl: 0,
  waterGoalMl: 2000,
  mealsToday: [],
  onPressMacro: () => {},
  cardColor: "#F6F5F2",
  cardBorderColor: "#E8E2EC",
  borderColor: "#E8E2EC",
  textColor: "#221B26",
  textSecondaryColor: "#6A6072",
  textTertiaryColor: "#9B93A3",
  mutedColor: "#E8E2EC",
};

/** Pull the inner fill View out of a tile's bar (the bar is the single child
 *  of the testID'd track). */
function fillStyle(barNode: { props: { children?: unknown } }) {
  const child = (barNode.props.children as { props?: { style?: unknown } }) ?? {};
  return (child.props?.style ?? {}) as {
    width?: string;
    opacity?: number;
    backgroundColor?: string;
  };
}

describe("TodayDashboardMacroTiles — per-tile progress bar", () => {
  it("renders a progress bar for each tracked macro", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["protein", "carbs", "fat", "fiber"]}
      />,
    );
    for (const macro of ["protein", "carbs", "fat", "fiber"]) {
      expect(getByTestId(`today-macro-tile-bar-${macro}`)).toBeTruthy();
    }
  });

  it("fills the bar to min(current/target, 1) as a percentage width", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["protein"]}
      />,
    );
    // 96 / 140 = 68.57% → the fill width is the unclamped ratio * 100.
    const fill = fillStyle(getByTestId("today-macro-tile-bar-protein"));
    expect(fill.width).toBe(`${(96 / 140) * 100}%`);
    // Identity colour (olive-sage protein), full opacity — a real target.
    expect(fill.opacity).toBe(1);
  });

  it("clamps an over-target macro fill at 100% (over signalling is the ring's job)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        totals={{ protein: 210, carbs: 0, fat: 0, fiber: 0 }}
        targets={{ protein: 140, carbs: 200, fat: 68, fiber: 30 }}
        trackedMacros={["protein"]}
      />,
    );
    const fill = fillStyle(getByTestId("today-macro-tile-bar-protein"));
    expect(fill.width).toBe("100%");
  });

  it("renders a reference-only macro (sugar) bar with a de-emphasised fill", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["sugar"]}
      />,
    );
    const bar = getByTestId("today-macro-tile-bar-sugar");
    expect(bar).toBeTruthy();
    // Reference-only → quieter fill so it never reads as a hit personal goal.
    expect(fillStyle(bar).opacity).toBe(0.45);
  });
});

/** Helper — read a caption node's rendered text + colour. */
function captionOf(node: { props: { children?: unknown; style?: unknown } }) {
  const style = (node.props.style ?? {}) as { color?: string };
  return { text: String(node.props.children ?? ""), color: style.color };
}

describe("TodayDashboardMacroTiles — per-tile caption (audit gap 4)", () => {
  // Caption colours are token-driven and theme-branched in the component:
  //   under target → `isDark ? Accent.successLight : Accent.success`
  //   over target  → `isDark ? Accent.warningLight : Accent.warningSolid`
  // The vitest react-native shim's `useColorScheme()` returns "dark", so the
  // component renders the DARK branch here. Assert the SAME tokens the component
  // reads (never a hardcoded hex) so the test can't drift from the theme.
  const SAGE = Accent.successLight; // #83A57E — dark-branch caption-under
  const AMBER = Accent.warningLight; // #D6A24A — dark-branch caption-over
  const MUTED = "#9B93A3"; // textTertiaryColor — passed in as a prop, theme-independent

  it('shows "N g remaining" in sage when a tracked macro is under target', () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} trackedMacros={["protein"]} />,
    );
    // 140 − 96 = 44 g remaining.
    const cap = captionOf(getByTestId("today-macro-tile-caption-protein"));
    expect(cap.text).toBe("44g remaining");
    expect(cap.color).toBe(SAGE);
  });

  it('shows "N g over" in amber when a tracked macro is over target', () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        totals={{ protein: 210, carbs: 0, fat: 0, fiber: 0 }}
        trackedMacros={["protein"]}
      />,
    );
    // 210 − 140 = 70 g over.
    const cap = captionOf(getByTestId("today-macro-tile-caption-protein"));
    expect(cap.text).toBe("70g over");
    expect(cap.color).toBe(AMBER);
  });

  it('shows a muted "ref" caption for reference-only macros (sugar)', () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} trackedMacros={["sugar"]} />,
    );
    const cap = captionOf(getByTestId("today-macro-tile-caption-sugar"));
    expect(cap.text).toBe("ref 50g");
    expect(cap.color).toBe(MUTED);
  });

  it("suppresses the caption text on an unlogged tile (current = 0)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        totals={{ protein: 0, carbs: 0, fat: 0, fiber: 0 }}
        trackedMacros={["protein"]}
      />,
    );
    // The "/ target" line above already says everything; caption is empty
    // but the row still reserves its height so the grid stays even.
    expect(captionOf(getByTestId("today-macro-tile-caption-protein")).text).toBe("");
  });
});

describe("TodayDashboardMacroTiles — serif zero softening (audit gap 8)", () => {
  const INK = "#221B26"; // textColor — full editorial ink
  const MUTED = "#9B93A3"; // textTertiaryColor — softened zero

  /** Walk the value Text (the serif numeral) for one macro and read its
   *  colour. The value Text is the node whose first child is the rendered
   *  number string. */
  function valueColor(totals: typeof baseProps.totals): string | undefined {
    const { UNSAFE_getAllByType } = render(
      <TodayDashboardMacroTiles {...baseProps} totals={totals} trackedMacros={["protein"]} />,
    );
    // The serif value Text carries `fontVariant: ['tabular-nums']` AND a
    // numeric first child — uniquely identifies it vs the caption/label Texts.
    // `Text` is imported top-of-file so vite-node resolves it through the alias
    // chain to the react-native shim; an inline `require("react-native")` here
    // bypasses that resolver and loads the real (ESM) RN entrypoint, throwing
    // "Cannot use import statement outside a module".
    const texts = UNSAFE_getAllByType(Text) as Array<{ props: { style?: unknown; children?: unknown } }>;
    const valueNode = texts.find((t) => {
      const style = Array.isArray(t.props.style)
        ? Object.assign({}, ...t.props.style)
        : (t.props.style as { fontVariant?: unknown; fontSize?: number } | undefined) ?? {};
      const firstChild = Array.isArray(t.props.children) ? t.props.children[0] : t.props.children;
      return (
        Array.isArray((style as { fontVariant?: unknown }).fontVariant) &&
        (style as { fontSize?: number }).fontSize === 20 &&
        typeof firstChild === "string"
      );
    });
    const style = Array.isArray(valueNode?.props.style)
      ? Object.assign({}, ...(valueNode!.props.style as object[]))
      : ((valueNode?.props.style as { color?: string }) ?? {});
    return (style as { color?: string }).color;
  }

  it("renders the serif value in full ink when the macro has data", () => {
    expect(valueColor({ protein: 96, carbs: 0, fat: 0, fiber: 0 })).toBe(INK);
  });

  it("softens the serif value to muted while the macro is a zero", () => {
    expect(valueColor({ protein: 0, carbs: 0, fat: 0, fiber: 0 })).toBe(MUTED);
  });
});
