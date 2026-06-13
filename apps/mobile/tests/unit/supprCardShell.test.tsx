// @vitest-environment jsdom
/**
 * <SupprCard> — THE single card primitive (Grace 2026-06-04 consolidation:
 * "the cards are being handled separately ... they should all be the same
 * component updated at once").
 *
 * This renders the shell and pins the consolidation CONTRACT every card surface
 * now relies on, so a future change can't quietly re-diverge the cards:
 *   - the default lift is FLAT (Figma `654:2` slab — no shadow, no border); the
 *     elevated recipe-card surfaces opt into `lift="soft"`;
 *   - the OUTER node carries the lift (when `soft`) + fill + radius + the testID;
 *   - the INNER node clips (overflow:hidden) — the iOS clip fix lives here once;
 *   - `size` drives the radius (card/tile/inset all = 24, the Figma chosen Today
 *     borderless warm slabs) — every card shares the exact corner;
 *   - `size="inset"` carries NO drop shadow (card-on-card must not double up);
 *   - the flat slab and the light soft-lift both drop the border (the fill /
 *     shadow is the separation), while `inset` always draws the hairline.
 *
 * Harness mirrors `cardElevationVariants.test.tsx` (the theme is mocked
 * so `useCardElevation` resolves a deterministic light/dark treatment).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";


void React;

const themeState: { resolved: "light" | "dark"; colors: Record<string, string> } = {
  resolved: "light",
  colors: {
    card: "#F6F5F2",
    cardElevated: "#2A2730",
    border: "#E8E2EC",
    northStarBgFrom: "rgba(59,42,77,0.08)",
    northStarBorder: "rgba(59,42,77,0.18)",
    overBudgetSoft: "rgba(192,83,63,0.08)",
    overBudgetFg: "#C0533F",
    sourceUsda: "#5E7C5A",
    sourceAi: "#6A4B7A",
  },
};
vi.mock("@/context/theme", () => ({
  useTheme: () => themeState,
}));

// eslint-disable-next-line import/first
import { CARD_RADIUS, INSET_RADIUS, SupprCard, TILE_RADIUS } from "../../components/ui/SupprCard";

/** Flatten an RN style prop (array | object) into one object. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce(
      (acc: Record<string, unknown>, s) => ({ ...acc, ...flatten(s) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe("<SupprCard> — the consolidated card shell", () => {
  it("the default (no lift) is a FLAT slab on the OUTER node — fill + radius, no shadow", () => {
    // Figma `654:2`: the default card is a borderless, shadowless warm slab —
    // the `#F6F5F2` fill on the white page is the separation. Pins the shell's
    // `lift="flat"` default (flipped in the 2026-06-04 "flat slabs" sweep).
    themeState.resolved = "light";
    const { getByTestId } = render(
      <SupprCard testID="card-flat">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("card-flat");
    const style = flatten(outer.props.style);
    expect(style.backgroundColor).toBe("#F6F5F2");
    expect(style.borderRadius).toBe(CARD_RADIUS);
    expect(CARD_RADIUS).toBe(24);
    // Flat slab — no drop shadow on the outer node, and no inner border.
    expect(style.shadowOpacity).toBeUndefined();
    expect(flatten(outer.props.children.props.style).borderWidth).toBe(0);
  });

  it("lift='soft' renders FLAT — fill + radius on the OUTER node, no shadow (flat-card surfaces 2026-06-12)", () => {
    // Flat-card surfaces (docs/decisions/2026-06-12-flat-card-surfaces.md):
    // the soft lift is RETIRED; `lift="soft"` is an accepted no-op. Separation
    // is the card fill against the ground alone — zero shadow.
    themeState.resolved = "light";
    const { getByTestId } = render(
      <SupprCard testID="card-x" lift="soft">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("card-x");
    const style = flatten(outer.props.style);
    // Warm-grey #F6F5F2 fill — the same card colour everywhere.
    expect(style.backgroundColor).toBe("#F6F5F2");
    // The canonical card radius (24).
    expect(style.borderRadius).toBe(CARD_RADIUS);
    expect(CARD_RADIUS).toBe(24);
    // FLAT: no drop shadow on the outer node.
    expect(style.shadowOpacity).toBeUndefined();
  });

  it("clips on a SEPARATE inner node (the iOS clip fix), which has NO shadow", () => {
    // Flat-card surfaces: there is no resting shadow to clip, but the
    // outer/inner split is retained so any future lift (e.g. a sanctioned
    // overlay) rides the outer wrapper, never the inner `overflow:hidden` node.
    themeState.resolved = "light";
    const { getByTestId } = render(
      <SupprCard testID="card-clip" lift="soft">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("card-clip");
    const inner = outer.props.children;
    const innerStyle = flatten(inner.props.style);
    expect(innerStyle.overflow).toBe("hidden");
    // The inner (clipping) node must not carry the shadow — iOS would swallow it.
    expect(innerStyle.shadowOpacity).toBeUndefined();
    // And the light soft-lift card drops the inner border (shadow is the separation).
    expect(innerStyle.borderWidth).toBe(0);
  });

  it("size='tile' rounds to 24 (the macro-tile corner, same as the card)", () => {
    const { getByTestId } = render(
      <SupprCard testID="tile" size="tile">
        <></>
      </SupprCard>,
    );
    expect(flatten(getByTestId("tile").props.style).borderRadius).toBe(TILE_RADIUS);
    expect(TILE_RADIUS).toBe(24);
  });

  it("size='inset' rounds to 12 (concentric inner corner, 2026-06-10 decision), draws a hairline, and carries NO drop shadow", () => {
    themeState.resolved = "light";
    const { getByTestId } = render(
      <SupprCard testID="inset" size="inset">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("inset");
    const outerStyle = flatten(outer.props.style);
    expect(outerStyle.borderRadius).toBe(INSET_RADIUS);
    expect(INSET_RADIUS).toBe(12);
    // No drop shadow on a card-on-card.
    expect(outerStyle.shadowOpacity).toBeUndefined();
    // The inset's hairline is its separation (it sits ON a card with no lift).
    const innerStyle = flatten(outer.props.children.props.style);
    expect(innerStyle.borderWidth).toBeGreaterThan(0);
    expect(innerStyle.borderColor).toBe("#E8E2EC");
  });

  it("dark mode (soft) keeps ONLY the tonal fill — no shadow, no hairline (flat-card surfaces)", () => {
    // Flat-card surfaces (2026-06-12): dark soft keeps the tonal `cardElevated`
    // fill as the separation but DROPS the hairline (and never a shadow — RN
    // renders dark shadows poorly). Mirrors web `.dark .card-slab`.
    themeState.resolved = "dark";
    const { getByTestId } = render(
      <SupprCard testID="dark-card" lift="soft">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("dark-card");
    const outerStyle = flatten(outer.props.style);
    // Tonal fill, not a shadow.
    expect(outerStyle.backgroundColor).toBe("#2A2730");
    expect(outerStyle.shadowOpacity).toBeUndefined();
    // Hairline dropped — fill IS the separation.
    expect(flatten(outer.props.children.props.style).borderWidth).toBe(0);
    themeState.resolved = "light"; // restore for ordering
  });

  it("tone='warning' tints the fill + border (shared tone map)", () => {
    themeState.resolved = "light";
    const { getByTestId } = render(
      <SupprCard testID="warn" tone="warning">
        <></>
      </SupprCard>,
    );
    const outer = getByTestId("warn");
    expect(flatten(outer.props.style).backgroundColor).toBe("rgba(192,83,63,0.08)");
  });
});
