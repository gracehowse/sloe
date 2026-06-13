/**
 * Wave E (MOBILE) — Food-search + Household + Plan-templates + Goal-pace +
 * Digest + Recap + import-shared CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The 2026-06-12 canon retired the everyday aubergine-OUTLINE primary in
 * favour of two SupprButton variants:
 *   - PRIMARY (a surface's ONE main / commit action) → `variant="primary"`:
 *     SOLID aubergine fill, white label, full pill, no border.
 *   - GHOST (secondaries / inline / nudge / dismiss) → `variant="ghost"`:
 *     transparent, plum label, no border.
 *
 * Wave E is the final lane sweep across the remaining everyday surfaces. These
 * are source-level structural pins (mirror `settingsLaneAubergineOutline` /
 * `waveDLibraryProgressSettingsButtons`) — they break if a Wave-E CTA
 * regresses to the retired `accent.primarySolid` border outline or a filled
 * `accent.primary` slab so the migration can't silently drift.
 *
 * Web parity for the household lane is pinned in
 * `tests/unit/householdButtonSystemWeb.test.ts`; the goal-pace + household
 * settings-page grammar is also pinned in
 * `tests/unit/settingsLaneAubergineOutline.test.ts` and the import-shared
 * grammar in `tests/unit/todayLaneAubergineOutline.test.ts` (this file pins
 * the surfaces those didn't reach: FoodSearchPanel, PlanTemplatesSheet,
 * Digest, weekly-recap, HouseholdCard).
 *
 * IMPORTANT — FoodSearchPanel "Add" is a GHOST, not primary. The preview
 * footer pairs a dominant solid "Use this" log-commit with a secondary "Add to
 * basket" stage action. Per the one-filled-CTA law (root CLAUDE.md), the
 * SECOND button cannot also be a solid primary — it would erase the
 * log-vs-stage hierarchy. So "Add" is `variant="ghost"`. The original task
 * brief said "FoodSearchPanel Add = primary"; the sanctioned in-source
 * treatment is ghost (the solid commit in that row is "Use this"). This pin
 * follows the source's documented one-CTA rationale rather than the brief.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FOOD_SEARCH = read("components/food-search/FoodSearchPanel.tsx");
const GOAL_CONTROLS = read("components/recap/GoalPaceControls.tsx");
const GOAL_RETUNE = read("components/recap/GoalPaceRetuneSheet.tsx");
const PLAN_TEMPLATES = read("components/PlanTemplatesSheet.tsx");
const DIGEST = read("components/Digest.tsx");
const WEEKLY_RECAP = read("app/weekly-recap.tsx");
const IMPORT_SHARED = read("app/import-shared.tsx");
const HOUSEHOLD_CARD = read("components/HouseholdCard.tsx");
const HOUSEHOLD_SETTINGS = read("app/household-settings.tsx");

// Retired aubergine-OUTLINE signature on a *named* CTA.
const outlineNear = (testidOrLabel: string) =>
  new RegExp(`${testidOrLabel}[\\s\\S]{0,300}borderColor:\\s*(?:accent|Accent)\\.primarySolid`);

describe("Wave E (mobile) — FoodSearchPanel preview footer", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(FOOD_SEARCH).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Add' (basket stage action) is a GHOST beside the solid 'Use this' commit (one-CTA law)", () => {
    // The dominant log commit "Use this" owns the solid fill; "Add" stages to
    // the basket as the secondary → ghost (transparent, plum label + glyph).
    expect(FOOD_SEARCH).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,200}testID="food-search-preview-add-to-basket"/,
    );
    // Must NOT regress to the retired aubergine outline.
    expect(FOOD_SEARCH).not.toMatch(
      outlineNear('testID="food-search-preview-add-to-basket"'),
    );
  });
});

describe("Wave E (mobile) — Goal-pace sheet commits", () => {
  it("editor 'Save' is a SOLID primary; 'Cancel' is a GHOST", () => {
    expect(GOAL_CONTROLS).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="goal-pace-editor-save"/,
    );
    expect(GOAL_CONTROLS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="goal-pace-editor-cancel"/,
    );
    expect(GOAL_CONTROLS).not.toMatch(outlineNear('testID="goal-pace-editor-save"'));
  });

  it("retune 'Confirm' is a SOLID primary; 'Cancel' is a GHOST", () => {
    expect(GOAL_RETUNE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="goal-pace-retune-confirm"/,
    );
    expect(GOAL_RETUNE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="goal-pace-retune-cancel"/,
    );
    expect(GOAL_RETUNE).not.toMatch(outlineNear('testID="goal-pace-retune-confirm"'));
  });
});

describe("Wave E (mobile) — PlanTemplatesSheet", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(PLAN_TEMPLATES).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Save template' is a SOLID primary (the sheet's ONE commit action) with disable + loading", () => {
    expect(PLAN_TEMPLATES).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}label=\{saving \? "Saving…" : "Save template"\}/,
    );
    expect(PLAN_TEMPLATES).toMatch(
      /accessibilityLabel="Save template"/,
    );
    expect(PLAN_TEMPLATES).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}disabled=\{!canSave\}[\s\S]{0,40}loading=\{saving\}/,
    );
  });
});

describe("Wave E (mobile) — Digest nudge", () => {
  it("'Save … as a meal' is a SOLID primary (the nudge's ONE commit action)", () => {
    expect(DIGEST).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}accessibilityLabel=\{`Save \$\{promptSlot\} as a usual meal`\}/,
    );
    // The bookmark glyph + label ride on the solid fill → white, not plum.
    expect(DIGEST).toMatch(/Save \{promptSlot\} as a meal/);
  });
});

describe("Wave E (mobile) — weekly-recap", () => {
  it("'Adjust goal pace' is a GHOST (secondary route into the retune sheet)", () => {
    // The recap's solid primary is the empty-state "Log a meal"; the
    // adjust-pace link is a secondary → ghost (transparent, plum label).
    expect(WEEKLY_RECAP).toMatch(
      /<SupprButton\s+variant="ghost"\s+accessibilityLabel="Adjust goal pace"/,
    );
    // And the empty-state's ONE commit stays a solid primary.
    expect(WEEKLY_RECAP).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}accessibilityLabel="Log a meal"/,
    );
  });
});

describe("Wave E (mobile) — import-shared", () => {
  it("'Import' (both idle paths) is a SOLID primary; the retired outline style is gone", () => {
    expect(IMPORT_SHARED).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}testID="import-shared-import"\s+label="Import"/,
    );
    expect(IMPORT_SHARED).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}testID="import-shared-import-legacy"\s+label="Import"/,
    );
    expect(IMPORT_SHARED).not.toMatch(/outlineImportBtn/);
  });
});

describe("Wave E (mobile) — HouseholdCard + household-settings", () => {
  it("HouseholdCard idle pair: 'Create' is a SOLID primary, 'Join' (toggle) is a GHOST", () => {
    // Mirror of web HouseholdPanel idle pair (Create Household primary + Join
    // with Code ghost).
    expect(HOUSEHOLD_CARD).toMatch(
      /<SupprButton\s+variant="primary"\s+label="Create"\s+onPress=\{\(\)\s*=>\s*setMode\("create"\)\}/,
    );
    expect(HOUSEHOLD_CARD).toMatch(
      /<SupprButton\s+variant="ghost"\s+label="Join"\s+onPress=\{\(\)\s*=>\s*setMode\("join"\)\}/,
    );
  });

  it("HouseholdCard input form: the Create/Join COMMIT is a SOLID primary; 'Cancel' is a GHOST", () => {
    // In create/join mode the form's ONE commit (label flips Create↔Join) is
    // the solid primary — this is the "Join = primary" submit the task means.
    expect(HOUSEHOLD_CARD).toMatch(
      /<SupprButton\s+variant="primary"\s+label=\{mode === "create" \? "Create" : "Join"\}/,
    );
    expect(HOUSEHOLD_CARD).toMatch(
      /<SupprButton\s+variant="ghost"\s+label="Cancel"/,
    );
  });

  it("HouseholdCard CTAs carry no retired aubergine outline border", () => {
    expect(HOUSEHOLD_CARD).not.toMatch(/borderColor:\s*(?:accent|Accent)\.primarySolid/);
  });

  it("household-settings 'Save changes' is a SOLID primary (the footer's ONE commit action)", () => {
    expect(HOUSEHOLD_SETTINGS).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,400}testID="household-settings-save"/,
    );
    expect(HOUSEHOLD_SETTINGS).not.toMatch(
      outlineNear('testID="household-settings-save"'),
    );
  });
});
