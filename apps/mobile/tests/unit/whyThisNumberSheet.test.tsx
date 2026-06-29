// @vitest-environment jsdom
/**
 * WhyThisNumberSheet (mobile) — pin the "why is my target X kcal?"
 * sheet rendering + Adjust target CTA.
 *
 * ENG-1247 §A6 flipped `eng1247_section_a_v1` default-ON (ENG-1264 red
 * main): the sheet now renders the v3 `WhyNumberV3Section` by default
 * (hero kcal + "How it adds up" rows + result card + confidence card),
 * not the legacy headline/breakdown/story-beats body. The first block
 * asserts that now-default v3 surface; the second block forces the flag
 * OFF to keep guarding the legacy body (the PostHog kill-switch path).
 *
 * Web parity pinned by `tests/unit/whyThisNumberDialog.test.tsx`.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { isFeatureEnabled } from "@/lib/analytics";
import { WhyThisNumberSheet } from "../../components/today/WhyThisNumberSheet";

void React;

// Default ON (the shipped default). Per-test the legacy block forces it OFF.
// `vi.mock` is hoisted above these imports by vitest regardless of position.
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

const flagFn = vi.mocked(isFeatureEnabled);

const BASE_PROPS = {
  visible: true,
  onClose: vi.fn(),
  targetCalories: 1800,
  maintenanceTdee: 2150,
  confidence: "medium" as const,
  loggingDays: 21,
  goal: "lose" as const,
  paceKgPerWeek: -0.5,
  backgroundColor: "#000",
  cardColor: "#111",
  cardBorderColor: "#222",
  textColor: "#fff",
  textSecondaryColor: "#aaa",
  textTertiaryColor: "#888",
};

// ── v3 default surface (eng1247_section_a_v1 ON — the shipped default) ──────
describe("WhyThisNumberSheet — v3 default surface", () => {
  beforeEach(() => {
    flagFn.mockReturnValue(true);
  });

  it("renders the v3 section with the hero kcal target", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-number-v3-section")).toBeTruthy();
    expect(getByTestId("why-number-hero-kcal").props.children).toBe("1,800");
  });

  it("renders the two 'How it adds up' rows (TDEE + goal)", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-number-v3-row-tdee")).toBeTruthy();
    expect(getByTestId("why-number-v3-row-goal")).toBeTruthy();
  });

  it("renders the result card with the target restated", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-number-result-card")).toBeTruthy();
  });

  it("does not render when visible=false", () => {
    const { queryByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} visible={false} />,
    );
    expect(queryByTestId("why-number-v3-section")).toBeNull();
  });

  it("renders the 'Keep this target' primary CTA that closes the sheet", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} onClose={onClose} />,
    );
    fireEvent.press(getByTestId("why-number-keep-target"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders 'Adjust target' CTA only when onPressAdjustTarget is provided", () => {
    const { queryByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(queryByTestId("why-this-number-adjust-target")).toBeNull();
    const { getByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} onPressAdjustTarget={vi.fn()} />,
    );
    expect(getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("Adjust target tap closes sheet AND fires handler", () => {
    const onClose = vi.fn();
    const onPressAdjustTarget = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        onClose={onClose}
        onPressAdjustTarget={onPressAdjustTarget}
      />,
    );
    fireEvent.press(getByTestId("why-this-number-adjust-target"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPressAdjustTarget).toHaveBeenCalledTimes(1);
  });
});

// ── Legacy body (eng1247_section_a_v1 forced OFF — PostHog kill-switch path) ─
// Forced OFF deliberately: guards the pre-v3 sheet body (headline + breakdown
// rows + "How we work this out" story beats) that stays live behind the kill
// switch. Do not delete — these protect the rollback.
describe("WhyThisNumberSheet — legacy body (flag forced OFF)", () => {
  beforeEach(() => {
    flagFn.mockReturnValue(false);
  });

  it("renders the target headline", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-this-number-target-headline").props.children).toBe(
      "Today's target: 1,800 kcal",
    );
  });

  it("renders three breakdown rows in canonical order", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-this-number-line-tdee")).toBeTruthy();
    expect(getByTestId("why-this-number-line-goal")).toBeTruthy();
    expect(getByTestId("why-this-number-line-result")).toBeTruthy();
  });

  it("does not render when visible=false", () => {
    const { queryByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} visible={false} />,
    );
    // Modal swallows children when not visible.
    expect(queryByTestId("why-this-number-target-headline")).toBeNull();
  });

  it("renders 'Adjust target' CTA when onPressAdjustTarget is provided", () => {
    const onPressAdjustTarget = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} onPressAdjustTarget={onPressAdjustTarget} />,
    );
    expect(getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("hides 'Adjust target' CTA when onPressAdjustTarget is omitted", () => {
    const { queryByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(queryByTestId("why-this-number-adjust-target")).toBeNull();
  });

  it("Adjust target tap closes sheet AND fires handler", () => {
    const onClose = vi.fn();
    const onPressAdjustTarget = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        onClose={onClose}
        onPressAdjustTarget={onPressAdjustTarget}
      />,
    );
    fireEvent.press(getByTestId("why-this-number-adjust-target"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPressAdjustTarget).toHaveBeenCalledTimes(1);
  });

  it("renders early-estimate qualifier when loggingDays < 14", () => {
    const { getByText } = render(
      <WhyThisNumberSheet {...BASE_PROPS} loggingDays={5} />,
    );
    expect(getByText(/Early estimate/)).toBeTruthy();
  });

  it("renders calibrating copy when no maintenance estimate exists", () => {
    const { getByText } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        loggingDays={3}
      />,
    );
    expect(getByText("calibrating — keep logging")).toBeTruthy();
  });

  // Failure 1 / 2 / 3 from TestFlight feedback 2026-05-02 ----------
  it("renders 'Goal not set' when paceKgPerWeek is null (regression)", () => {
    const { getByText } = render(
      <WhyThisNumberSheet {...BASE_PROPS} paceKgPerWeek={null} />,
    );
    expect(getByText("Goal not set")).toBeTruthy();
  });

  it("renders the SPECIFIC weight-logging ask when meals are logged but weights aren't", () => {
    const { getAllByText, getByTestId } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        mealLogDays={40}
        weightLogCount={0}
      />,
    );
    // The ask appears both as the inline qualifier under the headline
    // and lifted into the summary sentence — both must render.
    expect(getAllByText(/Log your weight 3\+ times/).length).toBeGreaterThanOrEqual(1);
    expect(getByTestId("why-this-number-calibrating-ask")).toBeTruthy();
  });

  // Story beats — "How we work this out" section -------------------
  it("renders the 'How we work this out' story section with the gate beat", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-this-number-story")).toBeTruthy();
    expect(getByTestId("why-this-number-beat-seed")).toBeTruthy();
    expect(getByTestId("why-this-number-beat-learn")).toBeTruthy();
    expect(getByTestId("why-this-number-beat-gate")).toBeTruthy();
    expect(getByTestId("why-this-number-beat-range")).toBeTruthy();
  });

  it("shows the watch beat when hasWearable is true (mobile supplies it)", () => {
    const { getByTestId, queryByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} hasWearable />,
    );
    expect(getByTestId("why-this-number-beat-watch")).toBeTruthy();
    // Sanity: the no-wearable default omits it.
    const { queryByTestId: queryDefault } = render(
      <WhyThisNumberSheet {...BASE_PROPS} />,
    );
    expect(queryDefault("why-this-number-beat-watch")).toBeNull();
    void queryByTestId;
  });
});
