/**
 * WhyThisNumberDialog (web) — pin the "why is my target X kcal?"
 * dialog rendering + Adjust target CTA.
 *
 * Mirrors `apps/mobile/tests/unit/whyThisNumberSheet.test.tsx`. The two
 * surfaces share the same `buildWhyThisNumber` helper so any copy /
 * math drift fails the helper's own test (`whyThisNumber.test.ts`)
 * before reaching either component test.
 *
 * ENG-1247 §A6 flipped `eng1247_section_a_v1` default-ON (ENG-1264 red
 * main): the dialog now renders the v3 `WhyNumberV3Section` by default
 * (hero kcal + "How it adds up" rows + result card + confidence card),
 * not the legacy headline/breakdown/story-beats body. The first block
 * asserts that now-default v3 surface; the second block forces the flag
 * OFF to keep guarding the legacy body (the PostHog kill-switch path).
 */
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WhyThisNumberDialog } from "../../src/app/components/suppr/why-this-number-dialog";

const BASE_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  targetCalories: 1800,
  maintenanceTdee: 2150,
  confidence: "medium" as const,
  loggingDays: 21,
  goal: "lose" as const,
  paceKgPerWeek: -0.5,
};

function forceSectionA(value: boolean): void {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    eng1247_section_a_v1: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

// ── v3 default surface (eng1247_section_a_v1 ON — the shipped default) ──────
describe("WhyThisNumberDialog (web) — v3 default surface", () => {
  it("renders the v3 section with the hero kcal target", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-number-v3-section")).toBeTruthy();
    // Hero numeral formats with thousands grouping (1,800), not the legacy
    // combined "Today's target: …" headline.
    expect(screen.getByTestId("why-number-hero-kcal").textContent).toBe("1,800");
  });

  it("renders the two 'How it adds up' rows (TDEE + goal) in order", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    const tdee = screen.getByTestId("why-number-v3-row-tdee");
    const goal = screen.getByTestId("why-number-v3-row-goal");
    expect(tdee).toBeTruthy();
    expect(goal).toBeTruthy();
    // TDEE row carries the maintenance figure (sans the "(learned…)" qualifier).
    expect(tdee.textContent).toContain("Maintenance (TDEE)");
    expect(tdee.textContent).toContain("2,150");
    // Goal row carries the chosen-pace label + the per-day delta.
    expect(goal.textContent).toContain("Lose 0.5 kg/wk");
    expect(goal.textContent).toContain("−350");
  });

  it("renders the highlighted result card with the target restated", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    const card = screen.getByTestId("why-number-result-card");
    expect(card.textContent).toContain("Your target");
    expect(card.textContent).toContain("1,800");
    // Subtitle is the maintenance − deficit grammar from whyNumberV3.
    expect(card.textContent).toContain("2,150");
    expect(card.textContent).toContain("deficit");
  });

  it("renders the confidence card matching the confidence prop", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} confidence="high" loggingDays={21} />);
    expect(screen.getByText("High confidence")).toBeTruthy();
  });

  it("renders the 'Keep this target' primary CTA that closes the dialog", () => {
    const onOpenChange = vi.fn();
    render(<WhyThisNumberDialog {...BASE_PROPS} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("why-number-keep-target"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders 'Adjust target' CTA only when onAdjustTarget is provided", () => {
    const { rerender } = render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.queryByTestId("why-this-number-adjust-target")).toBeNull();
    rerender(<WhyThisNumberDialog {...BASE_PROPS} onAdjustTarget={vi.fn()} />);
    expect(screen.getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("Adjust target click closes dialog AND fires handler", () => {
    const onOpenChange = vi.fn();
    const onAdjustTarget = vi.fn();
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        onOpenChange={onOpenChange}
        onAdjustTarget={onAdjustTarget}
      />,
    );
    fireEvent.click(screen.getByTestId("why-this-number-adjust-target"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAdjustTarget).toHaveBeenCalledTimes(1);
  });

  it("does not render the v3 section when open=false", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} open={false} />);
    expect(screen.queryByTestId("why-number-v3-section")).toBeNull();
  });
});

