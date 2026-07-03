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
 *   5. Recipe import card (ENG-1304, 2026-07-03) exposes real import
 *      affordances (URL input, import button, sample link) — the card
 *      now calls the real pipeline instead of the earlier
 *      "try after setup" preview stub.
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
} from "@suppr/shared/onboarding/state";

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

// 2026-05-02 — `data-bridges` now mounts `MobileMfpCsvImportCard`,
// which transitively imports `@/lib/authedFetch` -> `@/lib/supabase`.
// The supabase client validates its URL at construction; without a
// stub the module-level `createClient` call throws under vitest.
vi.mock("@/lib/authedFetch", () => ({
  authedFetch: vi.fn(async () => new Response(JSON.stringify({ ok: false }))),
}));
vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => "https://suppr-club.com",
  getSupprWebBase: () => "https://suppr-club.com",
}));
// ENG-1304 — OnboardingRecipeImportCard imports `@/lib/saveImportedRecipe`,
// which imports `@/lib/supabase` at module scope; that client validates its
// URL at construction, so without a stub it throws under vitest.
vi.mock("@/lib/saveImportedRecipe", () => ({
  saveImportedRecipe: vi.fn(async () => ({ error: "not exercised in this test" })),
  updateImportedRecipe: vi.fn(async () => ({ error: "not exercised in this test" })),
  coercePositiveMinutes: (n: unknown) => (typeof n === "number" && n > 0 ? n : null),
}));

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
    expect(getByText("Recipe import")).toBeTruthy();
  });

  it("P1 (2026-05-11): no in-body 'Maybe later' link — footer 'Build my plan' is the single forward action", () => {
    const { queryByText } = withProvider(<MobileDataBridgesStep />);
    expect(queryByText("Maybe later")).toBeNull();
    expect(queryByText("Skipped")).toBeNull();
  });
});

describe("MobileDataBridgesStep — recipe import card (ENG-1304)", () => {
  it("exposes real import affordances — URL input, import button, sample link", () => {
    const { getByLabelText, getByText } = withProvider(
      <MobileDataBridgesStep />,
    );
    expect(getByLabelText("Recipe URL")).toBeTruthy();
    expect(getByText("Paste a link to import")).toBeTruthy();
    expect(getByText("Try a sample recipe")).toBeTruthy();
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

// P1 (customer-lens 2026-05-11): the in-body "Maybe later" link was
// removed because it competed with the footer "Build my plan" CTA.
// The `data-bridges` step now relies on the footer for forward motion.
// `canAdvance("data-bridges")` returns true unconditionally so the
// footer is always enabled. The "skip" path is reported via
// `onboarding_completed.data_bridge_chosen: null` (see mobile-flow.tsx).
