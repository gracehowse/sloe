// @vitest-environment jsdom
/**
 * ENG-990 — "Coming from another app?" onboarding step (mobile).
 *
 * Mirror of `tests/unit/onboardingAppChoiceWeb.test.tsx`. Verifies the
 * same customer-observable behaviour on iOS:
 *   1. Renders one tile per registered importable adapter (MFP first)
 *      plus "Another app" / "I'm starting fresh".
 *   2. Picking an importable app writes `state.appChoice` and emits
 *      `onboarding_app_choice` with `{ app, has_importer: true,
 *      platform: "ios" }`.
 *   3. Picking "I'm starting fresh" emits `has_importer: false`.
 *   4. Downstream, the data-bridges importer card LEADS with the chosen
 *      app's name when importable (the pre-highlight).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

import {
  OnboardingProvider,
  useOnboarding,
} from "../../components/onboarding/context";
import { MobileAppChoiceStep } from "../../components/onboarding/steps/app-choice";
import { MobileDataBridgesStep } from "../../components/onboarding/steps/data-bridges";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@suppr/shared/onboarding/state";
import { REGISTERED_ADAPTERS } from "@suppr/shared/imports/csv/adapters/registry";

void React;

const trackMock = vi.fn();
// `@/lib/analytics` — track + the cold-safe flag readers the context
// uses. `isFeatureEnabled` false keeps the app-choice step OFF in the
// shell (irrelevant when we render the step directly, but the provider
// reads it on render).
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  isFeatureEnabled: () => false,
  isFeatureDisabled: () => false,
}));

// Auth context — authed so the data-bridges importer card mounts cleanly.
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "test-user-id" } } }),
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
  }),
}));
// The data-bridges importer card transitively reaches authedFetch /
// supabase / web base — stub so module-level construction doesn't throw.
vi.mock("@/lib/healthSync", () => ({
  requestHealthPermissions: vi.fn(async () => ({ ok: false, userMessage: "" })),
  syncHealthData: vi.fn(async () => ({})),
}));
vi.mock("@/lib/expoPushToken", () => ({
  registerExpoPushTokenForUser: vi.fn(async () => undefined),
  markNotificationsPromptDismissed: vi.fn(async () => undefined),
}));
vi.mock("@/lib/authedFetch", () => ({
  authedFetch: vi.fn(async () => new Response(JSON.stringify({ ok: false }))),
}));
vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => "https://suppr-club.com",
  getSupprWebBase: () => "https://suppr-club.com",
}));

function withProvider(ui: React.ReactNode, initial?: Partial<OnboardingState>) {
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(<OnboardingProvider initial={seed}>{ui}</OnboardingProvider>);
}

function ChoiceProbe() {
  const { state } = useOnboarding();
  return <RNText testID="app-choice">{state.appChoice ?? "null"}</RNText>;
}

beforeEach(() => {
  trackMock.mockClear();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("MobileAppChoiceStep — renders the registry-derived tiles", () => {
  it("renders MyFitnessPal (first) + the two non-adapter tiles", () => {
    const { getByText } = withProvider(<MobileAppChoiceStep />);
    expect(getByText("MyFitnessPal")).toBeTruthy();
    expect(getByText("Another app")).toBeTruthy();
    expect(getByText("I'm starting fresh")).toBeTruthy();
  });

  it("renders one tile per registered adapter", () => {
    const { getByText } = withProvider(<MobileAppChoiceStep />);
    for (const adapter of REGISTERED_ADAPTERS) {
      expect(getByText(adapter.displayName)).toBeTruthy();
    }
  });
});

describe("MobileAppChoiceStep — selection writes state + emits the event", () => {
  it("picking MyFitnessPal sets appChoice and emits onboarding_app_choice {has_importer:true, platform:ios}", () => {
    const { getByText, getByTestId } = withProvider(
      <>
        <MobileAppChoiceStep />
        <ChoiceProbe />
      </>,
    );
    expect(getByTestId("app-choice").props.children).toBe("null");

    fireEvent.press(getByText("MyFitnessPal"));

    expect(getByTestId("app-choice").props.children).toBe("mfp");
    expect(trackMock).toHaveBeenCalledWith("onboarding_app_choice", {
      app: "mfp",
      has_importer: true,
      platform: "ios",
    });
  });

  it("picking 'I'm starting fresh' emits has_importer:false and app:none", () => {
    const { getByText, getByTestId } = withProvider(
      <>
        <MobileAppChoiceStep />
        <ChoiceProbe />
      </>,
    );
    fireEvent.press(getByText("I'm starting fresh"));
    expect(getByTestId("app-choice").props.children).toBe("none");
    expect(trackMock).toHaveBeenCalledWith("onboarding_app_choice", {
      app: "none",
      has_importer: false,
      platform: "ios",
    });
  });
});

describe("data-bridges importer pre-highlight (mobile) — ENG-990 hand-off", () => {
  it("leads the importer card with the chosen app's name when importable", () => {
    const { getByText } = withProvider(<MobileDataBridgesStep />, {
      ...DEFAULT_ONBOARDING_STATE,
      appChoice: "mfp",
    });
    expect(getByText("Bring your MyFitnessPal history")).toBeTruthy();
  });

  it("keeps generic importer copy when starting fresh", () => {
    const { getByText, queryByText } = withProvider(<MobileDataBridgesStep />, {
      ...DEFAULT_ONBOARDING_STATE,
      appChoice: "none",
    });
    expect(getByText("Import from another app")).toBeTruthy();
    expect(queryByText("Bring your MyFitnessPal history")).toBeNull();
  });
});