// ── Legacy body (eng1247_section_a_v1 forced OFF — PostHog kill-switch path) ─
// Forced OFF deliberately: these assertions guard the pre-v3 dialog body that
// stays live behind the kill switch. Do not delete — they protect the rollback.
describe("WhyThisNumberDialog (web) — legacy body (flag forced OFF)", () => {
  it("renders the target headline", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-target-headline").textContent).toBe(
      "Today's target: 1,800 kcal",
    );
  });

  it("renders three breakdown rows in canonical order", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-line-tdee")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-line-goal")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-line-result")).toBeTruthy();
  });

  it("renders the canonical row content", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    // BASE_PROPS supplies loggingDays: 21 → the qualifier names the count.
    expect(screen.getByTestId("why-this-number-line-tdee").textContent).toContain(
      "2,150 kcal (learned from your 21 fully-logged days)",
    );
    expect(screen.getByTestId("why-this-number-line-goal").textContent).toContain(
      "Lose 0.5 kg/wk",
    );
    expect(screen.getByTestId("why-this-number-line-result").textContent).toContain(
      "−350 kcal/day deficit",
    );
  });

  it("renders the 'How we work this out' story section with the gate beat", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-story")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-beat-seed")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-beat-learn")).toBeTruthy();
    // The gate beat is the load-bearing 'why' — forgotten dinner protection.
    expect(
      screen.getByTestId("why-this-number-beat-gate").textContent,
    ).toContain("forgotten dinner");
    expect(screen.getByTestId("why-this-number-beat-range")).toBeTruthy();
  });

  it("omits the watch beat on web (no native wearable feed — parity carve-out)", () => {
    forceSectionA(false);
    // Web has no Apple Health integration; the dialog defaults hasWearable
    // to false, so the watch story beat must not appear. This is the
    // documented intentional platform divergence.
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.queryByTestId("why-this-number-beat-watch")).toBeNull();
  });

  it("renders 'Adjust target' CTA when onAdjustTarget is provided", () => {
    forceSectionA(false);
    const onAdjustTarget = vi.fn();
    render(<WhyThisNumberDialog {...BASE_PROPS} onAdjustTarget={onAdjustTarget} />);
    expect(screen.getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("hides 'Adjust target' CTA when onAdjustTarget is omitted", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.queryByTestId("why-this-number-adjust-target")).toBeNull();
  });

  it("Adjust target click closes dialog AND fires handler", () => {
    forceSectionA(false);
    const onOpenChange = vi.fn();
    const onAdjustTarget = vi.fn();
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        onOpenChange={onOpenChange}
        onAdjustTarget={onAdjustTarget}
      />,
    );
    fireEvent.click(screen.getByTestId("why-this-number-adjust-target"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAdjustTarget).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog body when open=false", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} open={false} />);
    expect(screen.queryByTestId("why-this-number-target-headline")).toBeNull();
  });

  it("renders early-estimate qualifier when loggingDays < 14", () => {
    forceSectionA(false);
    render(<WhyThisNumberDialog {...BASE_PROPS} loggingDays={5} />);
    expect(screen.getByText(/Early estimate/)).toBeTruthy();
  });

  it("renders calibrating copy when no maintenance estimate exists", () => {
    forceSectionA(false);
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        loggingDays={3}
      />,
    );
    expect(screen.getByText("calibrating — keep logging")).toBeTruthy();
  });

  // Failure 1 / 2 / 3 from TestFlight feedback 2026-05-02 ----------
  it("renders 'Goal not set' when paceKgPerWeek is null (regression)", () => {
    forceSectionA(false);
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        paceKgPerWeek={null}
      />,
    );
    expect(screen.getByTestId("why-this-number-line-goal").textContent).toContain(
      "Goal not set",
    );
  });

  it("renders the SPECIFIC weight-logging ask when meals are logged but weights aren't", () => {
    forceSectionA(false);
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        mealLogDays={40}
        weightLogCount={0}
      />,
    );
    expect(screen.getByTestId("why-this-number-calibrating-ask")).toBeTruthy();
    expect(
      screen.getByTestId("why-this-number-calibrating-ask").textContent,
    ).toContain("Log your weight 3+ times");
  });
});
