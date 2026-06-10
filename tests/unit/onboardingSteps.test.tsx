import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  OnboardingProvider,
  useOnboarding,
} from "../../src/app/components/onboarding/context";
import {
  STEP_COMPONENTS,
  GoalStep,
  PaceStep,
  DietStep,
  RevealStep,
  StrategyStep,
} from "../../src/app/components/onboarding/steps";
import {
  STEP_IDS,
  type OnboardingState,
} from "../../src/lib/onboarding/state";

void React;

/**
 * Onboarding v2 — step component tests.
 *
 * We don't try for full visual coverage here — that lives in the
 * design-system Storybook tier (out of scope for Phase 2). What we do
 * lock in:
 *
 *   - Smoke-render every step inside the provider so a silly typo or
 *     bad icon import is caught at build time, not at /onboarding/v2.
 *   - Goal step: clicking an OptionCard updates state.
 *   - Pace step: warning banner + reason are rendered with the correct
 *     `data-warning-level` for each soft-warn level. Continue is the
 *     route's concern, not the step's, so we don't test it here.
 *   - Diet step: "Anything goes" toggles exclusively (selecting it
 *     drops other diets; selecting another diet drops "anything").
 *   - Reveal step: renders the target value when state is complete;
 *     renders the quieter fallback when targets are null.
 */

function withProvider(
  ui: React.ReactNode,
  initial?: Partial<OnboardingState>,
) {
  return render(
    <OnboardingProvider initial={initial}>{ui}</OnboardingProvider>,
  );
}

describe("onboarding v2 — smoke render every step", () => {
  // Sane stats so the Pace and Reveal steps can compute targets.
  const completeProfile: Partial<OnboardingState> = {
    sex: "female",
    age: 28,
    heightCm: 168,
    weightKg: 62,
    activity: "moderate",
    goal: "lose",
    paceKgPerWeek: 0.4,
  };

  for (const id of STEP_IDS) {
    it(`renders step "${id}" without crashing`, () => {
      const Step = STEP_COMPONENTS[id];
      // wrap with provider; use complete profile so Pace/Reveal don't
      // hit empty-state branches that would silently mask render bugs.
      withProvider(<Step />, completeProfile);
      // Some steps have no canonical role, so we only assert that *something*
      // got mounted.
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    });
  }
});

describe("GoalStep", () => {
  it("updates state when an OptionCard is clicked", () => {
    function Probe() {
      const { state } = useOnboarding();
      return <div data-testid="goal-display">{state.goal ?? "none"}</div>;
    }
    withProvider(
      <>
        <GoalStep />
        <Probe />
      </>,
    );
    expect(screen.getByTestId("goal-display").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: /lose fat/i }));
    expect(screen.getByTestId("goal-display").textContent).toBe("lose");
    fireEvent.click(screen.getByRole("button", { name: /maintain/i }));
    expect(screen.getByTestId("goal-display").textContent).toBe("maintain");
  });
});

