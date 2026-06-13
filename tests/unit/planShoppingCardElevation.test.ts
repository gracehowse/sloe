/**
 * Plan + Shopping surfaces — card elevation, one treatment per surface.
 *
 * Pins the "one card treatment" rule (Grace 2026-06-09,
 * `docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md`) for the
 * PLAN + SHOPPING cluster on BOTH platforms: every card that sits directly on
 * the page ground uses the SOFT lift — `elevation="card"` / `.card-slab` (web),
 * `<SupprCard lift="soft">` / `useCardElevation({ variant: "soft" })` (mobile).
 * Cards NESTED inside another card/sheet stay FLAT so they never double-shadow.
 *
 * Page-ground cards re-pinned to soft here:
 *   - Web Plan (MealPlanner.tsx): week summary card, empty-state card, each
 *     per-day kanban column.
 *   - Web Shopping (ShoppingList.tsx): empty-state card, each aisle/category
 *     section card.
 *   - Mobile Plan (planner.tsx): summary card + setup/"Plan your week" slab
 *     (both spread the soft `cardElevation`); PlanEmptyState.tsx (its own soft
 *     spread).
 *   - Mobile Shopping (shopping.tsx): progress + section cards already lift
 *     soft via `cardOuter` (`Elevation.cardSoft`) — pinned here so a regression
 *     to flat breaks a test.
 *
 * Kept FLAT (deliberate — recorded so a future "make everything soft" sweep
 * doesn't wrongly flip them):
 *   - Mobile Plan continuous-list day sections (`planDayCard` / `daySection`):
 *     a transparent, chrome-less list (Grace 2026-05-22) — NOT cards.
 *   - PlanTemplatesSheet.tsx `templateRow`s: nested inside the bottom sheet.
 *   - Slot tiles inside each web kanban day card (`rounded-xl bg-muted`):
 *     nested inside the day card.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const WEB_PLANNER = read("src/app/components/MealPlanner.tsx");
const WEB_SHOPPING = read("src/app/components/ShoppingList.tsx");
const MOBILE_PLANNER = read("apps/mobile/app/(tabs)/planner.tsx");
const MOBILE_PLAN_EMPTY = read("apps/mobile/components/PlanEmptyState.tsx");
const MOBILE_PLAN_TEMPLATES = read("apps/mobile/components/PlanTemplatesSheet.tsx");
const MOBILE_SHOPPING = read("apps/mobile/app/shopping.tsx");

const CARD_ELEVATION = 'elevation="card"';
const SOFT_VARIANT = 'useCardElevation({ variant: "soft" })';

describe("Plan — web page-ground cards lift soft (one-treatment)", () => {
  it("week summary card uses elevation=\"card\"", () => {
    // The summary SupprCard block carries the soft elevation right after its
    // testid (the only card with that testid).
    expect(WEB_PLANNER).toMatch(
      /data-testid="planner-week-summary-card"[\s\S]{0,400}?elevation="card"/,
    );
  });

  it("empty-state card uses elevation=\"card\"", () => {
    expect(WEB_PLANNER).toMatch(
      /data-testid="planner-empty-state"[\s\S]{0,300}?elevation="card"/,
    );
  });

  it("per-day kanban columns use elevation=\"card\" (page-ground grid)", () => {
    expect(WEB_PLANNER).toMatch(
      /<SupprCard\s+key={`day-\$\{dp\.day\}`}\s+elevation="card"/,
    );
  });

  it("at least three page-ground cards lift soft", () => {
    const softCount = (WEB_PLANNER.match(/elevation="card"/g) ?? []).length;
    expect(softCount).toBeGreaterThanOrEqual(3);
  });
});

describe("Shopping — web page-ground cards lift soft (one-treatment)", () => {
  it("both the empty-state and the category section cards lift soft", () => {
    const softCount = (WEB_SHOPPING.match(/elevation="card"/g) ?? []).length;
    expect(softCount).toBeGreaterThanOrEqual(2);
  });

  it("category section card carries elevation=\"card\"", () => {
    expect(WEB_SHOPPING).toMatch(
      /<SupprCard\s+key={section\.name}[\s\S]{0,500}?elevation="card"/,
    );
  });
});

describe("Plan — mobile page-ground cards lift soft (one-treatment)", () => {
  it("summary + setup cards spread the SOFT cardElevation", () => {
    // Single soft elevation hook, spread onto the summary + setup slabs.
    expect(MOBILE_PLANNER).toContain(SOFT_VARIANT);
    const spreads = (MOBILE_PLANNER.match(/cardElevation\.shadowStyle/g) ?? [])
      .length;
    expect(spreads).toBeGreaterThanOrEqual(2);
  });

  it("does not re-pin the flat no-arg default for the Plan cards", () => {
    // The page-ground Plan cards must opt into soft, not the flat default.
    expect(MOBILE_PLANNER).not.toContain("const cardElevation = useCardElevation();");
  });

  it("PlanEmptyState card lifts soft", () => {
    expect(MOBILE_PLAN_EMPTY).toContain(SOFT_VARIANT);
    expect(MOBILE_PLAN_EMPTY).toContain("cardElevation.shadowStyle");
  });
});

describe("Shopping — mobile page-ground cards are FLAT (flat-card surfaces 2026-06-12)", () => {
  // Flat-card surfaces (2026-06-12, Withings grammar — decision:
  // docs/decisions/2026-06-12-flat-card-surfaces.md) supersedes the soft-lift
  // half of the 2026-06-09 one-treatment decision. The mobile Shopping progress
  // + section cards no longer carry `Elevation.cardSoft` on `cardOuter`; the
  // card fill on the cream ground is the separation. The outer/inner split is
  // kept as a flat radius holder so the section call sites need no churn.
  it("cardOuter no longer carries Elevation.cardSoft (flat)", () => {
    expect(MOBILE_SHOPPING).not.toContain("...Elevation.cardSoft");
    // cardOuter is still applied to BOTH the progress card and each section
    // card — flat now, but the structural wrapper persists.
    const usages = (MOBILE_SHOPPING.match(/styles\.cardOuter/g) ?? []).length;
    expect(usages).toBeGreaterThanOrEqual(2);
  });
});

describe("Plan — nested/list cards stay FLAT (no double-shadow)", () => {
  it("mobile continuous-list day sections keep no card chrome", () => {
    // `planDayCard` is the transparent, chrome-less continuous-list wrapper
    // (Grace 2026-05-22) — NOT a card, so it must not pick up a shadow.
    expect(MOBILE_PLANNER).toMatch(
      /planDayCard:\s*{\s*backgroundColor:\s*"transparent",/,
    );
  });

  it("PlanTemplatesSheet rows stay flat (nested in the sheet)", () => {
    // The template rows live inside the bottom-sheet Modal — a card-in-a-sheet
    // must not lift. The sheet itself owns no soft elevation hook.
    expect(MOBILE_PLAN_TEMPLATES).not.toContain("useCardElevation");
    expect(MOBILE_PLAN_TEMPLATES).not.toContain("Elevation.cardSoft");
  });
});
