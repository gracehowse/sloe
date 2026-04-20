import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

/**
 * Onboarding v2 — soft-warn safety-floor analytics tests.
 *
 * Locks in the auditable trail required by
 * `docs/decisions/2026-04-19-onboarding-redesign-scope.md` §"Decision 2":
 *
 *   - The Pace step fires `onboarding_pace_below_safety_floor`
 *     with `acted: "shown"` when a warning banner first appears for
 *     a given reason. Repeated renders with the same reason do not
 *     refire (deduplicated via a useRef inside the step).
 *   - The flow shell's Continue button fires the same event with
 *     `acted: "advanced"` when the user advances from the Pace step
 *     while a warning is showing.
 *
 * If product ever revisits the soft-warn-vs-hard-block call, the
 * `advanced / shown` ratio is the audit signal these events provide.
 */

const trackMock = vi.fn();
vi.mock("../../src/lib/analytics/track", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  // Keep `isOnboardingV2Enabled` available so other consumers don't
  // crash when the module is mocked. Default to false so the existing
  // /onboarding redirect doesn't fire in test runs.
  isOnboardingV2Enabled: () => false,
  isFeatureEnabled: () => false,
}));

import {
  OnboardingV2Provider,
  useOnboardingV2,
} from "../../src/app/components/onboarding-v2/context";
import { PaceStep } from "../../src/app/components/onboarding-v2/steps/pace";
import { WebFlow } from "../../src/app/components/onboarding-v2/web-flow";
import type { OnboardingState } from "../../src/lib/onboarding/v2/state";

function withProvider(
  ui: React.ReactNode,
  initial?: Partial<OnboardingState>,
) {
  return render(
    <OnboardingV2Provider initial={initial}>{ui}</OnboardingV2Provider>,
  );
}

beforeEach(() => {
  trackMock.mockReset();
});

describe("PaceStep — `shown` event", () => {
  it("fires onboarding_pace_below_safety_floor with acted=shown when a danger banner appears", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "female",
      age: 25,
      heightCm: 155,
      weightKg: 50,
      activity: "sedentary",
      paceKgPerWeek: 0.9,
    });
    expect(trackMock).toHaveBeenCalledWith(
      "onboarding_pace_below_safety_floor",
      expect.objectContaining({
        acted: "shown",
        level: "danger",
        reason: "below_floor",
        sex: "female",
        pace_kg_per_week: 0.9,
      }),
    );
  });

  it("fires once per reason — re-renders with the same reason do not refire", () => {
    function Probe() {
      const { state, set } = useOnboardingV2();
      return (
        <button
          type="button"
          data-testid="bump"
          onClick={() => set({ age: state.age + 1 })}
        >
          bump
        </button>
      );
    }
    withProvider(
      <>
        <PaceStep />
        <Probe />
      </>,
      {
        goal: "lose",
        sex: "female",
        age: 25,
        heightCm: 155,
        weightKg: 50,
        activity: "sedentary",
        paceKgPerWeek: 0.9,
      },
    );
    expect(trackMock).toHaveBeenCalledTimes(1);
    // Re-render with a state change that doesn't alter the warning
    // reason. Should not refire.
    fireEvent.click(screen.getByTestId("bump"));
    fireEvent.click(screen.getByTestId("bump"));
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("fires for non-danger banner levels too (warn / info)", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "male",
      age: 28,
      heightCm: 180,
      weightKg: 75,
      activity: "active",
      paceKgPerWeek: 0.9, // 0.9 / 75 = 1.2% > 1% → warn
    });
    expect(trackMock).toHaveBeenCalledWith(
      "onboarding_pace_below_safety_floor",
      expect.objectContaining({
        acted: "shown",
        level: "warn",
        reason: "fast_loss",
      }),
    );
  });

  it("does not fire when the user is comfortably safe (no banner)", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "male",
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activity: "moderate",
      paceKgPerWeek: 0.4,
    });
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("WebFlow — `advanced` event", () => {
  it("fires onboarding_pace_below_safety_floor with acted=advanced when Continue is tapped from the Pace step with a warning", () => {
    withProvider(<WebFlow />, {
      step: 8, // pace step (after auto-skip math)
      goal: "lose",
      sex: "female",
      age: 25,
      heightCm: 155,
      weightKg: 50,
      activity: "sedentary",
      paceKgPerWeek: 0.9,
    });
    // First call is the `shown` event from PaceStep mounting. Clear
    // it so the assertion below is unambiguous.
    trackMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(trackMock).toHaveBeenCalledWith(
      "onboarding_pace_below_safety_floor",
      expect.objectContaining({
        acted: "advanced",
        level: "danger",
        reason: "below_floor",
      }),
    );
  });

  it("does not fire `advanced` when Continue is tapped on a non-pace step", () => {
    withProvider(<WebFlow />, {
      step: 7, // activity step
      goal: "lose",
      sex: "female",
      age: 25,
      heightCm: 155,
      weightKg: 50,
      activity: "sedentary",
    });
    trackMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    // Navigation lands on Pace, which DOES fire its own `shown` event
    // — that's correct behaviour. We only assert that no `advanced`
    // variant fired, since the user wasn't on Pace when they hit
    // Continue.
    const advancedCalls = trackMock.mock.calls.filter(
      (c) =>
        c[0] === "onboarding_pace_below_safety_floor" &&
        (c[1] as { acted?: string } | undefined)?.acted === "advanced",
    );
    expect(advancedCalls).toHaveLength(0);
  });
});