describe("PaceStep — soft-warn safety floor banner", () => {
  // These three states are picked so paceWarning() returns each level
  // (covered exhaustively in onboardingV2Targets.test.ts). Here we
  // only check the UI mirrors that level via data attributes.

  it("renders a danger banner when projected target falls below the safety floor", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "female",
      age: 25,
      heightCm: 155,
      weightKg: 50,
      activity: "sedentary",
      paceKgPerWeek: 0.9,
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-warning-level", "danger");
    expect(alert).toHaveAttribute("data-warning-reason", "below_floor");
    expect(alert.textContent).toContain("Below the");
  });

  it("renders a warn banner when weekly loss exceeds 1% of bodyweight", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "male",
      age: 28,
      heightCm: 180,
      weightKg: 75,
      activity: "active",
      // 0.9 / 75 = 1.2% > 1%, but TDEE for this profile keeps target
      // safely above 1500 — paceWarning returns "warn" not "danger".
      paceKgPerWeek: 0.9,
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-warning-level", "warn");
    expect(alert).toHaveAttribute("data-warning-reason", "fast_loss");
  });

  it("renders no banner when the user is comfortably safe", () => {
    withProvider(<PaceStep />, {
      goal: "lose",
      sex: "male",
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activity: "moderate",
      paceKgPerWeek: 0.4,
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("DietStep — Anything-goes exclusivity", () => {
  it("clears other diets when 'Anything goes' is picked", () => {
    function Probe() {
      const { state } = useOnboarding();
      return (
        <div data-testid="diet-display">{state.diet.join(",") || "—"}</div>
      );
    }
    withProvider(
      <>
        <DietStep />
        <Probe />
      </>,
      { diet: ["vegetarian", "keto"] },
    );
    expect(screen.getByTestId("diet-display").textContent).toBe(
      "vegetarian,keto",
    );
    fireEvent.click(screen.getByRole("button", { name: /anything goes/i }));
    expect(screen.getByTestId("diet-display").textContent).toBe("anything");
  });

  it("drops 'Anything goes' when a specific diet is added", () => {
    function Probe() {
      const { state } = useOnboarding();
      return (
        <div data-testid="diet-display">{state.diet.join(",") || "—"}</div>
      );
    }
    withProvider(
      <>
        <DietStep />
        <Probe />
      </>,
      { diet: ["anything"] },
    );
    fireEvent.click(screen.getByRole("button", { name: "Vegetarian", exact: true }));
    expect(screen.getByTestId("diet-display").textContent).toBe("vegetarian");
  });
});

describe("StrategyStep — prototype visual pass (D2)", () => {
  it("renders the tightened subtitle (no em-dash) and methodology note", () => {
    withProvider(<StrategyStep />, { goal: "lose" });
    expect(
      screen.getByText("Pre-picked from your goal. Tap to override."),
    ).toBeInTheDocument();
    // MethodologyNote copy earns its keep on Strategy.
    expect(
      screen.getByText(
        /Macro ratios are a starting point\. Suppr recalibrates protein and carbs as you log and weigh in\./i,
      ),
    ).toBeInTheDocument();
  });

  it("renders 4 option subtitles with comma rhythm (no em-dash)", () => {
    withProvider(<StrategyStep />, { goal: "lose" });
    expect(
      screen.getByText("Even split, flexible across cuisines."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("~2.2 g/kg, muscle-building leaning."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Filling meals, easier in a deficit."),
    ).toBeInTheDocument();
    expect(screen.getByText("Carbs minimised, fat-led.")).toBeInTheDocument();
  });

  it("shows 'Recommended' pill on the goal-derived option with the prototype-spec style", () => {
    withProvider(<StrategyStep />, { goal: "lose" });
    const pill = screen.getByText("Recommended");
    // Prototype spec: bg-primary/15, 10px bold uppercase, 0.1em tracking.
    expect(pill.className).toContain("bg-primary/15");
    expect(pill.className).toContain("text-[10px]");
    expect(pill.className).toContain("font-bold");
    expect(pill.className).toContain("uppercase");
    expect(pill.className).toContain("tracking-[0.1em]");
  });

  it("overrides the recommendation when a different option is clicked", () => {
    function Probe() {
      const { state } = useOnboarding();
      return (
        <div data-testid="strategy-display">
          {state.nutritionStrategy ?? "none"}
        </div>
      );
    }
    withProvider(
      <>
        <StrategyStep />
        <Probe />
      </>,
      { goal: "lose" },
    );
    expect(screen.getByTestId("strategy-display").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: /low carb/i }));
    expect(screen.getByTestId("strategy-display").textContent).toBe("low_carb");
  });
});

describe("RevealStep", () => {
  // Note on the count-up: the daily-target hero animates from 0 to the
  // computed target over ~1.2 s via requestAnimationFrame, behind a
  // ~700ms "Crunching your numbers…" anticipation beat (2026-05-12
  // premium-bar audit DC1 — Cal AI plan-reveal borrow). We assert on
  // the static BMR + TDEE rows (1,369 / 2,122 for the textbook profile)
  // which are present from the first frame and don't depend on the
  // beat / rAF timing.
  //
  // For the "kcal / day" caption we use vi.useFakeTimers + advance past
  // the 700ms beat so the count-up starts. The caption is only rendered
  // after the beat completes (during the beat, the centre shows the
  // anticipation copy instead).
  it("renders the BMR + TDEE summary when state is complete", () => {
    vi.useFakeTimers();
    try {
      withProvider(<RevealStep />, {
        sex: "female",
        age: 28,
        heightCm: 168,
        weightKg: 62,
        activity: "moderate",
        goal: "lose",
        paceKgPerWeek: 0.4,
      });
      expect(screen.getByText("1,369")).toBeInTheDocument(); // BMR
      expect(screen.getByText("2,122")).toBeInTheDocument(); // TDEE
      // Pre-beat: anticipation copy in the centre, no kcal/day caption.
      expect(
        screen.getByText(/crunching your numbers/i),
      ).toBeInTheDocument();
      // Advance past the 700ms anticipation beat so the count-up
      // hero renders the kcal/day caption.
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.getByText(/kcal \/ day/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the quieter fallback when body stats are incomplete", () => {
    withProvider(<RevealStep />, { goal: "lose" });
    expect(
      screen.getByText(/answer the body-stats steps/i),
    ).toBeInTheDocument();
  });
});

describe("OnboardingProvider", () => {
  it("throws when useOnboarding is called outside a provider", () => {
    // Suppress the React error boundary noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Naked() {
      useOnboarding();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(
      /useOnboarding must be used inside/i,
    );
    spy.mockRestore();
  });

  it("auto-skips the pace step when goal is maintain (forward navigation)", () => {
    function Probe() {
      const { currentStepId, go } = useOnboarding();
      return (
        <>
          <span data-testid="step-id">{currentStepId}</span>
          <button type="button" onClick={() => go(1)} data-testid="next">
            next
          </button>
        </>
      );
    }
    withProvider(<Probe />, {
      goal: "maintain",
      // Index-relative so this survives step reordering (ENG-990 added
      // `app-choice` after Welcome, shifting `activity`'s raw index).
      step: STEP_IDS.indexOf("activity"),
    });
    expect(screen.getByTestId("step-id").textContent).toBe("activity");
    fireEvent.click(screen.getByTestId("next"));
    // Should land on `diet` (skipping `pace`).
    expect(screen.getByTestId("step-id").textContent).toBe("diet");
  });
});
