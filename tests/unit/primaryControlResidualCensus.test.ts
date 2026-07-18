import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const WEB_PLAN_FILTERS = read("src/app/components/plan/PlanMealFilterChipsV3.tsx");
const MOBILE_PLAN_FILTERS = read("apps/mobile/components/plan/PlanMealFilterChipsV3.tsx");
const WEB_RECIPES_CHROME = read("src/app/components/suppr/recipes-tab-chrome.tsx");
const MOBILE_RECIPES_CHROME = read("apps/mobile/components/tabs/RecipesTabChrome.tsx");
const WEB_LIBRARY = read("src/app/components/Library.tsx");
const WEB_LIBRARY_HEADER = read("src/app/components/library/LibraryDesktopHeader.tsx");
const MOBILE_LIBRARY = read("apps/mobile/app/(tabs)/library.tsx");
const WEB_DISCOVER_FILTERS = read("src/app/components/DiscoverFilterChips.tsx");
const MOBILE_DISCOVER = read("apps/mobile/app/(tabs)/discover.tsx");
const WEB_LOG = read("src/app/components/suppr/log-sheet.tsx");

describe("ENG-1577 primary-control residual census", () => {
  it("retains shared FilterChip and SegmentedTrack owners", () => {
    expect(WEB_PLAN_FILTERS).toContain("<FilterChip");
    expect(MOBILE_PLAN_FILTERS).toContain("<FilterChip");
    expect(WEB_RECIPES_CHROME).toContain("<SegmentedTrack");
    expect(MOBILE_RECIPES_CHROME).toContain("<SegmentedTrack");
  });

  it("corrects Recipes chip size and border drift under the chrome flag", () => {
    expect(WEB_LIBRARY).toContain('consistencyChrome ? "text-xs" : "text-[13px]"');
    expect(WEB_DISCOVER_FILTERS).toContain('consistencyChrome ? "text-xs" : "text-[13px]"');
    expect(MOBILE_LIBRARY).toContain("borderWidth: consistencyChrome ? 0");
    expect(MOBILE_DISCOVER).toContain("borderWidth: consistencyChrome ? 0");
    expect(MOBILE_DISCOVER).toContain("consistencyChrome ? Type.captionSmall : Type.body");
  });

  it("puts the desktop Library title and actions on the 33/40 contract", () => {
    expect(WEB_LIBRARY_HEADER).toContain('isFeatureEnabled("primary_screen_chrome_v1")');
    expect(WEB_LIBRARY_HEADER).toContain("page-title text-foreground-brand");
    expect(WEB_LIBRARY_HEADER).toContain("h-10 w-10");
    expect(WEB_LIBRARY_HEADER).toContain('consistencyChrome ? null : "Create"');
    expect(WEB_LIBRARY_HEADER).toContain('consistencyChrome ? null : "Import"');
  });

  it("keeps active Log search as the owner of the sheet", () => {
    expect(WEB_LOG).toContain("const searchQueryActive");
    expect(WEB_LOG).toContain("const showSecondaryMethodChrome");
    expect(WEB_LOG).toContain('isFeatureEnabled("component_grammar_dedup")');
  });
});
