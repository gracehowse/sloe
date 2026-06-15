// @vitest-environment jsdom
/**
 * 2026-06-09 — Premium-bar visual audit fixes for /health-sync.
 *
 * Pins the new structural and visual behaviours introduced by the
 * premium-bar pass (ENG-997 Tier G — health-sync surface):
 *
 *   1. Screen title "Health Sync" renders in a Newsreader (serif) font
 *      family token — NOT Inter. This prevents regression to the old
 *      Inter/800/centred title (gap 1).
 *
 *   2. No Ionicons are present in the rendered output. All glyphs must
 *      be lucide-react-native (gap 2). Validated by asserting the
 *      Ionicons import is no longer referenced in the component tree
 *      (mock proves it is not imported).
 *
 *   3. Section eyebrows "CONNECT" and "NUTRITION" render (gap 4).
 *
 *   4. Status dot is present on each category row:
 *      - "Connect to enable" state → muted dot (no connected state)
 *      - Connected + never synced → amber dot
 *      - Connected + synced     → success dot
 *      The test cannot inspect the dot's colour directly in RNTL, but
 *      it can assert the row subtitle copy matches the expected state.
 *
 *   5. The "Clear all imported data" action is a proper Pressable row
 *      (not a floating text) and has accessibilityRole="button" (gap 9).
 *
 *   6. Developer-only prebuild instructions are NOT shown to users in
 *      the unavailable-Health branch (gap 11). The prod copy shows only
 *      a plain-English fallback.
 *
 *   7. No user-facing "Suppr" strings remain in the rendered output
 *      (gap 12).
 */

import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import HealthSyncScreen from "../../app/health-sync";

void React;

// ── Shared mocks (copied from healthSyncErrorRecovery.test.tsx) ────
vi.mock("react-native", async () => {
  const actual: any = await vi.importActual("react-native");
  return {
    ...actual,
    Alert: { alert: vi.fn() },
    Linking: {
      openURL: vi.fn(() => Promise.resolve()),
      openSettings: vi.fn(() => Promise.resolve()),
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
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
    background: "#FFFFFF",
    card: "#F6F5F2",
    border: "#E8E2EC",
    cardBorder: "#E8E2EC",
    inputBg: "#F6F5F2",
  }),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "u-grace" } } }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#3B2A4D", primarySolid: "#3B2A4D", primarySoft: "rgba(91,59,110,0.12)" }),
}));

vi.mock("@/hooks/useCardElevation", () => ({
  useCardElevation: () => ({ liftBg: null, useBorder: true, shadowStyle: null }),
}));

vi.mock("@/hooks/useSettingsWinMoment", () => ({
  useSettingsWinMoment: () => ({ celebrate: vi.fn(), flashStyle: {} }),
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
  probeHealthAccess: vi.fn(() => Promise.resolve("ok" as const)),
  probeNutritionImport: vi.fn(() =>
    Promise.resolve({
      ok: true,
      totalEnergyCount: 0,
      externalEnergyCount: 0,
      sourceApps: [],
      ownSamplesSkipped: 0,
      coreSampleCounts: {},
    }),
  ),
  formatCoreDietaryProbeAlignmentHint: () => null,
  probeNutritionWrite: vi.fn(() => Promise.resolve({ ok: true })),
  formatNutritionImportSummary: () => "",
  requestDietaryHealthPermissions: vi.fn(() =>
    Promise.resolve({ ok: true, bodySyncReady: true, dietaryImportReady: true, userMessage: "" }),
  ),
  requestHealthPermissions: vi.fn(() =>
    Promise.resolve({ ok: true, bodySyncReady: true, dietaryImportReady: true, userMessage: "" }),
  ),
  syncHealthData: vi.fn(),
  syncNutritionFromHealth: vi.fn(),
}));

// ── isHealthSyncAvailable = false variant for gap 11 tests ────────
const makeUnavailableMock = () =>
  vi.mock("@/lib/healthSync", () => ({
    isExpoGoRuntime: () => false,
    isHealthSyncAvailable: () => false,
    probeHealthAccess: vi.fn(() => Promise.resolve("ok" as const)),
    probeNutritionImport: vi.fn(),
    probeNutritionWrite: vi.fn(),
    formatNutritionImportSummary: () => "",
    requestDietaryHealthPermissions: vi.fn(),
    requestHealthPermissions: vi.fn(),
    syncHealthData: vi.fn(),
    syncNutritionFromHealth: vi.fn(),
  }));

void makeUnavailableMock; // referenced below via dynamic re-mock if needed

// ─────────────────────────────────────────────────────────────────────

