// @vitest-environment jsdom
/**
 * CalorieRing centre-value typography — 2026-05-01 ui-critic finding #7.
 *
 * The Today-screen ring's central calorie number was previously 22pt
 * (expanded) / 28pt (collapsed) — almost the same weight as the macro
 * tile values (~22pt) sitting below the ring. ui-critic flagged that
 * the ring's central number should dominate its real estate per the
 * Cal AI flagship convention; the brief specifies `Type.ringValueLg`
 * (56pt) as the default with a 48pt fallback for 4-digit goals (e.g.
 * 1,847 kcal) so they don't clip the inner-most macro-ring band.
 *
 * Tests pinned here:
 *   - 3-digit centre value renders at the full 56pt (`Type.ringValueLg`).
 *   - 4-digit centre value renders at the 48pt fallback (still much
 *     larger than the ~22pt macro tiles → no parity confusion).
 *   - The tabular-nums variant is preserved so animated counting doesn't
 *     jitter horizontally.
 *   - The rendered text is never truncated (no ellipsis in JSON output)
 *     for either width.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import CalorieRing from "../../components/charts/CalorieRing";
import { Type } from "../../constants/theme";

void React;

const baseProps = {
  textColor: "#111",
  secondaryColor: "#666",
  trackColor: "#eee",
  proteinPct: 0.5,
  carbsPct: 0.4,
  fatPct: 0.3,
  expanded: true,
  displayMode: "consumed" as const,
};

function getCenterValueStyle(json: unknown, expectedText: string) {
  // RNTL's toJSON() returns a tree of `{ type, props, children }`.
  // Walk it to find the Text node whose children equal `expectedText`.
  const stack: unknown[] = [json];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    const n = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
    const children = n.children;
    if (Array.isArray(children) && children.length === 1 && String(children[0]) === expectedText) {
      return (n.props?.style ?? {}) as Record<string, unknown>;
    }
    if (Array.isArray(children)) stack.push(...children);
  }
  throw new Error(`Could not find Text node with content "${expectedText}"`);
}

describe("CalorieRing — centre-value typography (ui-critic #7)", () => {
  it("renders a 3-digit centre value at Type.ringValueLg (56pt)", () => {
    const { toJSON } = render(
      <CalorieRing {...baseProps} consumed={420} goal={2000} />,
    );
    const style = getCenterValueStyle(toJSON(), "420");
    expect(style.fontSize).toBe(Type.ringValueLg.fontSize);
    expect(style.fontSize).toBe(56);
    // The lift target — explicit ≥48 proxy for "much bigger than the
    // ~22pt macro tile values".
    expect(Number(style.fontSize)).toBeGreaterThanOrEqual(48);
    expect(style.fontWeight).toBe(Type.ringValueLg.fontWeight);
    expect(style.letterSpacing).toBe(Type.ringValueLg.letterSpacing);
    expect(style.fontVariant).toEqual(["tabular-nums"]);
  });

  it("falls back to 48pt for 4-digit centre values to avoid clipping", () => {
    const { toJSON } = render(
      <CalorieRing {...baseProps} consumed={1847} goal={2400} />,
    );
    const style = getCenterValueStyle(toJSON(), "1847");
    expect(style.fontSize).toBe(48);
    // Still well above the macro tile values (~22pt) — still satisfies
    // the ui-critic ≥48 / 1.6× lift requirement.
    expect(Number(style.fontSize)).toBeGreaterThanOrEqual(48);
    // Mobile keeps its safety net via `numberOfLines={1}` +
    // `adjustsFontSizeToFit` — assert the JSON output never serialises
    // an ellipsis (which would indicate runtime truncation if it did).
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain("…");
    expect(json).not.toMatch(/1[,.]?…/);
  });

  it("collapsed ring (no inner macro rings) still uses the 56pt token", () => {
    const { toJSON } = render(
      <CalorieRing {...baseProps} expanded={false} consumed={420} goal={2000} />,
    );
    const style = getCenterValueStyle(toJSON(), "420");
    expect(style.fontSize).toBe(56);
    expect(Number(style.fontSize)).toBeGreaterThanOrEqual(48);
  });

  it("preserves the 'Start your day' empty-state copy (not the 56pt number)", () => {
    const { getByText } = render(
      <CalorieRing {...baseProps} consumed={0} goal={2000} />,
    );
    // Empty state still shows the soft invitation rather than a giant
    // "0" — the typography lift must not regress the empty-state fix.
    expect(getByText("Start your day")).toBeTruthy();
  });

  it("retains numberOfLines + adjustsFontSizeToFit safety net", () => {
    const { toJSON } = render(
      <CalorieRing {...baseProps} consumed={1847} goal={2400} />,
    );
    // Walk the tree and confirm the central-value Text props.
    const stack: unknown[] = [toJSON()];
    let found = false;
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      const n = node as { props?: Record<string, unknown>; children?: unknown[] };
      const children = n.children;
      if (
        Array.isArray(children) &&
        children.length === 1 &&
        String(children[0]) === "1847"
      ) {
        expect(n.props?.numberOfLines).toBe(1);
        expect(n.props?.adjustsFontSizeToFit).toBe(true);
        // Lower bound is Type.ringValue (36pt) / Type.ringValueLg (56pt).
        // (RN's minimumFontScale is a fraction of the supplied fontSize;
        // confirm the math anchors to the canonical tokens, not a magic
        // number.)
        expect(n.props?.minimumFontScale).toBeCloseTo(36 / 56, 5);
        found = true;
        break;
      }
      if (Array.isArray(children)) stack.push(...children);
    }
    expect(found).toBe(true);
  });
});
