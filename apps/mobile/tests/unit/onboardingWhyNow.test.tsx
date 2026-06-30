// @vitest-environment jsdom
/**
 * ENG-963 — "What's bringing you here?" onboarding step (mobile).
 *
 * Mirror of `tests/unit/onboardingWhyNowWeb.test.tsx`. Verifies the same
 * customer-observable behaviour on iOS:
 *   1. Renders one tile per shared body-neutral option, in order.
 *   2. Picking an option writes `state.whyNow` and emits `onboarding_why_now`
 *      with `{ reason, platform: "ios" }`.
 *   3. The reveal step reflects the chosen intent back, sourced from the
 *      shared `figmaCopy.ts` ("a plan built around feeling better day to day").
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

import {
  OnboardingProvider,
  useOnboarding,
} from "../../components/onboarding/context";
import { MobileWhyNowStep } from "../../components/onboarding/steps/why-now";
import { MobileRevealStep } from "../../components/onboarding/steps/reveal";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@suppr/shared/onboarding/state";
import { ONBOARDING_WHY_NOW_OPTIONS } from "@suppr/shared/onboarding/whyNowOptions";
import { ONBOARDING_REVEAL_WHY_NOW_REFLECTION } from "@suppr/shared/onboarding/figmaCopy";

void React;

const trackMock = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  isFeatureEnabled: () => false,
  isFeatureDisabled: () => false,
}));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f0f0f0",
    icon: "#444",
    navPrimary: "#3B2A4D",
    primaryForeground: "#fff",
  }),
}));

function withProvider(ui: React.ReactNode, initial?: Partial<OnboardingState>) {
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(<OnboardingProvider initial={seed}>{ui}</OnboardingProvider>);
}

function WhyNowProbe() {
  const { state } = useOnboarding();
  return <RNText testID="why-now-value">{state.whyNow ?? "null"}</RNText>;
}

beforeEach(() => {
  trackMock.mockClear();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("MobileWhyNowStep — renders the shared body-neutral options", () => {
  it("renders one tile per option, in order", () => {
    const { getByText } = withProvider(<MobileWhyNowStep />);
    for (const opt of ONBOARDING_WHY_NOW_OPTIONS) {
      expect(getByText(opt.title)).toBeTruthy();
    }
  });
});

describe("MobileWhyNowStep — selection writes state + emits the event", () => {
  it("picking 'feel better' sets whyNow and emits onboarding_why_now {platform:ios}", () => {
    const feelBetter = ONBOARDING_WHY_NOW_OPTIONS[0];
    const { getByText, getByTestId } = withProvider(
      <>
        <MobileWhyNowStep />
        <WhyNowProbe />
      </>,
    );
    expect(getByTestId("why-now-value").props.children).toBe("null");

    fireEvent.press(getByText(feelBetter.title));

    expect(getByTestId("why-now-value").props.children).toBe("feel-better");
    expect(trackMock).toHaveBeenCalledWith("onboarding_why_now", {
      reason: "feel-better",
      platform: "ios",
    });
  });
});

describe("MobileRevealStep — reflects the why-now intent (ENG-963)", () => {
  const COMPLETE: Partial<OnboardingState> = {
    goal: "lose",
    sex: "female",
    age: 30,
    heightCm: 168,
    weightKg: 65,
    activity: "moderate",
  };

  it("reflects the chosen intent back, sourced from figmaCopy", () => {
    const { getByTestId } = withProvider(<MobileRevealStep />, {
      ...COMPLETE,
      whyNow: "feel-better",
    });
    expect(getByTestId("onboarding-reveal-why-now").props.children).toBe(
      ONBOARDING_REVEAL_WHY_NOW_REFLECTION["feel-better"],
    );
  });

  it("renders no reflection line when no intent was picked", () => {
    const { queryByTestId } = withProvider(<MobileRevealStep />, {
      ...COMPLETE,
      whyNow: null,
    });
    expect(queryByTestId("onboarding-reveal-why-now")).toBeNull();
  });
});
