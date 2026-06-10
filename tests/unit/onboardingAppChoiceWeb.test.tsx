import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  OnboardingProvider,
  useOnboarding,
} from "../../src/app/components/onboarding/context";
import { AppChoiceStep } from "../../src/app/components/onboarding/steps/app-choice";
import { DataBridgesStep } from "../../src/app/components/onboarding/steps/data-bridges";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/state";
import { REGISTERED_ADAPTERS } from "../../src/lib/imports/csv/adapters/registry";

void React;

/**
 * ENG-990 — "Coming from another app?" onboarding step (web).
 *
 * Locks the customer-observable behaviour:
 *   1. Renders one tile per registered importable adapter (MFP first)
 *      plus the "Another app" / "I'm starting fresh" tiles.
 *   2. Picking an importable app writes `state.appChoice` and emits
 *      `onboarding_app_choice` with `{ app, has_importer: true,
 *      platform: "web" }`.
 *   3. Picking "I'm starting fresh" emits `has_importer: false`.
 *   4. A pick that has an importer surfaces the "bring your history"
 *      reassurance; a fresh-start pick surfaces the calm copy.
 *   5. Downstream, the data-bridges importer card LEADS with the chosen
 *      app's name when that app is importable (the pre-highlight) and
 *      keeps generic copy otherwise.
 */

const trackMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  // Flag OFF keeps SupprCard's resting paint; the step itself doesn't
  // read the flag (the shell does), so this only matters transitively.
  isFeatureEnabled: () => false,
}));
// The data-bridges importer card transitively imports the supabase
// browser client; stub it so the module-level createClient doesn't throw.
vi.mock("@/lib/supabase/browserClient", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function withProvider(ui: React.ReactNode, initial?: Partial<OnboardingState>) {
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(<OnboardingProvider initial={seed}>{ui}</OnboardingProvider>);
}

function ChoiceProbe() {
  const { state } = useOnboarding();
  return <div data-testid="app-choice">{state.appChoice ?? "null"}</div>;
}

beforeEach(() => {
  trackMock.mockClear();
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom; non-fatal */
  }
});

describe("AppChoiceStep (web) — renders the registry-derived tiles", () => {
  it("renders a tile for MyFitnessPal (priority cohort) and the two non-adapter tiles", () => {
    withProvider(<AppChoiceStep />);
    expect(
      screen.getByRole("button", { name: /myfitnesspal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /another app/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /starting fresh/i }),
    ).toBeInTheDocument();
  });

  it("renders one tile per registered adapter", () => {
    withProvider(<AppChoiceStep />);
    for (const adapter of REGISTERED_ADAPTERS) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(adapter.displayName, "i"),
        }),
      ).toBeInTheDocument();
    }
  });
});

describe("AppChoiceStep (web) — selection writes state + emits the event", () => {
  it("picking MyFitnessPal sets appChoice and emits onboarding_app_choice {has_importer:true}", () => {
    withProvider(
      <>
        <AppChoiceStep />
        <ChoiceProbe />
      </>,
    );
    expect(screen.getByTestId("app-choice").textContent).toBe("null");

    fireEvent.click(screen.getByRole("button", { name: /myfitnesspal/i }));

    expect(screen.getByTestId("app-choice").textContent).toBe("mfp");
    expect(trackMock).toHaveBeenCalledWith("onboarding_app_choice", {
      app: "mfp",
      has_importer: true,
      platform: "web",
    });
  });

  it("picking 'I'm starting fresh' emits has_importer:false and app:none", () => {
    withProvider(
      <>
        <AppChoiceStep />
        <ChoiceProbe />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /starting fresh/i }));
    expect(screen.getByTestId("app-choice").textContent).toBe("none");
    expect(trackMock).toHaveBeenCalledWith("onboarding_app_choice", {
      app: "none",
      has_importer: false,
      platform: "web",
    });
  });

  it("shows the 'bring your history' reassurance only for an importable pick", () => {
    withProvider(<AppChoiceStep />);
    // No follow-up before a pick.
    expect(screen.queryByTestId("app-choice-followup")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /myfitnesspal/i }));
    expect(screen.getByTestId("app-choice-followup").textContent).toMatch(
      /bring your history/i,
    );
  });

  it("shows calm fresh-start copy for the non-importable pick", () => {
    withProvider(<AppChoiceStep />);
    fireEvent.click(screen.getByRole("button", { name: /starting fresh/i }));
    expect(screen.getByTestId("app-choice-followup").textContent).toMatch(
      /build your plan around your goals/i,
    );
  });
});

describe("data-bridges importer pre-highlight (web) — ENG-990 hand-off", () => {
  it("leads the importer card with the chosen app's name when importable", () => {
    withProvider(<DataBridgesStep />, {
      ...DEFAULT_ONBOARDING_STATE,
      appChoice: "mfp",
    });
    // The card title becomes "Bring your MyFitnessPal history".
    expect(
      screen.getByText(/bring your myfitnesspal history/i),
    ).toBeInTheDocument();
  });

  it("keeps generic importer copy when the user is starting fresh", () => {
    withProvider(<DataBridgesStep />, {
      ...DEFAULT_ONBOARDING_STATE,
      appChoice: "none",
    });
    expect(screen.getByText(/import from another app/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/bring your myfitnesspal history/i),
    ).toBeNull();
  });
});
