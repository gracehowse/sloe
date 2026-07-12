/**
 * Polish A.2 (2026-04-25 follow-up) — pin the end-to-end net-carbs
 * lens wiring on web AND mobile.
 *
 * Round-trip parts:
 *   1. AppDataContext (web) exposes `netCarbsLensEnabled` + setter.
 *   2. Settings UI (web + mobile) writes the flag back to
 *      `profiles.net_carbs_lens_enabled`.
 *   3. Tracker macro tile component (web + mobile) accepts the flag as
 *      a prop and consumes the shared `carbsLabel` + `netCarbsForRow`
 *      helpers.
 *   4. Recipe Detail (web + mobile) consumes the same helpers.
 *   5. The shared helper `netCarbs.ts` math + label logic is correct
 *      (already covered by `netCarbs.test.ts`).
 *
 * If any link in the chain breaks (e.g. someone adds a new carbs
 * surface without the helper, or the Settings toggle stops persisting),
 * this test fails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("net-carbs lens round-trip (P2-26 + P3-30 + polish A.2)", () => {
  describe("shared helper", () => {
    it("netCarbs.ts exports the three helpers consumed by every surface", () => {
      const src = read("src/lib/nutrition/netCarbs.ts");
      expect(src).toMatch(/export function netCarbsForRow/);
      expect(src).toMatch(/export function carbsLabel/);
      expect(src).toMatch(/export function carbsShortLabel/);
    });
  });

  describe("AppDataContext (web)", () => {
    it("exposes netCarbsLensEnabled + setter", () => {
      const src = read("src/context/AppDataContext.tsx");
      expect(src).toMatch(/netCarbsLensEnabled:\s*boolean/);
      expect(src).toMatch(/setNetCarbsLensEnabled:\s*Dispatch<SetStateAction<boolean>>/);
    });

    it("reads net_carbs_lens_enabled from the profiles select", () => {
      const src = read("src/context/AppDataContext.tsx");
      expect(src).toMatch(/net_carbs_lens_enabled/);
    });
  });

  describe("Settings toggle (web)", () => {
    it("renders a toggle bound to setNetCarbsLensEnabled and savePref", () => {
      const src = read("src/app/components/Settings.tsx");
      expect(src).toMatch(/setNetCarbsLensEnabled\(/);
      expect(src).toMatch(/savePref\(\s*\{\s*net_carbs_lens_enabled/);
      expect(src).toMatch(/data-testid=["']settings-net-carbs-lens-toggle["']/);
    });
  });

  describe("Settings toggle (mobile)", () => {
    // 2026-05-01 (`claude/settings-mobile-structural-fix` P0-1): the
    // toggle migrated from the legacy in-file Journal display section
    // in `app/(tabs)/settings.tsx` into `<SettingsBundleContent>`'s
    // Display & extras section, alongside the caffeine + alcohol
    // Today opt-ins. The bundle is the canonical body of /settings
    // (and the redirect target for /more).
    const BUNDLE_PATH =
      "apps/mobile/components/settings/SettingsBundleContent.tsx";

    it("renders a toggle backed by direct supabase update", () => {
      const src = read(BUNDLE_PATH);
      expect(src).toMatch(/setNetCarbsLensEnabled\(/);
      expect(src).toMatch(/update\(\s*\{\s*net_carbs_lens_enabled/);
      expect(src).toMatch(/testID=["']settings-net-carbs-lens-toggle["']/);
    });

    it("fetches net_carbs_lens_enabled from profiles", () => {
      const src = read(BUNDLE_PATH);
      expect(src).toMatch(/net_carbs_lens_enabled/);
    });
  });

  describe("Tracker macro tile (web)", () => {
    it("today-dashboard-macro-tiles.tsx imports the shared helpers and uses them on the carbs tile", () => {
      const src = read("src/app/components/suppr/today-dashboard-macro-tiles.tsx");
      expect(src).toMatch(/from\s+["'][^"']*nutrition\/netCarbs(?:\.tsx?)?["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
      expect(src).toMatch(/netCarbsLensEnabled\?:\s*boolean/);
    });

    it("NutritionTracker passes netCarbsLensEnabled to the macro tiles", () => {
      const src = read("src/app/components/NutritionTracker.tsx");
      expect(src).toMatch(/netCarbsLensEnabled/);
    });
  });

  describe("Tracker macro tile (mobile)", () => {
    it("TodayDashboardMacroTiles.tsx imports + uses the shared helpers", () => {
      const src = read("apps/mobile/components/today/TodayDashboardMacroTiles.tsx");
      // Optional `.ts`/`.tsx` extension on the import path — some files use it explicitly.
      expect(src).toMatch(/from\s+["']@suppr\/nutrition-core\/netCarbs["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
    });

    it("the Tracker (mobile) fetches the lens flag and passes it down", () => {
      const src = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
      expect(src).toMatch(/net_carbs_lens_enabled/);
      expect(src).toMatch(/setNetCarbsLensEnabled/);
      expect(src).toMatch(/netCarbsLensEnabled=\{netCarbsLensEnabled\}/);
    });
  });

  describe("Rings macro variant (web + mobile) — ENG-1508", () => {
    it("web today-dashboard-macro-rings.tsx consumes the shared helpers (no raw label ternary)", () => {
      const src = read("src/app/components/suppr/today-dashboard-macro-rings.tsx");
      expect(src).toMatch(/from\s+["'][^"']*nutrition\/netCarbs(?:\.tsx?)?["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
      expect(src).not.toMatch(/netCarbsLensEnabled \? "Net carbs" : "Carbs"/);
    });

    it("mobile TodayDashboardMacroRings.tsx consumes the shared helpers (no raw label ternary)", () => {
      const src = read("apps/mobile/components/today/TodayDashboardMacroRings.tsx");
      expect(src).toMatch(/from\s+["']@suppr\/nutrition-core\/netCarbs["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
      expect(src).not.toMatch(/netCarbsLensEnabled \? "Net carbs" : "Carbs"/);
    });
  });

  describe("Recipe Detail (web)", () => {
    it("imports the helpers and uses them on the carbs row", () => {
      const src = read("src/app/components/RecipeDetail.tsx");
      expect(src).toMatch(/from\s+["'][^"']*nutrition\/netCarbs(?:\.tsx?)?["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
    });
  });

  describe("Recipe Detail (mobile)", () => {
    it("imports the helpers and uses them on the carbs row", () => {
      const src = read("apps/mobile/app/recipe/[id].tsx");
      // Optional `.ts`/`.tsx` extension on the import path — some files use it explicitly.
      expect(src).toMatch(/from\s+["']@suppr\/nutrition-core\/netCarbs["']/);
      expect(src).toMatch(/carbsLabel\(/);
      expect(src).toMatch(/netCarbsForRow\(/);
    });
  });

  describe("migration", () => {
    it("the column migration adds net_carbs_lens_enabled with default false", () => {
      const src = read(
        "supabase/migrations/20260503103000_profiles_net_carbs_lens.sql",
      );
      expect(src).toMatch(/add column if not exists net_carbs_lens_enabled boolean not null default false/);
    });
  });

  describe("mobile lens refresh on focus (2026-05-02)", () => {
    // Pre-fix: the lens flag was loaded once on userId mount and
    // never refreshed, so toggling "Show net carbs" in Settings did
    // nothing visible on Today / /targets / Recipe Detail until the
    // app cold-started. The fix wires the flag through each
    // screen's existing focus-refresh path so a tab return picks
    // up the new value.
    it("Today tab fetches net_carbs_lens_enabled inside loadProfileTargets", () => {
      const src = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
      // The select string passed to loadProfileTargets must include the
      // column so the focus-effect refresh repropagates the toggle.
      const loadProfileTargetsBlock =
        src.match(/const loadProfileTargets[\s\S]+?\}\s*,\s*\[userId\]\)/);
      expect(loadProfileTargetsBlock).not.toBeNull();
      expect(loadProfileTargetsBlock![0]).toMatch(/net_carbs_lens_enabled/);
    });

    it("/targets refreshes the lens flag on screen focus", () => {
      const src = read("apps/mobile/app/targets.tsx");
      // Must import + call useFocusEffect AND read the column inside it.
      expect(src).toMatch(/useFocusEffect/);
      expect(src).toMatch(/net_carbs_lens_enabled/);
    });

    it("Recipe Detail refreshes the lens flag on screen focus", () => {
      const src = read("apps/mobile/app/recipe/[id].tsx");
      // The recipe detail screen mounts once when navigated to; a
      // useFocusEffect refresh is what flips the carb label after the
      // user toggles Settings and returns.
      expect(src).toMatch(/useFocusEffect/);
      // The pre-fix one-shot useEffect stays as the cold-start
      // hydration; the focus refresh is on top of it.
      const focusBlock = src.match(/useFocusEffect[\s\S]+?\)\s*\)\s*;/);
      expect(focusBlock).not.toBeNull();
      expect(focusBlock![0]).toMatch(/net_carbs_lens_enabled|refreshNetCarbsLens/);
    });
  });
});
