// @vitest-environment jsdom
/**
 * `GradientAvatar` — brand-gradient avatar used on the More tab (D7,
 * 2026-04-21). Protects three invariants:
 *
 *   1. Renders the passed `initial` (so display-name → avatar-letter
 *      wiring can't silently regress to empty).
 *   2. Uses the canonical brand gradient endpoints (`#4c6ce0` → `#e04888`
 *      per `docs/ux/brand-guidelines.md`). If someone softens these
 *      back to `var(--primary)` or a `color-mix()` blend the test
 *      fails — which is the exact regression that shipped on the web
 *      side before D7.
 *   3. Emits two distinct `<Stop>` nodes in the gradient def — guards
 *      against a single-stop mis-wiring that would render flat colour
 *      while still typechecking.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { GradientAvatar } from "../../components/GradientAvatar";
import { Accent } from "../../constants/theme";

// Keep React imported — otherwise TS tree-shakes it and RNTL errors.
void React;

describe("GradientAvatar (D7 — brand gradient on More tab avatars)", () => {
  it("renders the initial character", () => {
    const { getByText } = render(
      <GradientAvatar
        size={52}
        initial="G"
        fontSize={18}
        gradientIdSuffix="test-1"
      />,
    );
    expect(getByText("G")).toBeTruthy();
  });

  it("uses the canonical brand gradient endpoints #4c6ce0 → #e04888", () => {
    // The Accent theme constants are the single source of truth for the
    // mobile brand gradient; this test pins them so a palette shift
    // can't silently change what the avatar paints.
    expect(Accent.primary.toLowerCase()).toBe("#4c6ce0");
    expect(Accent.magenta.toLowerCase()).toBe("#e04888");
  });

  it("emits two gradient stops (start + end)", () => {
    const { UNSAFE_getAllByType } = render(
      <GradientAvatar
        size={40}
        initial="G"
        fontSize={14}
        gradientIdSuffix="test-2"
      />,
    );
    // `Stop` is stubbed to `View` with `data-svg-stub="Stop"` by
    // `tests/shims/react-native-svg.cjs` — so we query by stub name.
    const stops = UNSAFE_getAllByType("View" as unknown as React.ComponentType)
      .filter((n) => (n.props as Record<string, unknown>)["data-svg-stub"] === "Stop");
    expect(stops).toHaveLength(2);
    const colors = stops.map((s) => (s.props as { stopColor?: string }).stopColor?.toLowerCase());
    expect(colors).toContain("#4c6ce0");
    expect(colors).toContain("#e04888");
  });
});
