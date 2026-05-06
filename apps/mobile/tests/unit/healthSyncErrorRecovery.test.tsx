// @vitest-environment jsdom
/**
 * F-57 Build 41 (2026-05-01) — Apple Health error-recovery affordances.
 *
 * Background: Grace re-flagged "same apple health error message" on
 * TestFlight `ALlGgnDVP-rzqUojRWknayY` (2026-04-23). Previously a
 * connect/sync failure left the user with only a dismissed Alert + a
 * one-line "Sync failed" text — no recovery path. This test pins the
 * persistent error banner that now renders on failure with two
 * affordances: "Try again" and "Open iOS Settings".
 *
 * What's pinned:
 *   1. Banner does NOT render on first paint (clean state).
 *   2. After a failed connect, the banner renders with both
 *      `health-sync-error-retry` and `health-sync-error-open-settings`
 *      testIDs.
 *   3. Tapping "Open iOS Settings" calls `Linking.openURL("app-settings:")`
 *      (deep-link to Settings → Suppr → Health, NOT just Health.app).
 *   4. Tapping "Try again" re-runs the failed flow.
 */

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import HealthSyncScreen from "../../app/health-sync";

void React;

// ── Hoisted mock spies ─────────────────────────────────────────────
const {
  openURLSpy,
  openSettingsSpy,
  requestHealthPermissionsSpy,
  syncHealthDataSpy,
  syncNutritionFromHealthSpy,
  probeHealthAccessSpy,
} = vi.hoisted(() => {
  return {
    openURLSpy: vi.fn(() => Promise.resolve()),
    openSettingsSpy: vi.fn(() => Promise.resolve()),
    requestHealthPermissionsSpy: vi.fn(),
    syncHealthDataSpy: vi.fn(),
    syncNutritionFromHealthSpy: vi.fn(),
    probeHealthAccessSpy: vi.fn(() => Promise.resolve("ok" as const)),
  };
});

vi.mock("react-native", async () => {
  const actual: any = await vi.importActual("react-native");
  return {
    ...actual,
    Alert: { alert: vi.fn() },
    Linking: {
      openURL: openURLSpy,
      openSettings: openSettingsSpy,
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      getInitialURL: vi.fn(() => Promise.resolve(null)),
    },
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: any) => {
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, []);
  },
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));

vi.mock("@/hooks/use-safe-back", () => ({
  useSafeBack: () => vi.fn(),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    border: "#eee",
    cardBorder: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "u-grace" } } }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      delete: () => ({
        eq: () => ({ eq: () => Promise.resolve({ error: null, count: 0 }) }),
      }),
    }),
  },
}));

vi.mock("@/lib/healthSync", () => ({
  isExpoGoRuntime: () => false,
  isHealthSyncAvailable: () => true,
  probeHealthAccess: probeHealthAccessSpy,
  requestDietaryHealthPermissions: vi.fn(() =>
    Promise.resolve({ dietaryImportReady: true, userMessage: "" }),
  ),
  requestHealthPermissions: requestHealthPermissionsSpy,
  syncHealthData: syncHealthDataSpy,
  syncNutritionFromHealth: syncNutritionFromHealthSpy,
}));

beforeEach(() => {
  openURLSpy.mockClear();
  openSettingsSpy.mockClear();
  requestHealthPermissionsSpy.mockReset();
  syncHealthDataSpy.mockReset();
  syncNutritionFromHealthSpy.mockReset();
  probeHealthAccessSpy.mockReset();
  probeHealthAccessSpy.mockResolvedValue("ok");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HealthSyncScreen — error recovery affordances (F-57 Build 41)", () => {
  it("does not render the error banner on first paint (clean state)", () => {
    const { queryByTestId } = render(<HealthSyncScreen />);
    expect(queryByTestId("health-sync-error-banner")).toBeNull();
    expect(queryByTestId("health-sync-error-retry")).toBeNull();
    expect(queryByTestId("health-sync-error-open-settings")).toBeNull();
  });

  it("shows the banner with retry + Open Settings buttons after a failed connect", async () => {
    requestHealthPermissionsSpy.mockResolvedValue({
      ok: false,
      dietaryImportReady: false,
      userMessage: "Permission denied for dietary data",
      debugDetail: null,
    });
    const { getByText, findByTestId } = render(<HealthSyncScreen />);

    await act(async () => {
      fireEvent.press(getByText("Connect Health Data"));
    });

    const banner = await findByTestId("health-sync-error-banner");
    expect(banner).toBeTruthy();
    const retry = await findByTestId("health-sync-error-retry");
    const openSettings = await findByTestId("health-sync-error-open-settings");
    expect(retry).toBeTruthy();
    expect(openSettings).toBeTruthy();
  });

  it("Open iOS Settings button deep-links via Linking.openURL('app-settings:')", async () => {
    requestHealthPermissionsSpy.mockResolvedValue({
      ok: false,
      dietaryImportReady: false,
      userMessage: "Permission denied",
      debugDetail: null,
    });
    const { getByText, findByTestId } = render(<HealthSyncScreen />);

    await act(async () => {
      fireEvent.press(getByText("Connect Health Data"));
    });

    const openSettings = await findByTestId("health-sync-error-open-settings");
    await act(async () => {
      fireEvent.press(openSettings);
    });

    await waitFor(() => {
      expect(openURLSpy).toHaveBeenCalledWith("app-settings:");
    });
  });

  it("Try again re-invokes the failed connect flow", async () => {
    requestHealthPermissionsSpy.mockResolvedValue({
      ok: false,
      dietaryImportReady: false,
      userMessage: "Permission denied",
      debugDetail: null,
    });
    const { getByText, findByTestId } = render(<HealthSyncScreen />);

    await act(async () => {
      fireEvent.press(getByText("Connect Health Data"));
    });

    const retry = await findByTestId("health-sync-error-retry");
    expect(requestHealthPermissionsSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(retry);
    });

    await waitFor(() => {
      expect(requestHealthPermissionsSpy).toHaveBeenCalledTimes(2);
    });
  });
});
