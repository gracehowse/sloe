import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  OnboardingProvider,
  useOnboarding,
} from "../../src/app/components/onboarding/context";
import { WhyNowStep } from "../../src/app/components/onboarding/steps/why-now";
import { RevealStep } from "../../src/app/components/onboarding/steps/reveal";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/state";
import {
  ONBOARDING_WHY_NOW_OPTIONS,
} from "../../src/lib/onboarding/whyNowOptions";
import { ONBOARDING_REVEAL_WHY_NOW_REFLECTION } from "../../src/lib/onboarding/figmaCopy";

void React;

/**
 * ENG-963 — "What's bringing you here?" onboarding step (web).
 *
 * Locks the customer-observable behaviour:
 *   1. Renders one tile per shared body-neutral option, in order.
 *   2. Picking an option writes `state.whyNow` and emits `onboarding_why_now`
 *      with `{ reason, platform: "web" }`.
 *   3. The reveal step reflects the chosen intent back, sourced from
 *      `figmaCopy.ts` (the "a plan built around feeling better day to day"
 *      line) — and renders nothing extra when no intent was picked.
 */

const trackMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  // Flag reads in the reveal step (jargon gloss, progressive text, etc.)
  // resolve OFF.
  isFeatureEnabled: () => false,
}));

function withProvider(ui: React.ReactNode, initial?: Partial<OnboardingState>) {
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(<OnboardingProvider initial={seed}>{ui}</OnboardingProvider>);
}

function WhyNowProbe() {
  const { state } = useOnboarding();
  return <div data-testid="why-now-value">{state.whyNow ?? "null"}</div>;
}

beforeEach(() => {
  trackMock.mockClear();
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom — non-fatal */
  }
});

describe("WhyNowStep (web) — renders the shared body-neutral options", () => {
  it("renders one tile per option, in order", () => {
    withProvider(<WhyNowStep />);
    for (const opt of ONBOARDING_WHY_NOW_OPTIONS) {
      expect(
        screen.getByRole("button", { name: new RegExp(opt.title, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("surfaces the calm 'Optional — …' subtitle (skippable framing)", () => {
    withProvider(<WhyNowStep />);
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
    expect(screen.getByText(/skip if you'd rather/i)).toBeInTheDocument();
  });
});

describe("WhyNowStep (web) — selection writes state + emits the event", () => {
  it("picking 'feel better' sets whyNow and emits onboarding_why_now", () => {
    withProvider(
      <>
        <WhyNowStep />
        <WhyNowProbe />
      </>,
    );
    expect(screen.getByTestId("why-now-value").textContent).toBe("null");

    fireEvent.click(
      screen.getByRole("button", { name: /feel better day to day/i }),
    );

    expect(screen.getByTestId("why-now-value").textContent).toBe("feel-better");
    expect(trackMock).toHaveBeenCalledWith("onboarding_why_now", {
      reason: "feel-better",
      platform: "web",
    });
  });

  it("picking 'just curious' emits reason: curious", () => {
    withProvider(
      <>
        <WhyNowStep />
        <WhyNowProbe />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /just curious/i }));
    expect(screen.getByTestId("why-now-value").textContent).toBe("curious");
    expect(trackMock).toHaveBeenCalledWith("onboarding_why_now", {
      reason: "curious",
      platform: "web",
    });
  });
});

describe("RevealStep (web) — reflects the why-now intent (ENG-963)", () => {
  const COMPLETE: Partial<OnboardingState> = {
    goal: "lose",
    sex: "female",
    age: 30,
    heightCm: 168,
    weightKg: 65,
    activity: "moderate",
  };

  it("reflects the chosen intent back, sourced from figmaCopy", () => {
    withProvider(<RevealStep />, { ...COMPLETE, whyNow: "feel-better" });
    const reflection = screen.getByTestId("onboarding-reveal-why-now");
    expect(reflection.textContent).toBe(
      ONBOARDING_REVEAL_WHY_NOW_REFLECTION["feel-better"],
    );
    // The load-bearing copy the ticket pins.
    expect(reflection.textContent).toMatch(/feeling better day to day/i);
  });

  it("renders no reflection line when no intent was picked", () => {
    withProvider(<RevealStep />, { ...COMPLETE, whyNow: null });
    expect(screen.queryByTestId("onboarding-reveal-why-now")).toBeNull();
  });
});
