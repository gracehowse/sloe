// @vitest-environment jsdom
/**
 * Build-40 (2026-05-01) — mobile onboarding data-bridges step.
 *
 * Mirrors the web behaviour test. Verifies:
 *   1. Smoke render — the four cards mount without crashing under the
 *      mocked auth + theme + analytics environment.
 *   2. Manual targets — typing kcal / P / C / F + blurring writes to
 *      onboarding state and stamps dataBridgeChosen = "manual".
 *   3. Apple Health card renders on iOS (Platform.OS shim defaults to
 *      "ios" via the react-native shim).
 *   4. "Maybe later" — sets dataBridgeChosen = "skip".
 *
 * The HealthKit + notifications permission flows are NOT exercised
 * (Platform-native bridges that don't survive jsdom) — those paths
 * live behind the mocked `requestHealthPermissions` / `expo-notifications`
 * dynamic import.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

void React;

// Auth context — authed user so syncHealthData has a user id to call.
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    session: { user: { id: "test-user-id" } },
  }),
}));

// Theme colours.
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
  }),
}));

// HealthKit permissions — never granted in test env so the user-facing
// "Allow Health access" button stays present.
vi.mock("@/lib/healthSync", () => ({
  requestHealthPermissions: vi.fn(async () => ({
    ok: false,
    userMessage: "HealthKit unavailable in test env",
  })),
  syncHealthData: vi.fn(async () => ({})),
}));

vi.mock("@/lib/expoPushToken", () => ({
  registerExpoPushTokenForUser: vi.fn(async () => undefined),
  markNotificationsPromptDismissed: vi.fn(async () => undefined),
}));

// AsyncStorage shim already lives in the workspace; the provider's
// localStorage hydration short-circuits when `initial` is supplied.

import {
  OnboardingProvider,
  useOnboarding,
} from "../../components/onboarding/context";
import { MobileDataBridgesStep } from "../../components/onboarding/steps/data-bridges";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../../../src/lib/onboarding/state";

beforeEach(() => {
  try {
    if (typeof window !== "undefined") window.localStorage.clear();
  } catch {
    /* non-fatal */
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

function withProvider(
  ui: React.ReactNode,
  initial?: Partial<OnboardingState>,
) {
  const seed = initial ?? { ...DEFAULT_ONBOARDING_STATE };
  return render(
    <OnboardingProvider initial={seed}>{ui}</OnboardingProvider>,
  );
}

function StateProbe({ testID }: { testID: string }) {
  const { state } = useOnboarding();
  return (
    <RNText testID={testID}>
      {JSON.stringify({
        kcal: state.manualTargetsKcal,
        protein: state.manualTargetsProteinG,
        carbs: state.manualTargetsCarbsG,
        fat: state.manualTargetsFatG,
        chosen: state.dataBridgeChosen,
        notif: state.notifGranted,
        health: state.healthGranted,
      })}
    </RNText>
  );
}

describe("MobileDataBridgesStep — smoke render", () => {
  it("mounts the four cards (manual / health / notifications / recipe) on iOS without crashing", () => {
    const { getByText } = withProvider(<MobileDataBridgesStep />);
    expect(getByText("I already know my targets")).toBeTruthy();
    expect(getByText("Connect Apple Health")).toBeTruthy();
    expect(getByText("Gentle reminders")).toBeTruthy();
    expect(getByText("Try a recipe import")).toBeTruthy();
  });

  it("renders the 'Maybe later' opt-out", () => {
    const { getByText } = withProvider(<MobileDataBridgesStep />);
    expect(getByText("Maybe later")).toBeTruthy();
  });
});

describe("MobileDataBridgesStep — manual targets", () => {
  it("typing into all four inputs + blurring writes manualTargets* + sets dataBridgeChosen='manual'", () => {
    const { getByLabelText, getByTestId } = withProvider(
      <>
        <MobileDataBridgesStep />
        <StateProbe testID="probe" />
      </>,
    );
    const kcal = getByLabelText("Manual kcal target");
    const protein = getByLabelText("Manual P g target");
    const carbs = getByLabelText("Manual C g target");
    const fat = getByLabelText("Manual F g target");

    fireEvent.changeText(kcal, "1850");
    fireEvent.changeText(protein, "145");
    fireEvent.changeText(carbs, "175");
    fireEvent.changeText(fat, "60");
    fireEvent(fat, "blur");

    const probe = JSON.parse(getByTestId("probe").props.children as string);
    expect(probe.kcal).toBe(1850);
    expect(probe.protein).toBe(145);
    expect(probe.carbs).toBe(175);
    expect(probe.fat).toBe(60);
    expect(probe.chosen).toBe("manual");
  });

  it("kcal-only entry leaves the rest null but still flips dataBridgeChosen to 'manual'", () => {
    const { getByLabelText, getByTestId } = withProvider(
      <>
        <MobileDataBridgesStep />
        <StateProbe testID="probe" />
      </>,
    );
    const kcal = getByLabelText("Manual kcal target");
    fireEvent.changeText(kcal, "1800");
    fireEvent(kcal, "blur");
    const probe = JSON.parse(getByTestId("probe").props.children as string);
    expect(probe.kcal).toBe(1800);
    expect(probe.protein).toBeNull();
    expect(probe.carbs).toBeNull();
    expect(probe.fat).toBeNull();
    expect(probe.chosen).toBe("manual");
  });
});

describe("MobileDataBridgesStep — Maybe later", () => {
  it("tapping 'Maybe later' sets dataBridgeChosen='skip'", () => {
    const { getByText, getByTestId } = withProvider(
      <>
        <MobileDataBridgesStep />
        <StateProbe testID="probe" />
      </>,
    );
    const skip = getByText("Maybe later");
    fireEvent.press(skip);
    const probe = JSON.parse(getByTestId("probe").props.children as string);
    expect(probe.chosen).toBe("skip");
  });
});
