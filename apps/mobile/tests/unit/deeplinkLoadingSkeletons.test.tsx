// @vitest-environment jsdom
/**
 * ENG-768 — deeplink cold-open skeleton parity (mobile).
 *
 * Two deeplink surfaces — Activity Bonus (`burn-detail`) and Shopping
 * (`shopping`) — replaced their raw centred `ActivityIndicator` +
 * "Loading…" steady-state with a skeleton silhouette of the loaded
 * layout, matching the Progress tab's tile treatment. The swap is gated
 * behind the `deeplink_skeletons` PostHog flag with the legacy spinner
 * alive in the `else`, so flag-OFF is byte-identical to pre-ENG-768.
 *
 * This test holds the supabase query open (never-resolves) so each screen
 * stays in its loading branch for the assertion window — the same
 * technique as `progressSkeletonFirstPaint.test.tsx` — and asserts, per
 * flag state:
 *   - flag ON  → the skeleton testID renders, the spinner caption does NOT
 *   - flag OFF → the spinner caption renders, the skeleton testID does NOT
 *
 * The flag is driven via `vi.mock("@/lib/analytics")` (the `@` prefix
 * alias shadows the analytics shim, so a per-file mock is the reliable
 * stub — same pattern as `todayLogUsualRowV2.test.tsx`).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { isFeatureEnabled } from "@/lib/analytics";
// `vi.mock` calls below are hoisted above these imports by vitest, so the
// screens pick up the stubbed supabase / auth / router / analytics.
import BurnDetailScreen from "../../app/burn-detail";
import ShoppingScreen from "../../app/shopping";

void React;

// --- Supabase mock: never resolves, so the load stays in flight and the
// screen holds its loading branch for the assertion window. ---
function pendingQuery() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ["select", "eq", "gte", "lte", "in", "is", "order", "maybeSingle"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then?: unknown }).then = (_onFulfilled: unknown) =>
    new Promise(() => {
      /* pending forever for the assertion window */
    });
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => pendingQuery()),
    channel: vi.fn(() => {
      const ch: Record<string, (...args: unknown[]) => unknown> = {};
      ch.on = vi.fn(() => ch);
      ch.subscribe = vi.fn(() => ch);
      return ch;
    }),
    removeChannel: vi.fn(),
  },
}));

// --- Auth: authed user so the load path runs (and doesn't short-circuit
// to the "Sign in" empty state on burn-detail). ---
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "test-user-id" } } }),
}));

// --- Theme colours: minimal palette the screens read. ---
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
    tint: "#3B2A4D",
    primaryForeground: "#fff",
    destructiveForeground: "#fff",
    tabIconDefault: "#999",
  }),
}));

// --- Accent palette + scheme. ---
vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primary: "#3B2A4D",
    primarySolid: "#3B2A4D",
    primarySoft: "#efe8f2",
    destructive: "#b3261e",
  }),
  // ENG-1527 — shopping card grammar now reads `useCardElevation`, which
  // resolves the scheme via `useTheme`.
  useTheme: () => ({ resolved: "light" }),
}));
vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// --- Safe-area insets. ---
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// --- Expo router (both screens use useRouter; shopping uses useFocusEffect). ---
vi.mock("expo-router", async () => {
  const ReactMod = await import("react");
  return {
    useRouter: () => ({ push: vi.fn(), navigate: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactMod.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === "function" ? cleanup : undefined;
      }, []);
    },
  };
});

// --- HealthKit sync: safe no-ops (burn-detail). ---
vi.mock("@/lib/healthSync", () => ({
  syncHealthDataThrottled: vi.fn(async () => undefined),
  isHealthSyncAvailable: () => false,
}));

// --- Safe-back hook (shopping). ---
vi.mock("@/hooks/use-safe-back", () => ({
  useSafeBack: () => vi.fn(),
}));

// --- Analytics: per-file mock so we can drive the flag value. ---
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

/** `useFocusEffect` / load effects schedule work after first paint; React
 *  logs a dev-only "not wrapped in act()" line. Filter only that noise. */
function withActNoiseFilter<T>(fn: () => T): T {
  const origErr = console.error.bind(console);
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const a0 = args[0];
    if (typeof a0 === "string" && a0.includes("not wrapped in act")) return;
    (origErr as (...a: unknown[]) => void)(...args);
  });
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe("ENG-768 — deeplink loading skeletons (deeplink_skeletons flag)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Activity Bonus / burn-detail", () => {
    it("flag OFF (default): renders the centred spinner, NOT the skeleton", () => {
      flagFn.mockImplementation(() => false);
      const { queryByTestId, getByText } = withActNoiseFilter(() =>
        render(<BurnDetailScreen />),
      );
      expect(getByText("Loading…")).toBeTruthy();
      expect(queryByTestId("burn-detail-loading-skeleton")).toBeNull();
    });

    it("flag ON: renders the skeleton, NOT the centred spinner", () => {
      flagFn.mockImplementation((flag: string) => flag === "deeplink_skeletons");
      const { getByTestId, queryByText } = withActNoiseFilter(() =>
        render(<BurnDetailScreen />),
      );
      expect(getByTestId("burn-detail-loading-skeleton")).toBeTruthy();
      expect(queryByText("Loading…")).toBeNull();
    });
  });

  describe("Shopping", () => {
    it("flag OFF (default): renders the spinner caption, NOT the skeleton", () => {
      flagFn.mockImplementation(() => false);
      const { queryByTestId, getByText } = withActNoiseFilter(() =>
        render(<ShoppingScreen />),
      );
      expect(getByText("Loading your shopping list…")).toBeTruthy();
      expect(queryByTestId("shopping-loading-skeleton")).toBeNull();
    });

    it("flag ON: renders the skeleton, NOT the spinner caption", () => {
      flagFn.mockImplementation((flag: string) => flag === "deeplink_skeletons");
      const { getByTestId, queryByText } = withActNoiseFilter(() =>
        render(<ShoppingScreen />),
      );
      expect(getByTestId("shopping-loading-skeleton")).toBeTruthy();
      expect(queryByText("Loading your shopping list…")).toBeNull();
    });
  });
});
