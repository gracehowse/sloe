/**
 * TodayHeroRing (web) — Sloe chip + display toggle (2026-06-04).
 *
 * The Sloe Figma (`01 · Today` / `today-web`) RESTORES the calorie-ring
 * header controls the 2026-05-02 audit had removed:
 *   - a status chip (Under budget / Over / empty), and
 *   - a Remaining/Consumed segmented display toggle (`role="group"`,
 *     aria-label "Calorie ring display").
 * Per "match Figma" (Grace 2026-06-05) these are intended again — this test
 * pins their PRESENCE (renamed from the old `…NoChipsWeb` no-chips pin, which
 * enforced the now-superseded 2026-05-02 removal).
 *
 * The "Why this number?" pill stays dropped (2026-05-12 round 4) — the
 * explainer lives on /home?view=targets.
 */
import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";

import { TodayHeroRing } from "../../src/app/components/suppr/today-hero-ring";

const baseProps = {
  consumed: 1200,
  target: 2000,
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
  displayMode: "remaining" as const,
};

describe("TodayHeroRing (web) — Sloe chip + display toggle (2026-06-04)", () => {
  it("renders the Remaining/Consumed segmented display toggle (Figma-restored)", () => {
    const { queryByRole } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onDisplayModeChange={() => {}}
      />,
    );
    // The toggle group carries role="group" + the "Calorie ring display" name.
    const group = queryByRole("group", { name: "Calorie ring display" });
    expect(group).not.toBeNull();
    // Two segment buttons — scoped to the group so we don't collide with the
    // ring's own "remaining" display label. Text is lowercase (CSS `capitalize`).
    const segments = within(group!).getAllByRole("button");
    expect(segments.map((b) => b.textContent)).toEqual(["remaining", "consumed"]);
  });

  it("does NOT render the 'Why this number?' pill even when onPressWhy is provided (2026-05-12 round 4)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onDisplayModeChange={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
    expect(onPressWhy).not.toHaveBeenCalled();
  });
});