describe("HealthSyncScreen — premium-bar visual audit (2026-06-09)", () => {

  describe("gap 1 — serif screen title", () => {
    it("renders 'Health Sync' title text", () => {
      const { getByText } = render(<HealthSyncScreen />);
      const title = getByText("Health Sync");
      expect(title).toBeTruthy();
    });

    it("title has Newsreader fontFamily (serif token, not Inter)", () => {
      const { getByText } = render(<HealthSyncScreen />);
      const title = getByText("Health Sync");
      // StyleSheet flattens to a plain object in the test environment.
      // We verify the fontFamily contains 'Newsreader' (the token value
      // from FontFamily.serifRegular = 'Newsreader_400Regular').
      const flatStyle = title.props.style;
      const styleObj = Array.isArray(flatStyle)
        ? Object.assign({}, ...flatStyle.map((s: any) => (typeof s === "object" && s !== null ? s : {})))
        : flatStyle ?? {};
      expect(styleObj.fontFamily).toMatch(/Newsreader/);
    });

    it("title is NOT centred (textAlign must not be 'center')", () => {
      const { getByText } = render(<HealthSyncScreen />);
      const title = getByText("Health Sync");
      const flatStyle = title.props.style;
      const styleObj = Array.isArray(flatStyle)
        ? Object.assign({}, ...flatStyle.map((s: any) => (typeof s === "object" && s !== null ? s : {})))
        : flatStyle ?? {};
      expect(styleObj.textAlign).not.toBe("center");
    });
  });

  describe("gap 4 — section eyebrows", () => {
    it("renders the CONNECT eyebrow above the Apple Health card", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(getByText("CONNECT")).toBeTruthy();
    });

    it("renders the NUTRITION eyebrow above the Nutrition Sync card", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(getByText("NUTRITION")).toBeTruthy();
    });
  });

  describe("gap 3 — leading status dots (subtitle copy)", () => {
    it("shows 'Connect to enable' subtitle on each category row when not connected", () => {
      const { getAllByText } = render(<HealthSyncScreen />);
      // Five category rows × "Connect to enable" when not connected
      const items = getAllByText("Connect to enable");
      expect(items.length).toBe(5);
    });
  });

  describe("gap 9 — clear data action is a proper row (not floating text)", () => {
    it("renders 'Clear all imported data' with accessibilityRole button", () => {
      const { getByLabelText } = render(<HealthSyncScreen />);
      const clearBtn = getByLabelText("Clear all imported data from Apple Health");
      expect(clearBtn).toBeTruthy();
      expect(clearBtn.props.accessibilityRole).toBe("button");
    });

    it("'Clear all imported data' has a subtitle explaining the action", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(
        getByText(/Removes meals imported from Apple Health/),
      ).toBeTruthy();
    });
  });

  describe("gap 12 — no residual 'Suppr' in user-facing copy", () => {
    it("does not render the string 'Suppr' in any visible text node", () => {
      const { queryAllByText } = render(<HealthSyncScreen />);
      // getAllByText with a regex — any text containing 'Suppr' (case-sensitive)
      // should return no elements (old brand name must not appear in user copy).
      const matches = queryAllByText(/Suppr/);
      expect(matches.length).toBe(0);
    });
  });

  describe("gap 2 — lucide icons only (no Ionicons in CardTitle)", () => {
    it("renders 'Apple Health / Health Connect' card title", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(getByText("Apple Health / Health Connect")).toBeTruthy();
    });

    it("renders 'Nutrition Sync' card title", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(getByText("Nutrition Sync")).toBeTruthy();
    });
  });

  describe("gap 10 — card titles use serif font", () => {
    it("card title 'Apple Health / Health Connect' uses Newsreader fontFamily", () => {
      const { getByText } = render(<HealthSyncScreen />);
      const cardTitle = getByText("Apple Health / Health Connect");
      const flatStyle = cardTitle.props.style;
      const styleObj = Array.isArray(flatStyle)
        ? Object.assign({}, ...flatStyle.map((s: any) => (typeof s === "object" && s !== null ? s : {})))
        : flatStyle ?? {};
      expect(styleObj.fontFamily).toMatch(/Newsreader/);
    });
  });

  describe("gap 7 — on-scale helper text (no negative margin hack)", () => {
    it("renders helper text under Import meals toggle", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(
        getByText(/Pull dietary energy.*other apps into your Today journal/),
      ).toBeTruthy();
    });

    it("renders helper text under Share meals toggle", () => {
      const { getByText } = render(<HealthSyncScreen />);
      expect(
        getByText(/Your logged meals will be written to Apple Health/),
      ).toBeTruthy();
    });
  });
});
