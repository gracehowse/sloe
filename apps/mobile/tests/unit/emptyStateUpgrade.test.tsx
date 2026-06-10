// @vitest-environment jsdom
/**
 * EmptyState upgrade pin (ui-critic finding #6, P1).
 *
 * The pre-2026-05-02 primitive surfaced empty tabs as 13pt bold over a
 * tiny 6pt gap — too quiet to read as a state. The new shape:
 *   - Optional `illustration` slot rendered inside a 72pt
 *     `accent.primary + "10"` tinted disc (scheme-resolved via `useAccent()`).
 *   - Title routed through `Type.headline` (17pt).
 *   - Description routed through `Type.body` (14pt).
 *   - Optional `cta` slot below.
 *
 * Backwards compatibility: callers that pass only `title` (no
 * illustration / cta) still render — the illustration disc and CTA
 * are skipped so the existing call sites don't break.
 */
import * as React from "react";
import { Pressable, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { EmptyState } from "../../components/EmptyState";
import { Accent, Type } from "../../constants/theme";

void React;

/**
 * Walk the rendered tree, flattening every element's `style` prop so we
 * can assert on the disc shape regardless of how RN merges array
 * styles. RN StyleSheet.create returns numeric ids on native; under
 * RNTL the ids resolve back to the source object, so a flat merge gives
 * the actual numeric values.
 */
function collectFlatStyles(root: any): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  function walk(node: any) {
    if (!node) return;
    const s = node?.props?.style;
    if (s) {
      const merged = Array.isArray(s)
        ? Object.assign({}, ...s.filter(Boolean))
        : s;
      flat.push(merged as Record<string, unknown>);
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) walk(c);
  }
  walk(root);
  return flat;
}

describe("EmptyState (mobile) — 72pt illustration + headline ladder + CTA", () => {
  it("back-compat: renders only `title` when nothing else is provided", () => {
    const { queryByText, getByText } = render(
      <EmptyState title="Nothing to re-log yet." />,
    );
    expect(getByText("Nothing to re-log yet.")).toBeDefined();
    // No description, no CTA child should be in the tree.
    expect(queryByText("CTA")).toBeNull();
  });

  it("does not render an empty disc when `illustration` is undefined", () => {
    const { UNSAFE_root } = render(<EmptyState title="Plain title" />);
    const disc = collectFlatStyles(UNSAFE_root).find(
      (st) =>
        (st as { width?: number }).width === 72 &&
        (st as { height?: number }).height === 72,
    );
    expect(disc).toBeUndefined();
  });

  it("renders the 72pt illustration disc with the primary tint when `illustration` is provided", () => {
    const Illustration = () => <Text>ILLUSTRATION_NODE</Text>;
    const { UNSAFE_root, getByText } = render(
      <EmptyState
        illustration={<Illustration />}
        title="No favourites yet."
      />,
    );
    expect(getByText("ILLUSTRATION_NODE")).toBeDefined();
    const disc = collectFlatStyles(UNSAFE_root).find(
      (st) =>
        (st as { width?: number }).width === 72 &&
        (st as { height?: number }).height === 72 &&
        (st as { borderRadius?: number }).borderRadius === 36,
    );
    expect(disc).toBeDefined();
    // The component uses `useAccent()` which returns the light-scheme
    // `Accent` palette when no ThemeProvider is present (context default).
    // On light, `accent.primary === Accent.primary`, so this pin correctly
    // verifies the light-scheme disc colour.
    expect((disc as { backgroundColor?: string }).backgroundColor).toBe(
      Accent.primary + "10",
    );
  });

  it("title style routes through Type.headline (17pt)", () => {
    expect(Type.headline.fontSize).toBe(17);
    // Sloe redesign (2026-06-04, Grace "go lighter"): headline weight
    // lightened 700 → 500 across the type ladder (serif Fraunces/Newsreader
    // reads heavier at the same numeric weight, so the lift to 500 keeps
    // the calm coaching tone). EmptyState titles inherit this via
    // `Type.headline`. Still a real assertion — it pins that the empty-state
    // title hasn't drifted back to a bold weight.
    expect(Type.headline.fontWeight).toBe("500");
  });

  it("description renders when provided and routes through Type.body (14pt)", () => {
    expect(Type.body.fontSize).toBe(14);
    const { getByText } = render(
      <EmptyState
        title="Title"
        description="A factual description sentence."
      />,
    );
    expect(getByText("A factual description sentence.")).toBeDefined();
  });

  it("renders all four slots together (illustration + title + description + CTA)", () => {
    const { UNSAFE_root, getByText, getByTestId } = render(
      <EmptyState
        illustration={<Text>ICON</Text>}
        title="No favourites yet."
        description="Star meals you log often for one-tap re-logging."
        cta={<Text testID="cta">Browse recipes</Text>}
      />,
    );
    expect(getByText("ICON")).toBeDefined();
    expect(getByText("No favourites yet.")).toBeDefined();
    expect(
      getByText("Star meals you log often for one-tap re-logging."),
    ).toBeDefined();
    expect(getByTestId("cta")).toBeDefined();
    // Disc still exists when all slots are populated.
    const disc = collectFlatStyles(UNSAFE_root).find(
      (st) => (st as { width?: number }).width === 72,
    );
    expect(disc).toBeDefined();
  });

  it("CTA fires onPress when tapped", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <EmptyState
        title="Nothing to re-log yet."
        cta={
          <Pressable testID="cta-pressable" onPress={onPress}>
            <Text>Browse recipes</Text>
          </Pressable>
        }
      />,
    );
    fireEvent.press(getByTestId("cta-pressable"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
