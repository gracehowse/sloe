// @vitest-environment jsdom
/**
 * Onboarding v2 — mobile Signup step session gate + email honesty
 * (ENG-672, Urgent / launch-blocker).
 *
 * Pre-fix the mobile Signup step called `go(1)` immediately after a
 * successful `signInWithIdToken`, advancing the flow before the
 * session was guaranteed to have landed in the auth context — and the
 * footer Continue (never suppressed on this step) let a user leap the
 * auth handshake entirely. Either way they could complete the flow
 * unauthenticated and lose every answer on the terminal /login bounce.
 *
 * It also advertised an email field that did nothing ("arrives in a
 * future build" in fine print) — a trust-killer for MFP refugees.
 *
 * This test pins the user-observable contract of the fix:
 *   1. NO fake email *field* is rendered (ENG-672 honesty). ENG-1563 adds a
 *      discoverable "Continue with email" escape that routes to `/login`.
 *   2. The Apple Sign-In CTA is present.
 *   3. After a successful Apple sign-in the step does NOT self-advance
 *      — forward motion is owned by the shell's session-driven
 *      auto-skip effect. The step stays put and `authMethod` flips to
 *      "apple".
 *
 * The shared `canAdvance("signup", …)` session gate (which the footer
 * Continue and the shell both honour) is covered cross-platform in
 * `tests/unit/onboardingState.test.ts`.
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text as RNText } from "react-native";
import {
  OnboardingProvider,
  useOnboarding,
} from "../../components/onboarding/context";
import { MobileSignupStep } from "../../components/onboarding/steps/signup";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
} from "@suppr/shared/onboarding/state";

void React;

const signInAsyncMock = vi.fn();
const signInWithIdTokenMock = vi.fn();

// `vi.mock` is hoisted above the imports above by vitest, so these
// modules are mocked before `MobileSignupStep` / the provider load them.
vi.mock("expo-apple-authentication", () => ({
  signInAsync: (...args: unknown[]) => signInAsyncMock(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock("js-sha256", () => ({ sha256: () => "hashed-nonce" }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: unknown[]) => signInWithIdTokenMock(...args),
    },
  },
}));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    border: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

function Probe() {
  const { currentStepId, state } = useOnboarding();
  return (
    <RNText testID="probe">
      {JSON.stringify({ step: currentStepId, authMethod: state.authMethod })}
    </RNText>
  );
}

function renderSignup() {
  return render(
    <OnboardingProvider
      initial={{ ...DEFAULT_ONBOARDING_STATE, step: STEP_IDS.indexOf("signup") }}
    >
      <MobileSignupStep />
      <Probe />
    </OnboardingProvider>,
  );
}

afterEach(() => {
  signInAsyncMock.mockReset();
  signInWithIdTokenMock.mockReset();
});

describe("MobileSignupStep — honest, session-gated (ENG-672 / ENG-1563)", () => {
  it("renders Apple CTA, no fake email field, and a discoverable email escape", () => {
    const { getByLabelText, queryByPlaceholderText, queryByText, getByText, getByTestId } =
      renderSignup();
    expect(getByLabelText("Sign in with Apple")).toBeTruthy();
    // The email *field* is gone — it advertised a path that didn't exist.
    expect(queryByPlaceholderText("you@example.com")).toBeNull();
    // ENG-1563 — discoverable escape to real login email entry.
    expect(getByTestId("signup-continue-email")).toBeTruthy();
    expect(getByLabelText("I already have an account")).toBeTruthy();
    // The optional first-name field stays.
    expect(queryByPlaceholderText("Grace")).toBeTruthy();
    // ENG-1516 — the "Email sign-up is coming soon" promise is gone too
    // (it sat unshipped since ENG-672). The fine print is now only the
    // Terms/Privacy line, with no email mention at all.
    expect(getByText(/Terms and Privacy Policy\./i)).toBeTruthy();
    expect(queryByText(/coming soon/i)).toBeNull();
  });

  it("does NOT self-advance after a successful Apple sign-in (the shell owns advance)", async () => {
    signInAsyncMock.mockResolvedValue({
      identityToken: "tok",
      fullName: { givenName: "Grace" },
    });
    signInWithIdTokenMock.mockResolvedValue({ error: null });

    const { getByLabelText, getByTestId } = renderSignup();
    expect(JSON.parse(getByTestId("probe").props.children).step).toBe("signup");

    fireEvent.press(getByLabelText("Sign in with Apple"));

    // authMethod flips to "apple" once the (mocked) auth resolves...
    await waitFor(() =>
      expect(
        JSON.parse(getByTestId("probe").props.children).authMethod,
      ).toBe("apple"),
    );
    // ...but the step does NOT advance itself. Pre-fix `go(1)` here
    // could leap ahead of the real session landing. The shell's
    // auto-skip effect (not the step) advances once the auth context
    // flips — and in this isolated render there's no auth provider, so
    // we correctly stay on signup.
    expect(JSON.parse(getByTestId("probe").props.children).step).toBe("signup");
  });

  it("surfaces an auth error and stays on the signup step", async () => {
    signInAsyncMock.mockResolvedValue({ identityToken: "tok", fullName: null });
    signInWithIdTokenMock.mockResolvedValue({
      error: { message: "Token rejected" },
    });

    const { getByLabelText, getByText, getByTestId } = renderSignup();
    fireEvent.press(getByLabelText("Sign in with Apple"));

    await waitFor(() => expect(getByText("Token rejected")).toBeTruthy());
    expect(JSON.parse(getByTestId("probe").props.children).step).toBe("signup");
  });
});
