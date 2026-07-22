/**
 * DailyRing — over-budget ring caps at FULL (web ring parity 2026-06-10).
 *
 * The 2026-06-04 Apple-Watch overage lap is RETIRED (mobile ring wave): when
 * over budget the ring is ONE complete plum lap — no second overage lap, no red
 * recolour of the arc. The over verdict lives in the centre ("{n} OVER") + the
 * hero status chip. Mirrors mobile `CalorieRing.tsx` (plum `navPrimary` at all
 * times; lap removed). This supersedes the prior overage-lap pin.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

beforeEach(() => {
  // redesign_winmoment collapsed permanently-on (ENG-1651) — no longer a
  // recognized flag name, so it's dropped from this force-flags map.
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    redesign_motion: false,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("DailyRing — over budget caps at full (web ring parity 2026-06-10)", () => {
  it("keeps the progress arc plum when over budget (never destructive red)", () => {
    const { container } = render(<DailyRing consumed={2000} target={1500} />);
    const progress = container.querySelector('[data-testid="daily-ring-progress"]');
    expect(progress?.getAttribute("stroke")).toBe("var(--macro-calories)");
  });

  it("fills the plum arc to a full circle when over budget (offset 0)", () => {
    const { container } = render(<DailyRing consumed={2000} target={1500} />);
    const progress = container.querySelector('[data-testid="daily-ring-progress"]');
    // pct is clamped to 1 when over → strokeDashoffset is 0 (a complete lap).
    expect(progress?.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("renders NO second overage lap when over budget", () => {
    const { queryByTestId } = render(<DailyRing consumed={2000} target={1500} />);
    expect(queryByTestId("daily-ring-overage-lap")).toBeNull();
  });

  it("does not use the retired diagonal hash pattern or the overage-lap token", () => {
    const { container } = render(<DailyRing consumed={2000} target={1500} />);
    expect(container.innerHTML).not.toContain("overHash");
    expect(container.innerHTML).not.toContain("url(#overHash)");
    expect(container.innerHTML).not.toContain("ring-overage-lap");
  });

  it("uses the same plum arc under budget (single treatment both sides)", () => {
    const { container } = render(<DailyRing consumed={500} target={1500} />);
    const progress = container.querySelector('[data-testid="daily-ring-progress"]');
    expect(progress?.getAttribute("stroke")).toBe("var(--macro-calories)");
  });
});
