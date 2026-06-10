/**
 * dailyRing — circular progress ring rendered on the Today hero.
 *
 * These tests pin three correctness rules surfaced by Grace's
 * 2026-05-03 web screenshots:
 *
 *   B6 — When over-budget in `remaining` display mode, the centre
 *        value must be the *amount over* (a positive integer), not
 *        a `0` left over from a `Math.max(0, …)` clamp. Previously
 *        the ring read `0 / OVER / of 1,132 kcal` even when the
 *        user was 506 kcal over.
 *
 *   N3 — The centre value must use thousands-separators (`1,132`),
 *        matching the budget line directly beneath it. The mismatch
 *        between `1132` and `of 1,132 kcal` was a same-component
 *        format drift.
 *
 *   N5 — The empty-state soft copy ("Start your day") must fire in
 *        BOTH `remaining` and `consumed` display modes. Previously
 *        the soft copy was gated to `consumed` only, leaving the
 *        default REMAINING view rendering a giant `1,132` for
 *        first-time users who hadn't logged yet — which read as
 *        a wireframe placeholder rather than an intentional empty
 *        state.
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

// Redesign 2026 ships `redesign_motion` default-ON (`REDESIGN_DEFAULT_ON`),
// which routes the centre value through `useOdometer` — it animates from 0 and
// jsdom never advances requestAnimationFrame, so the static read is the `0`
// start (not a real bug; a browser settles to the true value). These tests pin
// the centre VALUE (B6/N3/N5), so force the motion flags OFF → the legacy
// static render. The odometer's settle behaviour is covered separately
// (motion/odometer tests). Explicit `false` wins over the default-on.
beforeEach(() => {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    redesign_motion: false,
    redesign_winmoment: false,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

function renderRing(props: {
  consumed: number;
  target: number;
  displayMode?: "remaining" | "consumed";
}) {
  return render(
    <DailyRing
      consumed={props.consumed}
      target={props.target}
      displayMode={props.displayMode ?? "remaining"}
    />,
  );
}

describe("DailyRing — centre value", () => {
  describe("B6 — over-budget shows the amount over, not 0", () => {
    it("renders the kcal amount over target when consumed > target in remaining mode", () => {
      const { container } = renderRing({
        consumed: 1638,
        target: 1132,
        displayMode: "remaining",
      });
      const text = container.textContent ?? "";
      // 1,638 − 1,132 = 506 over. Must show "506", not "0".
      expect(text).toContain("506");
      expect(text).not.toMatch(/\b0\s+OVER\b/i);
    });

    it("still labels the over state with the OVER copy", () => {
      const { container } = renderRing({
        consumed: 1638,
        target: 1132,
        displayMode: "remaining",
      });
      expect((container.textContent ?? "").toUpperCase()).toContain("OVER");
    });

    it("renders the consumed amount in consumed mode regardless of over-budget", () => {
      const { container } = renderRing({
        consumed: 1638,
        target: 1132,
        displayMode: "consumed",
      });
      expect(container.textContent).toContain("1,638");
    });
  });

  describe("N3 — centre value uses thousands separators", () => {
    it("formats 4-digit kcal with a comma in remaining mode", () => {
      const { container } = renderRing({ consumed: 200, target: 1832 });
      // remaining = 1,632
      expect(container.textContent).toContain("1,632");
    });

    it("formats 4-digit kcal with a comma when over-budget", () => {
      const { container } = renderRing({
        consumed: 3450,
        target: 1832,
        displayMode: "remaining",
      });
      // over by 1,618
      expect(container.textContent).toContain("1,618");
    });
  });

  describe("N5 — empty-state soft copy fires in both display modes", () => {
    it("renders 'Start your day' instead of a 0 in remaining mode when nothing logged", () => {
      const { container } = renderRing({
        consumed: 0,
        target: 1832,
        displayMode: "remaining",
      });
      const text = container.textContent ?? "";
      expect(text).toContain("Start your day");
      // Centre must NOT show the giant "1,832 / REMAINING" pattern.
      expect(text).not.toMatch(/REMAINING/i);
    });

    it("renders 'Start your day' in consumed mode when nothing logged", () => {
      const { container } = renderRing({
        consumed: 0,
        target: 1832,
        displayMode: "consumed",
      });
      const text = container.textContent ?? "";
      expect(text).toContain("Start your day");
      expect(text).not.toMatch(/LOGGED/i);
    });

    it("does not render 'Start your day' once anything is logged", () => {
      const { container } = renderRing({
        consumed: 50,
        target: 1832,
        displayMode: "remaining",
      });
      expect(container.textContent).not.toContain("Start your day");
    });
  });

  describe("R03 — `target <= 0` no-profile case renders the calibrating-empty state", () => {
    it("renders 'Start your day' instead of OVER when target=0 and consumed>0", () => {
      const { container } = renderRing({
        consumed: 500,
        target: 0,
        displayMode: "remaining",
      });
      const text = container.textContent ?? "";
      // Must NOT render the "500 / OVER / of 0 kcal" pattern that the
      // pre-fix `isOverBudget` branch produced.
      expect(text).toContain("Start your day");
      expect(text).not.toMatch(/OVER/i);
      expect(text).not.toContain("of 0 kcal");
    });

    it("renders 'Start your day' when target=0 and consumed=0 (cold start, no profile)", () => {
      const { container } = renderRing({
        consumed: 0,
        target: 0,
        displayMode: "remaining",
      });
      expect(container.textContent).toContain("Start your day");
    });

    it("hides the budget line when target<=0 (no 'of 0 kcal' anchor)", () => {
      const { container } = renderRing({
        consumed: 0,
        target: 0,
      });
      expect(container.textContent).not.toContain("of 0 kcal");
    });
  });

  describe("budget line — only when macro rings are collapsed", () => {
    it("shows 'of X kcal' when expanded=false and target>0", () => {
      const { container } = render(
        <DailyRing consumed={500} target={1707} expanded={false} />,
      );
      expect(container.textContent).toContain("of 1,707 kcal");
    });

    it("still shows 'of X kcal' in remaining mode when expanded (mobile parity)", () => {
      const { container } = render(
        <DailyRing consumed={500} target={1707} expanded={true} displayMode="remaining" />,
      );
      expect(container.textContent).toContain("of 1,707 kcal");
    });
  });
});
