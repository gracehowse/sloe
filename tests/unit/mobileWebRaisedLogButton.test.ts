/**
 * mobileWebRaisedLogButton — pins the centered raised Plus button
 * pattern in the mobile-web `<nav>` (App.tsx) that replaces the side
 * `<LogFab>` (right:18 / bottom:100) on mobile-web.
 *
 * Authority: parity with mobile commit `6633d2d` (2026-04-30) which
 * shipped `<SupprTabBar>` + `<LogTabBarButton>` to replace the side
 * FAB on iOS. The 4-tab IA from D-2026-04-27-02 is preserved — the
 * raised button is purely a UI element, not a 5th view.
 *
 * Constraints:
 *   - Mobile-web only (the host `<nav>` is `md:hidden`); desktop
 *     keeps the sidebar with no FAB per D-2026-04-27-11.
 *   - The button sits between the Recipes tab (visible-index 1) and
 *     the Plan tab (visible-index 2), mirroring the mobile slot.
 *   - Tap stamps `?openLog=1` on the URL and routes to
 *     `view=today`; `<NutritionTracker>` consumes the param via
 *     `useSearchParams` and opens the canonical `<LogSheet>`.
 *   - The Lucide `Plus` glyph is used directly (web uses
 *     `lucide-react`, not the React Native variant).
 *   - The legacy `<LogFab>` JSX render is gone from
 *     `NutritionTracker.tsx` (component file is preserved for
 *     deferred deletion; deferring the file keeps existing
 *     `tests/unit/logFab.test.tsx` resolving until a follow-up
 *     sweep removes both).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(REPO, rel), "utf8");

describe("mobile-web raised Log button — App.tsx", () => {
  const APP = read("src/app/App.tsx");

  it("imports the Lucide Plus icon directly (web uses lucide-react)", () => {
    // The web equivalent of lucide-react-native. The mobile reference
    // (`apps/mobile/components/tabs/LogTabBarButton.tsx`) imports
    // `Plus` from `lucide-react-native`; the web port must import
    // the same glyph from `lucide-react`. SLOE (2026-06-07): the import
    // now also pulls the Sloe tab glyph set (Sun / BookOpen /
    // CalendarDays / LineChart) so the import line is matched loosely on
    // `Plus` being present in a `lucide-react` import, not as the sole
    // named import.
    expect(APP).toMatch(/import \{[^}]*\bPlus\b[^}]*\} from "lucide-react"/);
  });

  it("imports React.Fragment for the inline 5-slot tab map", () => {
    // The map renders `<Fragment><tab/>{maybeRaisedButton}</Fragment>`
    // so the raised button can be injected after a tab without
    // wrapping each slot in a non-flex `<div>` that would break the
    // equal-width layout.
    expect(APP).toMatch(/import \{ Fragment,/);
  });

  it("renders the raised button with aria-label='Log a meal'", () => {
    // Mirrors the mobile `<LogTabBarButton>` accessibility label and
    // the legacy `<LogFab>` accessibility label so screen-reader
    // users see no behaviour change.
    expect(APP).toMatch(/aria-label="Log a meal"/);
  });

  it("renders the raised button with the canonical testID", () => {
    // Stable testID lets E2E flows target the button without
    // depending on accessible-name lookup.
    expect(APP).toMatch(/data-testid="mobile-web-tab-log-button"/);
  });

  it("uses the canonical 56pt circle visuals (w-14 h-14 rounded-full, plum nav fill)", () => {
    // 56pt diameter, full-circle radius — matches the mobile
    // `<LogTabBarButton>` (56 / 2 = 28 borderRadius).
    expect(APP).toMatch(/w-14 h-14 rounded-full/);
    // SLOE (2026-06-07): the FAB fill is the plum nav/brand-chrome token
    // (`--sidebar-primary`, #3B2A4D light / #815E91 dark), NOT clay
    // `bg-primary` — so it reads as nav chrome, parity with the mobile
    // FAB's `colors.navPrimary` plum. Pins against regressing to the old
    // clay fill.
    expect(APP).toMatch(/bg-\[var\(--sidebar-primary\)\] text-\[var\(--sidebar-primary-foreground\)\]/);
  });

  it("re-tints the FAB drop-shadow to plum (no stale brand-blue glow)", () => {
    // SLOE (2026-06-07): the glow was `rgba(76,108,224,0.4)` — the
    // retired brand BLUE — which had drifted off the Sloe palette. It is
    // now plum `rgba(59,42,77,...)` to match the fill. Guard both ways:
    // the plum glow must be present and the blue glow must be gone.
    expect(APP).toMatch(/shadow-\[0_4px_16px_rgba\(59,42,77,/);
    expect(APP).not.toMatch(/rgba\(76,\s*108,\s*224/);
  });

  it("uses the canonical tab glyph set (Calendar / BookOpen / Utensils / BarChart3), matching native iOS", () => {
    // ENG-1044 / P1-9 (2026-06-11): the tab order + glyphs are now locked
    // to ONE set across native iOS + mobile-web + web. The prior Sloe set
    // (Sun / BookOpen / CalendarDays / LineChart) both DIVERGED from native
    // AND collided (BookOpen meant Recipes on web but Plan on native).
    // Canonical: Today=Calendar, Plan=BookOpen, Recipes=Utensils,
    // Progress=BarChart3.
    expect(APP).toMatch(/icon: <Calendar className="w-5 h-5" strokeWidth=\{2\}/);
    expect(APP).toMatch(/icon: <BookOpen className="w-5 h-5" strokeWidth=\{2\}/);
    expect(APP).toMatch(/icon: <Utensils className="w-5 h-5" strokeWidth=\{2\}/);
    expect(APP).toMatch(/icon: <BarChart3 className="w-5 h-5" strokeWidth=\{2\}/);
  });

  it("projects 16px above the bar fill line (relative -top-4)", () => {
    // Mirrors the mobile `top:-16` on the absolutely-positioned
    // raised button. `-top-4` = 16px in Tailwind's default scale.
    expect(APP).toMatch(/relative -top-4/);
  });

  it("renders the Plus glyph at 24px with strokeWidth 2.5", () => {
    // Spec calls for `Plus` 24px (h-6 w-6) at strokeWidth 2.5,
    // matching the mobile reference (`size={24} strokeWidth={2.5}`).
    expect(APP).toMatch(/<Plus className="h-6 w-6" strokeWidth=\{2\.5\}/);
  });

  it("hosts the bottom <nav> as `md:hidden` so desktop keeps the sidebar", () => {
    // D-2026-04-27-11: web is the long-form companion; the bottom
    // nav (and therefore the raised Log button) is mobile-web only.
    expect(APP).toMatch(
      /aria-label="Main navigation"\s+className="fixed bottom-0[^"]*md:hidden/,
    );
  });

  it("injects the raised button between Recipes (index 1) and Plan (index 2)", () => {
    // The raised button takes a 5th equal-width slot inside the
    // four-tab map; it sits *after* the Recipes tab. Mirrors the
    // mobile `<SupprTabBar>` `visibleIndex === 1` slot.
    expect(APP).toMatch(/showLogButtonAfterThis = tabIndex === 1/);
  });

  it("wires the raised button onClick to `openLogSheetFromTabBar`", () => {
    expect(APP).toMatch(/onClick=\{openLogSheetFromTabBar\}/);
  });

  it("`openLogSheetFromTabBar` switches to today and stamps openLog=1 on the URL", () => {
    expect(APP).toMatch(/const openLogSheetFromTabBar = useCallback/);
    expect(APP).toMatch(/setCurrentView\("today"\)/);
    expect(APP).toMatch(/params\.set\("openLog", "1"\)/);
  });

  it("does not render the legacy side <LogFab> from App.tsx", () => {
    // The side FAB was removed from the mobile-web layout and the
    // LogFab component has since been deleted (ENG-752). App.tsx
    // must not import or render it. The JSX signature we forbid is
    // `<LogFab` followed by whitespace or a newline (a self-closing
    // JSX render); explanatory comments referring to it are fine.
    expect(APP).not.toMatch(/import \{ LogFab \}/);
    expect(APP).not.toMatch(/<LogFab[\s\n]/);
  });
});

describe("mobile-web raised Log button — NutritionTracker openLog consumer", () => {
  const TRACKER = read("src/app/components/NutritionTracker.tsx");

  it("imports useSearchParams + useRouter from next/navigation", () => {
    expect(TRACKER).toMatch(
      /import \{ useRouter, useSearchParams \} from "next\/navigation"/,
    );
  });

  it("reads `openLog` from the URL search params", () => {
    expect(TRACKER).toMatch(/trackerSearchParams\.get\("openLog"\)/);
  });

  it("opens the LogSheet when openLog === '1'", () => {
    // The consumer mirrors mobile `(tabs)/index.tsx`'s `useEffect`
    // that watches `params.openLog === "1"` and calls
    // `setFabSheetOpen(true)`.
    expect(TRACKER).toMatch(/if \(openLogParam !== "1"\) return;[\s\S]+?setLogSheetOpen\(true\)/);
  });

  it("clears the openLog param after opening the sheet (back-nav must not re-open)", () => {
    // Critical correctness pin: without the param clear, a back-nav
    // landing on Today would re-open the LogSheet on every focus.
    expect(TRACKER).toMatch(/params\.delete\("openLog"\);[\s\S]+?trackerRouter\.replace/);
  });

  it("no longer renders the side <LogFab> JSX", () => {
    // The legacy <LogFab visible={viewMode === "day"} ...> JSX is
    // gone. Component import is also dropped.
    expect(TRACKER).not.toMatch(/<LogFab\s/);
    expect(TRACKER).not.toMatch(/^import \{ LogFab \}/m);
  });
});
