/**
 * ENG-1140 — render-level behavioural coverage for load-bearing CTAs.
 *
 * These tests intentionally mount the real CTA owners and click the rendered
 * controls. Source-grep button-system tests remain as secondary anti-drift
 * checks for token/variant shape only; behaviour belongs here.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockAuthUserId = vi.fn(() => "user-1");

vi.mock("../../src/context/AuthSessionContext", () => ({
  useAuthSession: () => ({ authedUserId: mockAuthUserId() }),
}));

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
      update: (payload: unknown) => {
        mockUpdate(table, payload);
        return { eq: vi.fn(async () => ({ error: null })) };
      },
    }),
  },
}));

vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => false,
}));

vi.mock("../../src/lib/analytics/track", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/analytics/track")>();
  return {
    ...actual,
    track: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    isFeatureDisabled: vi.fn(() => false),
  };
});

vi.mock("../../src/lib/profile/profileStorage", () => ({
  saveLocalProfile: vi.fn(),
}));

vi.mock("../../src/lib/onboarding/persist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/onboarding/persist")>();
  return {
    ...actual,
    persistOnboarding: vi.fn(async () => ({ ok: true })),
  };
});

vi.mock("../../src/lib/onboarding/onboardingSeedResolver", () => ({
  resolveSeedsToRecipeIds: vi.fn(async () => ({ resolved: [], missing: [] })),
  saveResolvedSeeds: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../src/lib/onboarding/onboardingFirstWeek", () => ({
  buildFirstWeekFromSeeds: vi.fn(async () => ({ ok: true })),
}));

import { FastingTimer } from "../../src/app/components/FastingTimer";
import { LogSheet } from "../../src/app/components/suppr/log-sheet";
import { OnboardingProvider } from "../../src/app/components/onboarding/context";
import { WebFlow } from "../../src/app/components/onboarding/web-flow";
import { STEP_IDS, type OnboardingState } from "../../src/lib/onboarding/state";

describe("ENG-1140 load-bearing CTA render behaviour", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockUpdate.mockReset();
    mockAuthUserId.mockReturnValue("user-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("end-fast CTA renders from persisted active fast and commits an ended session on click", async () => {
    const active = { start: "2026-06-19T10:00:00.000Z", end: null };
    mockMaybeSingle.mockResolvedValue({
      data: { fasting_sessions: [active], fasting_window: "16:8" },
    });

    render(<FastingTimer />);

    const cta = await screen.findByRole("button", { name: "End fast early" });
    expect(cta).toHaveTextContent("End fast");
    expect(cta).not.toBeDisabled();

    fireEvent.click(cta);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toBe("profiles");
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      fasting_sessions: [expect.objectContaining({ start: active.start, end: expect.any(String) })],
    });
  });

  it("log-commit CTA renders in manual barcode mode and passes edited macros to the commit handler", () => {
    const onConfirmManual = vi.fn();
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        barcode={{
          onOpen: () => {},
          manualEntry: { productName: "Test yoghurt", brand: "Suppr", barcode: "123" },
          onConfirmManual,
        }}
      />,
    );

    const cta = screen.getByRole("button", { name: "Log it" });
    expect(cta).toBeInTheDocument();
    expect(cta).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Kilocalories"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Protein grams"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Carbs grams"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Fat grams"), { target: { value: "4" } });
    fireEvent.click(cta);

    expect(onConfirmManual).toHaveBeenCalledTimes(1);
    expect(onConfirmManual).toHaveBeenCalledWith({
      productName: "Test yoghurt",
      brand: "Suppr",
      barcode: "123",
      portionGrams: 100,
      kcal: 180,
      protein: 14,
      carbs: 20,
      fat: 4,
    });
  });

  it("onboarding terminal CTA renders the live Build-my-plan copy, disables while saving, and navigates after commit", async () => {
    const terminalStep = STEP_IDS.indexOf("data-bridges");
    const initial: Partial<OnboardingState> = {
      step: terminalStep,
      name: "Grace",
      age: 32,
      heightCm: 170,
      weightKg: 70,
      sex: "female",
      activity: "moderate",
      goal: "lose",
      paceKgPerWeek: 0.25,
      diet: [],
      allergies: [],
    };
    const originalLocation = window.location;
    // jsdom's Location methods are not reliably assignable; replacing the
    // object lets the test assert the real navigation side effect.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/onboarding" },
    });

    render(
      <OnboardingProvider initial={initial}>
        <WebFlow />
      </OnboardingProvider>,
    );

    const cta = screen.getByRole("button", { name: /Build my plan/i });
    expect(cta).not.toBeDisabled();

    fireEvent.click(cta);
    expect(screen.getByRole("button", { name: /Building your plan/i })).toBeDisabled();

    await waitFor(() => expect(window.location.href).toBe("/home?onboarding_complete=1"));
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
