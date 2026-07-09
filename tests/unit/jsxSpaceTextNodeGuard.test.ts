import { describe, expect, it } from "vitest";

import { findViolations } from "../../scripts/check-jsx-space-text-node.mjs";

/**
 * ENG-1379 regression — the Settings screen crashed ("Text strings must be
 * rendered within a <Text> component.") because two lines had a space between
 * a self-closing element and a same-line JSX comment, e.g.
 *
 *     <TrendOnlyWeightRow /> {/* comment *\/}
 *
 * That space is a literal `" "` text node; as a direct child of a RN <View>
 * it throws and collapses the layout (the tab bar rendered in-flow). Both
 * the mobile bug and its web parity twin (`src/app/components/Settings.tsx`)
 * are covered by the same guard. This test would have failed on the three
 * pre-fix instances (2 mobile + 1 web).
 */
describe("ENG-1379 — JSX space-before-comment text-node guard", () => {
  it("has no `<Element /> {/* comment */}` space text nodes on any JSX surface", () => {
    const violations = findViolations();
    // Surface the offenders in the failure message so a regression is
    // immediately actionable (file:line), not just a bare count.
    expect(
      violations.map((v) => `${v.file}:${v.line}  ${v.text}`),
    ).toEqual([]);
  });
});
