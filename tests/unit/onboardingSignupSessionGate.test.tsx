/**
 * Onboarding v2 — Signup step session gate + email honesty (ENG-672).
 *
 * Urgent / launch-blocker. The pre-fix Signup step advanced the flow
 * (`go(1)`) the moment `signUp` returned a `user`, even in confirm-email
 * mode where NO `session` lands. A user could then walk the rest of the
 * flow unauthenticated and lose every answer on the terminal /login
 * bounce — the worst first impression for an MFP refugee.
 *
 * These tests pin the user-observable contract of the fix on web:
 *   - confirm-email mode (`signUp` → user, no session) shows an HONEST
 *     "check your email" state and does NOT advance the flow;
 *   - the step never self-advances on `signUp` — forward motion is
 *     owned by the session-driven auto-skip effect in `web-flow.tsx`,
 *     so `state.step` stays put after a successful signUp here.
 *
 * Mirror of the mobile guard (`canAdvance("signup", …)` requires
 * `hasSession`) covered in `onboardingState.test.ts`; this file covers
 * the web step's own confirm-email branch which has no mobile twin
 * (mobile is Apple-Sign-In-only).
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

const signUpMock = vi.fn();

vi.mock("../../src/lib/analytics/track.ts", () => ({ track: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { identify: vi.fn() } }));
vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => signUpMock(...args) } },
}));

import {
  OnboardingProvider,
  useOnboarding,
} from "../../src/app/components/onboarding/context";
import { SignupStep } from "../../src/app/components/onboarding/steps/signup";
import { STEP_IDS } from "../../src/lib/onboarding/state";

function StepProbe() {
  const { currentStepId } = useOnboarding();
  return <div data-testid="step-id">{currentStepId}</div>;
}

function renderSignup() {
  return render(
    <OnboardingProvider initial={{ step: STEP_IDS.indexOf("signup") }}>
      <SignupStep />
      <StepProbe />
    </OnboardingProvider>,
  );
}

async function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText("Grace"), {
    target: { value: "Grace" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "grace@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
    target: { value: "supersecret" },
  });
  fireEvent.click(
    screen.getByLabelText(/agree to terms of service and privacy policy/i),
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  });
}

afterEach(() => {
  signUpMock.mockReset();
});

describe("SignupStep (web) — confirm-email mode is honest and does not advance (ENG-672)", () => {
  it("shows 'Check your email' and STAYS on the signup step when no session lands", async () => {
    // Confirm-email mode: Supabase returns a user but NO session.
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    renderSignup();
    expect(screen.getByTestId("step-id").textContent).toBe("signup");

    await fillAndSubmit();

    // Honest interstitial — the account exists but isn't usable yet.
    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeTruthy(),
    );
    expect(screen.getByText(/grace@example.com/)).toBeTruthy();

    // CRITICAL: the flow did NOT advance. Pre-fix this stepped to "goal"
    // (the user walking the flow unauthenticated). It must stay put.
    expect(screen.getByTestId("step-id").textContent).toBe("signup");
  });

  it("does NOT self-advance even when signUp returns a session (the auto-skip effect owns advance)", async () => {
    // Confirmations-off mode: signUp returns a session immediately. The
    // step must NOT call go(1) itself — advance is owned by the
    // session-driven auto-skip effect in the shell, so in isolation here
    // the step stays put and shows neither the form-advance nor the
    // confirm-email state.
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t" } },
      error: null,
    });

    renderSignup();
    await fillAndSubmit();

    // No confirm-email interstitial (a session DID land).
    expect(screen.queryByText(/check your email/i)).toBeNull();
    // Step unchanged — the shell's auto-skip effect (not the step) does
    // the advance once the auth context flips. In this isolated render
    // there's no auth subscriber, so we stay on signup.
    expect(screen.getByTestId("step-id").textContent).toBe("signup");
  });

  it("surfaces the signUp error and stays on the signup step", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    renderSignup();
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "User already registered",
      ),
    );
    expect(screen.queryByText(/check your email/i)).toBeNull();
    expect(screen.getByTestId("step-id").textContent).toBe("signup");
  });
});
