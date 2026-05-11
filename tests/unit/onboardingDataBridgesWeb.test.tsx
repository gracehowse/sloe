import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  OnboardingProvider,
  useOnboarding,
} from "../../src/app/components/onboarding/context";
import { DataBridgesStep } from "../../src/app/components/onboarding/steps/data-bridges";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/state";

void React;

beforeEach(() => {
  // The provider hydrates from localStorage when no `initial` is
  // passed. Clear between tests so each scenario starts fresh.
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom storage; non-fatal */
  }
});

/**
 * Build-40 (2026-05-01) — onboarding data-bridges step (web).
 *
 * Locks the four behaviours customers see:
 *   1. Manual targets — typing in all four inputs + blurring writes
 *      manualTargets* into state and sets dataBridgeChosen = "manual".
 *   2. Manual targets — partial entry leaves the unset fields null.
 *   3. Notifications — the card is rendered (browser-permission flow
 *      is environment-dependent so we don't exercise the click).
 *   4. "Maybe later" — dataBridgeChosen = "skip" with one tap.
 *
 * Apple Health is intentionally not tested here — it's not in the web
 * mirror (iOS-only, per project_ios_only_no_android.md +
 * feedback_mobile_decisions_apply_to_web.md carve-out).
 */

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

function withProvider(
  ui: React.ReactNode,
  initial?: Partial<OnboardingState>,
) {
  // Passing `initial` (even an empty object) opts out of localStorage
  // hydration — keeps test runs deterministic.
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(
    <OnboardingProvider initial={seed}>{ui}</OnboardingProvider>,
  );
}

function StateProbe({ testId }: { testId: string }) {
  const { state } = useOnboarding();
  return (
    <div data-testid={testId}>
      {JSON.stringify({
        kcal: state.manualTargetsKcal,
        protein: state.manualTargetsProteinG,
        carbs: state.manualTargetsCarbsG,
        fat: state.manualTargetsFatG,
        chosen: state.dataBridgeChosen,
      })}
    </div>
  );
}

describe("DataBridgesStep — manual targets card", () => {
  it("writes all four manual fields + dataBridgeChosen='manual' when the user fills the form and blurs", () => {
    withProvider(
      <>
        <DataBridgesStep />
        <StateProbe testId="probe" />
      </>,
    );

    const kcal = screen.getByLabelText("Manual kcal target") as HTMLInputElement;
    const protein = screen.getByLabelText("Manual P g target") as HTMLInputElement;
    const carbs = screen.getByLabelText("Manual C g target") as HTMLInputElement;
    const fat = screen.getByLabelText("Manual F g target") as HTMLInputElement;

    fireEvent.change(kcal, { target: { value: "1800" } });
    fireEvent.change(protein, { target: { value: "140" } });
    fireEvent.change(carbs, { target: { value: "170" } });
    fireEvent.change(fat, { target: { value: "55" } });
    // Commit on blur (matches the production wiring).
    fireEvent.blur(fat);

    const probe = JSON.parse(screen.getByTestId("probe").textContent ?? "{}");
    expect(probe.kcal).toBe(1800);
    expect(probe.protein).toBe(140);
    expect(probe.carbs).toBe(170);
    expect(probe.fat).toBe(55);
    expect(probe.chosen).toBe("manual");
  });

  it("partial entry — kcal-only — leaves the other fields null", () => {
    withProvider(
      <>
        <DataBridgesStep />
        <StateProbe testId="probe" />
      </>,
    );
    const kcal = screen.getByLabelText("Manual kcal target") as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: "1800" } });
    fireEvent.blur(kcal);
    const probe = JSON.parse(screen.getByTestId("probe").textContent ?? "{}");
    expect(probe.kcal).toBe(1800);
    expect(probe.protein).toBeNull();
    expect(probe.carbs).toBeNull();
    expect(probe.fat).toBeNull();
    // dataBridgeChosen reflects the LAST card tapped, not whether the
    // override is complete — partial reads as "user engaged with manual".
    expect(probe.chosen).toBe("manual");
  });

  it("clearing a field after entry rolls back to null", () => {
    withProvider(
      <>
        <DataBridgesStep />
        <StateProbe testId="probe" />
      </>,
    );
    const kcal = screen.getByLabelText("Manual kcal target") as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: "1800" } });
    fireEvent.blur(kcal);
    fireEvent.change(kcal, { target: { value: "" } });
    fireEvent.blur(kcal);
    const probe = JSON.parse(screen.getByTestId("probe").textContent ?? "{}");
    expect(probe.kcal).toBeNull();
  });
});

describe("DataBridgesStep — Maybe later", () => {
  it("tapping 'Maybe later' sets dataBridgeChosen='skip'", () => {
    withProvider(
      <>
        <DataBridgesStep />
        <StateProbe testId="probe" />
      </>,
    );
    const skip = screen.getByText("Maybe later");
    fireEvent.click(skip);
    const probe = JSON.parse(screen.getByTestId("probe").textContent ?? "{}");
    expect(probe.chosen).toBe("skip");
  });

  it("after skip, the button label flips to 'Skipped'", () => {
    withProvider(
      <>
        <DataBridgesStep />
        <StateProbe testId="probe" />
      </>,
    );
    fireEvent.click(screen.getByText("Maybe later"));
    expect(screen.getByText("Skipped")).toBeTruthy();
  });
});

describe("DataBridgesStep — card structure", () => {
  it("renders three cards on web (manual / notifications / recipe — Apple Health iOS-only)", () => {
    withProvider(<DataBridgesStep />);
    expect(screen.getByText("I already know my targets")).toBeTruthy();
    expect(screen.getByText("Gentle reminders")).toBeTruthy();
    // Pre-launch P0 (2026-05-11): the recipe card no longer simulates an
    // import on tap. Title changed from "Try a recipe import" to
    // "Recipe import" — honest preview, no input field, no fake success.
    expect(screen.getByText("Recipe import")).toBeTruthy();
    // Web does NOT include the Apple Health card.
    expect(screen.queryByText(/Apple Health/i)).toBeNull();
  });

  it("recipe card is a preview only — no input + no fake success state", () => {
    withProvider(<DataBridgesStep />);
    // The simulated input + button + dataBridgeChosen=recipe write were
    // removed because the import never actually happened. Tester would
    // see "Imported — open Library to see it" but nothing was in Library.
    expect(screen.queryByLabelText("Recipe URL")).toBeNull();
    expect(screen.queryByText("Try a sample recipe")).toBeNull();
    expect(screen.queryByText(/Imported/)).toBeNull();
  });
});
