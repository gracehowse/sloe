// @vitest-environment jsdom
/**
 * ENG-1297(b) — RN LogBox "Text strings must be rendered within a <Text>
 * component" fired on Settings first open (sweep 2026-07-01,
 * settings-logbox-error.png). This mounts the REAL SettingsBundleContent
 * (infra mocked, child components real) with a free-tier data-rich persona
 * and walks the rendered host tree: any string/number child of a non-Text
 * host is exactly the render RN throws on in production.
 *
 * Walker rule: React Native only accepts text under <Text> (host "Text").
 * "TextInput" carries text via props, never children. Everything else —
 * View / Modal / RCTScrollView / ActivityIndicator / Image — must have zero
 * string or number children (including "" and 0, which RN also throws on).
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Infra mocks (children stay real so the walker sees the whole tree) ──
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@react-navigation/native", () => ({
  // Focus-run the callback like the real hook does on screen focus, so the
  // first-open data loads actually execute.
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(() => cb(), [cb]);
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0", ios: { buildNumber: "99" } } },
}));
vi.mock("@/lib/purchases", () => ({ presentCustomerCenter: vi.fn() }));
vi.mock("@/lib/healthSync", () => ({
  probeHealthAccess: vi.fn(async () => "unavailable" as const),
}));
vi.mock("@/lib/exportEverything", () => ({
  exportEverythingToFile: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/supprWeb", () => ({ getSupprWebBase: () => "https://getsloe.com" }));
// `@/lib/weeklyRecapPush` statically imports `expo-notifications`, whose
// bare-`expo` entry (winter runtime) doesn't load under vitest.
vi.mock("@/lib/weeklyRecapPush", () => ({
  cancelWeeklyRecapPush: vi.fn(async () => {}),
  scheduleWeeklyRecapPush: vi.fn(async () => ({ ok: true })),
}));
// `lucide-react-native`'s `Package` export doesn't resolve under
// vite-node (fine under Metro). Icons are leaf SVGs that can never carry
// text children, so a Proxy of View-forwarding stubs is walker-equivalent.
vi.mock("lucide-react-native", () => {
  const cache = new Map<string, unknown>();
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "__esModule") return true;
        if (!cache.has(prop)) {
          // String host type — react-test-renderer treats it as a leaf
          // host element, no react-native import needed inside the
          // hoisted factory (a raw `require("react-native")` here would
          // bypass the alias table and load the real Flow source).
          const Stub = (props: Record<string, unknown>) =>
            React.createElement("View", { ...props, testID: `icon-${prop}` });
          Stub.displayName = prop;
          cache.set(prop, Stub);
        }
        return cache.get(prop);
      },
    },
  );
});
// `usePromoCode` lazy-`require`s `@/lib/supabase` at runtime, which
// bypasses both the alias table and `vi.mock` under vitest.
vi.mock("@/hooks/usePromoCode", () => ({
  usePromoCode: () => ({
    code: "",
    setCode: vi.fn(),
    submitting: false,
    redeem: vi.fn(async () => ({ ok: false })),
  }),
}));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  // All flags ON — matches the solo-tester posture and exercises the v3
  // (widest) render paths, the same surface the sweep captured.
  isFeatureEnabled: () => true,
}));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    session: {
      user: { id: "test-user-id", email: "gracehowse+test@outlook.com" },
      access_token: "test-token",
    },
  }),
}));

const PALETTE = {
  background: "#FFFFFF",
  card: "#F6F5F2",
  cardBorder: "#E8E5E0",
  border: "#E8E5E0",
  inputBg: "#EFEDE8",
  text: "#221B26",
  textSecondary: "#6B6470",
  textTertiary: "#9B93A3",
  tint: "#5B3B6E",
  navPrimary: "#3B2A4D",
};
vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primary: "#5B3B6E",
    primaryLight: "#7B5B8E",
    primarySolid: "#4A2B5E",
    primaryForeground: "#FFFFFF",
    success: "#5E7C5A",
    successSolid: "#466046",
    cyanSolid: "#3C5F6B",
  }),
  useTheme: () => ({
    colors: PALETTE,
    preference: "system",
    setPreference: vi.fn(),
  }),
  useResolvedScheme: () => "light",
}));

// ── Supabase chain harness (pattern: weeklyRecapScreen.test.tsx) ──
// Free-tier, data-rich persona mirroring the sweep account: 13 saved
// recipes, populated targets, no entries today.
const PROFILE_ROW = {
  id: "test-user-id",
  user_tier: "free",
  display_name: "gracehowse+test",
  measurement_system: "metric",
  sex: "female",
  target_calories: 1900,
  target_protein: 145,
  target_carbs: 175,
  target_fat: 63,
  target_fiber_g: 28,
  target_water_ml: 2000,
  weight_kg: 65,
  week_start_day: "monday",
  meal_plan_slots: null,
  pantry_staples: null,
  tz_iana: "Europe/London",
};

function chain(result: { data: unknown; error: unknown; count?: number | null }) {
  const c: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "gte",
    "lte",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "maybeSingle",
    "single",
    "update",
    "upsert",
    "insert",
    "delete",
  ];
  for (const m of methods) c[m] = vi.fn(() => c);
  (c as { then?: unknown }).then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return c;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return chain({ data: PROFILE_ROW, error: null });
      }
      if (table === "saves") {
        return chain({ data: [], error: null, count: 13 });
      }
      return chain({ data: [], error: null, count: 0 });
    }),
    auth: {
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      getUser: vi.fn(async () => ({
        data: { user: { id: "test-user-id" } },
        error: null,
      })),
    },
  },
}));

import { SettingsBundleContent } from "../../components/settings/SettingsBundleContent";

// ── Host-tree walker ─────────────────────────────────────────────────
type JsonNode =
  | string
  | number
  | { type: string; children: JsonNode[] | null; props?: Record<string, unknown> };

function findStrayText(
  node: JsonNode | JsonNode[] | null,
  ancestors: string[],
  out: string[],
): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const child of node) findStrayText(child, ancestors, out);
    return;
  }
  if (typeof node === "string" || typeof node === "number") {
    const host = ancestors[ancestors.length - 1];
    if (host !== "Text") {
      out.push(
        `string/number child ${JSON.stringify(String(node).slice(0, 60))} under <${host}> (path: ${ancestors.join(" > ")})`,
      );
    }
    return;
  }
  // Below a Text host everything is legal (nested Text, strings).
  if (node.type === "Text") {
    return;
  }
  findStrayText(node.children, [...ancestors, node.type], out);
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("ENG-1297(b) — Settings bundle renders no text outside <Text>", () => {
  it("first-open render (free data-rich persona, all flags on) has no stray text nodes", async () => {
    const view = render(<SettingsBundleContent context="settings" />);
    // Let the focus-run data loads resolve and re-render.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const tree = view.toJSON() as JsonNode | JsonNode[] | null;
    const findings: string[] = [];
    findStrayText(tree, ["root"], findings);
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
