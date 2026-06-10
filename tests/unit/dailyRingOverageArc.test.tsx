/**
 * DailyRing — Apple-Watch overage wrap (web parity with mobile CalorieRing).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

beforeEach(() => {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    redesign_motion: false,
    redesign_winmoment: false,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("DailyRing — overage lap (Sloe 2026-06-04)", () => {
  it("keeps the base progress arc plum when over budget (not destructive)", () => {
    const { container } = render(
      <DailyRing consumed={2000} target={1500} displayMode="remaining" />,
    );
    const progress = container.querySelector('[data-testid="daily-ring-progress"]');
    expect(progress?.getAttribute("stroke")).toBe("var(--macro-calories)");
  });

  it("renders the lifted-plum overage lap when over budget", () => {
    const { getByTestId } = render(
      <DailyRing consumed={2000} target={1500} displayMode="remaining" />,
    );
    const lap = getByTestId("daily-ring-overage-lap");
    const strokeCircle = lap.querySelector("circle[stroke]");
    expect(strokeCircle?.getAttribute("stroke")).toBe("var(--ring-overage-lap)");
  });

  it("does not use the retired diagonal hash pattern", () => {
    const { container } = render(
      <DailyRing consumed={2000} target={1500} displayMode="remaining" />,
    );
    expect(container.innerHTML).not.toContain("overHash");
    expect(container.innerHTML).not.toContain("url(#overHash)");
  });

  it("omits the overage lap when under budget", () => {
    const { queryByTestId } = render(
      <DailyRing consumed={500} target={1500} displayMode="remaining" />,
    );
    expect(queryByTestId("daily-ring-overage-lap")).toBeNull();
  });
});
