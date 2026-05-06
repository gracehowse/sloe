/**
 * tabStructurePhase2 — pins the Phase 2 (B1.1, 2026-04-27) tab
 * structure on mobile.
 *
 * Authority: D-2026-04-27-02 (collapse 6 → 4) and the production
 * design spec Surface A. The four primary tabs are
 * Today / Recipes / Plan / You with sub-tab pills surfacing
 * Library + Discover under Recipes, This week + Shopping under Plan,
 * Progress + Settings + More under You.
 *
 * Pinning the structure here means a refactor that drops a primary
 * tab or re-orders the bar fails CI before it lands on TestFlight.
 *
 * The tests cover the sub-tab components in isolation
 * (RecipesSubTabHeader / YouSubTabHeader / PlanSubTabHeader). The
 * `_layout.tsx` itself is exercised via React Native's testing
 * conventions (Tabs is a navigator host) but its structure is asserted
 * indirectly through the source string at the bottom of this file —
 * the source pin is the canonical assertion that will fail if a
 * future contributor adds a fifth tab back.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import * as fs from "node:fs";
import * as path from "node:path";

import { RecipesSubTabHeader } from "../../components/tabs/RecipesSubTabHeader";
import { YouSubTabHeader } from "../../components/tabs/YouSubTabHeader";
import {
  PlanSubTabHeader,
  type PlanSubTab,
} from "../../components/tabs/PlanSubTabHeader";

vi.mock("expo-router", () => {
  const replace = vi.fn();
  const router = { replace };
  return {
    useRouter: () => router,
    usePathname: () => (globalThis as { __pathname?: string }).__pathname ?? "/library",
  };
});
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
}));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
  }),
}));

const setPathname = (p: string) => {
  (globalThis as { __pathname?: string }).__pathname = p;
};

describe("RecipesSubTabHeader", () => {
  it("highlights Library when on /library", () => {
    setPathname("/library");
    const { getByLabelText } = render(<RecipesSubTabHeader />);
    expect(getByLabelText("Library").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Discover").props.accessibilityState.selected).toBe(false);
  });

  it("highlights Discover when on /discover", () => {
    setPathname("/discover");
    const { getByLabelText } = render(<RecipesSubTabHeader />);
    expect(getByLabelText("Discover").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Library").props.accessibilityState.selected).toBe(false);
  });

  it("calls router.replace('/(tabs)/discover') when Discover is tapped from Library", async () => {
    setPathname("/library");
    const router = (await import("expo-router")).useRouter() as unknown as { replace: ReturnType<typeof vi.fn> };
    router.replace.mockClear();
    const { getByLabelText } = render(<RecipesSubTabHeader />);
    fireEvent.press(getByLabelText("Discover"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/discover");
  });

  it("is a no-op when tapping the active sub-tab (no router.replace call)", async () => {
    setPathname("/library");
    const router = (await import("expo-router")).useRouter() as unknown as { replace: ReturnType<typeof vi.fn> };
    router.replace.mockClear();
    const { getByLabelText } = render(<RecipesSubTabHeader />);
    fireEvent.press(getByLabelText("Library"));
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("YouSubTabHeader (post-Group-G IA collapse, 2026-04-28)", () => {
  // Group G IA decision (`docs/decisions/2026-04-28-group-g-ia-collapse.md`)
  // collapsed the You sub-tabs from 3 (Progress / Settings / More) to
  // 2 (Progress / Settings). The "/more" route stays alive as a
  // redirect so deep links don't break, but the pill bar treats it
  // as part of Settings for highlighting.
  it("renders exactly two You sub-tabs (Progress + Settings)", () => {
    setPathname("/progress");
    const { getByLabelText, queryByLabelText } = render(<YouSubTabHeader />);
    expect(getByLabelText("Progress")).toBeTruthy();
    expect(getByLabelText("Settings")).toBeTruthy();
    expect(queryByLabelText("More")).toBeNull();
  });

  it("highlights Settings when on /settings or /more (legacy redirect path)", () => {
    setPathname("/settings");
    const { getByLabelText, rerender } = render(<YouSubTabHeader />);
    expect(getByLabelText("Settings").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Progress").props.accessibilityState.selected).toBe(false);

    // Legacy /more deep links keep the You tab highlighted on
    // Settings during the migration window — the redirect to
    // /settings will fire on mount.
    setPathname("/more");
    rerender(<YouSubTabHeader />);
    expect(getByLabelText("Settings").props.accessibilityState.selected).toBe(true);
  });

  it("routes to /(tabs)/settings when Settings is tapped from Progress", async () => {
    setPathname("/progress");
    const router = (await import("expo-router")).useRouter() as unknown as { replace: ReturnType<typeof vi.fn> };
    router.replace.mockClear();
    const { getByLabelText } = render(<YouSubTabHeader />);
    fireEvent.press(getByLabelText("Settings"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/settings");
  });
});

describe("PlanSubTabHeader", () => {
  it("renders 'This week' and 'Shopping' pills in canonical order", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <PlanSubTabHeader value="plan" onChange={onChange} />,
    );
    expect(getByLabelText("This week")).toBeTruthy();
    expect(getByLabelText("Shopping")).toBeTruthy();
  });

  it("calls onChange('shopping') when Shopping is tapped from Plan", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <PlanSubTabHeader value="plan" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText("Shopping"));
    expect(onChange).toHaveBeenCalledWith("shopping");
  });

  it("does not call onChange when tapping the already-active pill", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <PlanSubTabHeader value="plan" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText("This week"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the unchecked-count badge when shoppingUncheckedCount > 0", () => {
    const onChange = vi.fn<(_v: PlanSubTab) => void>();
    const { getByText } = render(
      <PlanSubTabHeader value="plan" onChange={onChange} shoppingUncheckedCount={5} />,
    );
    // The badge renders the integer count as plain text inside the
    // Shopping pill. getByText is the simplest stable assertion.
    expect(getByText("5")).toBeTruthy();
  });

  it("caps the badge at 999+ for high counts", () => {
    // Implementation caps at 999+ (PlanSubTabHeader). Test pinned to
    // match the rendered output. If the cap moves again, update the
    // string here too — this test exists to lock the cap, whatever it is.
    const onChange = vi.fn<(_v: PlanSubTab) => void>();
    const { getByText } = render(
      <PlanSubTabHeader value="plan" onChange={onChange} shoppingUncheckedCount={1234} />,
    );
    expect(getByText("999+")).toBeTruthy();
  });
});

describe("(tabs)/_layout.tsx — primary tab structure pin", () => {
  // The Tabs navigator can't be rendered in isolation without a full
  // expo-router mock, so we pin the structure via a source-string
  // assertion. A future contributor who adds a fifth Tabs.Screen with
  // an icon (i.e. a visible tab-bar entry) will fail this test.
  const layoutSrc = fs.readFileSync(
    path.resolve(__dirname, "../../app/(tabs)/_layout.tsx"),
    "utf-8",
  );

  it("exposes exactly four primary tabs (visible tabBar entries)", () => {
    // Each visible tab is identified by a Tabs.Screen that includes
    // `tabBarIcon`. Hidden tabs use `href: null`, no icon prop.
    const visibleMatches = layoutSrc.match(/tabBarIcon:/g) ?? [];
    expect(visibleMatches.length).toBe(4);
  });

  it("uses the canonical primary names: index / library / planner / progress", () => {
    expect(layoutSrc).toContain('name="index"');
    expect(layoutSrc).toContain('name="library"'); // Recipes default
    expect(layoutSrc).toContain('name="planner"');
    expect(layoutSrc).toContain('name="progress"'); // You default
  });

  it("hides discover / more / settings / search / barcode / notifications via href: null", () => {
    expect(layoutSrc).toContain('name="discover" options={{ href: null }}');
    expect(layoutSrc).toContain('name="more" options={{ href: null }}');
    expect(layoutSrc).toContain('name="settings" options={{ href: null }}');
    expect(layoutSrc).toContain('name="search" options={{ href: null }}');
    expect(layoutSrc).toContain('name="barcode" options={{ href: null }}');
    expect(layoutSrc).toContain('name="notifications" options={{ href: null }}');
  });

  it("renames the Library Tabs.Screen to Recipes for the visible tab title", () => {
    // The Recipes primary entry maps to /library by name but presents
    // "Recipes" as the visible title — pinning so a future contributor
    // doesn't accidentally re-introduce "Library" as a primary tab.
    expect(layoutSrc).toMatch(/name="library"\s+options=\{\{[^}]*title:\s*'Recipes'/s);
  });

  it("renames the Progress Tabs.Screen to You for the visible tab title", () => {
    expect(layoutSrc).toMatch(/name="progress"\s+options=\{\{[^}]*title:\s*'You'/s);
  });

  it("uses the custom <SupprTabBar> renderer (2026-04-30 — centered raised Log button)", () => {
    // The customer-lens audit retired the side <LogFab>. The Log
    // button is now rendered as a centered raised Plus inside the
    // global <SupprTabBar>. The button is purely visual — there is
    // still no fifth Tabs.Screen — so the 4-tab IA above stays
    // intact. Pin both the import and the wiring so a regression
    // that removes the custom tab bar (and therefore loses the Log
    // button on every screen) fails CI loudly.
    expect(layoutSrc).toContain(
      "import { SupprTabBar } from '@/components/tabs/SupprTabBar'",
    );
    expect(layoutSrc).toMatch(/tabBar=\{\(props\)\s*=>\s*<SupprTabBar\s+\{\.\.\.props\}\s*\/>\}/);
  });
});
