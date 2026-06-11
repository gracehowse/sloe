/**
 * dailyRing — circular progress ring rendered on the Today hero.
 *
 * web ring parity 2026-06-10 (mobile ring wave) — the Remaining/Consumed
 * toggle is RETIRED; the ring centre has ONE grammar (mobile `CalorieRing`
 * parity). These tests pin that grammar plus the surviving correctness rules:
 *
 *   B6 — When over budget the centre value is the *amount over* (a positive
 *        integer) under the "OVER" label, not a `0` left over from a clamp.
 *
 *   N3 — The centre value uses thousands-separators (`1,632`), matching the
 *        budget line directly beneath it.
 *
 *   EMPTY — The empty day renders the SAME way as a populated day: the full
 *        ring with REAL numbers ("{goal} LEFT"), NOT a "Start your day" soft
 *        invitation (supersedes the 2026-04-29 papercut-#2 / N5 soft-empty).
 *
 *   R03 — `target <= 0` (no profile target yet) shows what's logged with the
 *        "LOGGED" label — never a LEFT/OVER verdict against a zero goal.
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

// Redesign 2026 ships `redesign_motion` default-ON (`REDESIGN_DEFAULT_ON`),
// which routes the centre value through `useOdometer` — it animates from 0 and
// jsdom never advances requestAnimationFrame, so the static read is the `0`
// start (not a real bug; a browser settles to the true value). These tests pin
// the centre VALUE, so force the motion flags OFF → the legacy static render.
// The odometer's settle behaviour is covered separately (motion/odometer tests).
beforeEach(() => {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    redesign_motion: false,
    redesign_winmoment: false,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

function renderRing(props: { consumed: number; target: number }) {
  return render(<DailyRing consumed={props.consumed} target={props.target} />);
}

describe("DailyRing — centre value (one grammar, web ring parity 2026-06-10)", () => {
  describe("B6 — over budget shows the amount over, not 0", () => {
    it("renders the kcal amount over target when consumed > target", () => {
      const { container } = renderRing({ consumed: 1638, target: 1132 });
      const text = container.textContent ?? "";
      // 1,638 − 1,132 = 506 over. Must show "506", not "0".
      expect(text).toContain("506");
      expect(text).not.toMatch(/\b0\s+OVER\b/i);
    });

    it("labels the over state with the OVER copy", () => {
      const { container } = renderRing({ consumed: 1638, target: 1132 });
      expect((container.textContent ?? "").toUpperCase()).toContain("OVER");
    });
  });

  describe("N3 — centre value uses thousands separators", () => {
    it("formats 4-digit kcal with a comma when under budget", () => {
      const { container } = renderRing({ consumed: 200, target: 1832 });
      // remaining = 1,632
      expect(container.textContent).toContain("1,632");
    });

    it("formats 4-digit kcal with a comma when over budget", () => {
      const { container } = renderRing({ consumed: 3450, target: 1832 });
      // over by 1,618
      expect(container.textContent).toContain("1,618");
    });
  });

  describe("EMPTY — real numbers, no 'Start your day' soft copy", () => {
    it("renders '{goal} LEFT' (full ring, real numbers) when nothing logged", () => {
      const { container } = renderRing({ consumed: 0, target: 1832 });
      const text = container.textContent ?? "";
      // Empty day mirrors a populated day: the goal as the centre number + LEFT.
      expect(text).toContain("1,832");
      expect(text.toUpperCase()).toContain("LEFT");
      // The retired soft-empty invitation must NOT render.
      expect(text).not.toContain("Start your day");
    });

    it("keeps the same grammar once anything is logged", () => {
      const { container } = renderRing({ consumed: 50, target: 1832 });
      const text = container.textContent ?? "";
      expect(text).not.toContain("Start your day");
      // remaining = 1,782, still LEFT.
      expect(text).toContain("1,782");
      expect(text.toUpperCase()).toContain("LEFT");
    });
  });

  describe("R03 — `target <= 0` no-profile case shows LOGGED, never a verdict", () => {
    it("renders '{consumed} LOGGED' when target=0 and consumed>0", () => {
      const { container } = renderRing({ consumed: 500, target: 0 });
      const text = container.textContent ?? "";
      // Shows what's logged with the LOGGED label — never OVER/LEFT against a
      // zero goal, and never the "of 0 kcal" anchor.
      expect(text).toContain("500");
      expect(text.toUpperCase()).toContain("LOGGED");
      expect(text.toUpperCase()).not.toContain("OVER");
      expect(text).not.toContain("of 0 kcal");
    });

    it("renders '0 LOGGED' on a cold start (no profile, nothing logged)", () => {
      const { container } = renderRing({ consumed: 0, target: 0 });
      const text = container.textContent ?? "";
      expect(text.toUpperCase()).toContain("LOGGED");
      expect(text).not.toContain("Start your day");
    });

    it("hides the budget line when target<=0 (no 'of 0 kcal' anchor)", () => {
      const { container } = renderRing({ consumed: 0, target: 0 });
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

    it("hides 'of X kcal' when expanded (the hero stats row carries the goal)", () => {
      const { container } = render(
        <DailyRing consumed={500} target={1707} expanded={true} />,
      );
      expect(container.textContent).not.toContain("of 1,707 kcal");
    });
  });
});
