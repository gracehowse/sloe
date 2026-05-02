// @vitest-environment jsdom
/**
 * EmptyState upgrade pin (ui-critic finding #6, P1).
 *
 * The pre-2026-05-01 primitive surfaced empty tabs as 13pt bold over a
 * tiny 6pt gap — too quiet to read as a state. The new shape:
 *   - Optional `illustration` slot rendered inside a 72pt
 *     `Accent.primary + "10"` tinted disc.
 *   - Title routed through `Type.headline` (17pt).
 *   - Description routed through `Type.body` (14pt).
 *   - Optional `cta` slot below.
 *
 * Backwards compatibility: callers that pass only `title` (no
 * illustration / cta) still render — the illustration disc and CTA
 * are skipped so the existing call sites don't break.
 */
import * as React from "react";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { EmptyState } from "../../components/EmptyState";
import { Accent, Type } from "../../constants/theme";

void React;

describe("EmptyState (mobile) — 72pt illustration + headline ladder + CTA", () => {
  it("renders nothing extra when only `title` is passed (back-compat)", () => {
    const { queryByText, getByText } = render(
      <EmptyState title="Nothing to re-log yet." />,
    );
    expect(getByText("Nothing to re-log yet.")).toBeDefined();
    // No description, no CTA child should be in the tree.
    expect(queryByText("CTA")).toBeNull();
  });

  it("renders the 72pt illustration disc with the primary tint when `illustration` is provided", () => {
    const Illustration = () => <Text>ILLUSTRATION_NODE</Text>;
    const { UNSAFE_root, getByText } = render(
      <EmptyState
        illustration={<Illustration />}
        title="No favourites yet."
      />,
    );
    // Sanity — the illustration child renders.
    expect(getByText("ILLUSTRATION_NODE")).toBeDefined();
    // Walk the tree to find the wrapper view that has the 72pt disc
    // style. We can't assert on raw `View` style equality cleanly
    // because StyleSheet.create returns numeric ids on RN; instead
    // we collect every style in the tree and look for the disc shape.
    const tree = UNSAFE_root;
    function* walk(node: any): Generator<any> {
      if (!node) return;
      yield node;
      const children = Array.isArray(node.children) ? node.children : [];
      for (const c of children) yield* walk(c);
    }
    const flatStyles: Record<string, unknown>[] = [];
    for (const node of walk(tree)) {
      const s = node?.props?.style;
      if (!s) continue;
      const merged = Array.isArray(s)
        ? Object.assign({}, ...s.filter(Boolean))
        : s;
      flatStyles.push(merged);
    }
    const disc = flatStyles.find(
      (st) =>
        (st as { width?: number }).width === 72 &&
        (st as { height?: number }).height === 72 &&
        (st as { borderRadius?: number }).borderRadius === 36,
    );
    expect(disc).toBeDefined();
    expect((disc as { backgroundColor?: string }).backgroundColor).toBe(
      Accent.primary + "10",
    );
  });

  it("title style routes through Type.headline (17pt)", () => {
    expect(Type.headline.fontSize).toBe(17);
    expect(Type.headline.fontWeight).toBe("700");
  });

  it("description style routes through Type.body (14pt)", () => {
    expect(Type.body.fontSize).toBe(14);
  });

  it("renders the CTA slot when `cta` is passed", () => {
    const { getByTestId } = render(
      <EmptyState
        title="Nothing to re-log yet."
        cta={<Text testID="empty-state-cta">Browse recipes</Text>}
      />,
    );
    expect(getByTestId("empty-state-cta")).toBeDefined();
  });

  it("falls back to `action` when `cta` is not passed (back-compat)", () => {
    const { getByTestId } = render(
      <EmptyState
        title="Nothing to re-log yet."
        action={<Text testID="empty-state-action">Browse recipes</Text>}
      />,
    );
    expect(getByTestId("empty-state-action")).toBeDefined();
  });

  it("prefers `cta` over `action` when both are passed", () => {
    const { getByTestId, queryByTestId } = render(
      <EmptyState
        title="Nothing to re-log yet."
        action={<Text testID="empty-state-action">Action node</Text>}
        cta={<Text testID="empty-state-cta">CTA node</Text>}
      />,
    );
    expect(getByTestId("empty-state-cta")).toBeDefined();
    expect(queryByTestId("empty-state-action")).toBeNull();
  });
});
