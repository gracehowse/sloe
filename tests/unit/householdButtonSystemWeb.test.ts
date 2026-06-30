/**
 * Wave E (WEB) — Household lane CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The 2026-06-12 canon retired the everyday aubergine-OUTLINE primary in
 * favour of two SupprButton variants:
 *   - PRIMARY (a surface's ONE main action) → `variant="primary"`: SOLID
 *     aubergine fill, white label, full pill, no border.
 *   - GHOST (secondaries / inline toggles / dismiss) → `variant="ghost"`:
 *     transparent, plum label, no border.
 *
 * Wave E sweeps the Household lane on web (`HouseholdPanel` join/create card +
 * `HouseholdSettingsPage` sharing editor). These are source-level structural
 * pins (mirror `plannerButtonSystemWeb` / `waveDLibraryProgressSettingsButtonsWeb`)
 * — they break if a Household CTA regresses to the retired
 * `border-primary-solid` / `border-[1.5px]` outline or a filled `bg-primary`
 * slab, so the migration can't silently drift.
 *
 * Mobile parity for the same lane is pinned in
 * `apps/mobile/tests/unit/householdCardParity.test.ts` (fetch-path parity) +
 * `apps/mobile/tests/unit/settingsLaneAubergineOutline.test.ts` (household
 * Save / solo-Invite grammar) + the Wave-E mobile pin
 * `apps/mobile/tests/unit/waveEFoodSearchHouseholdDigestButtons.test.ts`
 * (HouseholdCard Create/Join/Cancel + household-settings Save).
 *
 * SANCTIONED RAW: the FoodSearchPanel preview portion-picker steppers (the
 * −/＋ "Number of servings" quantity adjusters) are deliberately NOT
 * SupprButtons — they are numeric increment/decrement affordances, not the
 * panel's commit CTA, so they stay raw circular `<button>`s. Pinned here so a
 * future button-system sweep doesn't wrongly migrate them and erase the
 * stepper affordance. See `tests/unit/foodSearchPanelRedesign.test.tsx` for
 * the panel's commit-CTA grammar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const PANEL = read("src/app/components/HouseholdPanel.tsx");
const SETTINGS = read("src/app/components/HouseholdSettingsPage.tsx");
const FOOD_SEARCH = read("src/app/components/food-search/FoodSearchPanel.tsx");

// Retired Sloe aubergine-OUTLINE / filled-slab signatures the migration drops.
// The retired outline-pill CTA paired a `border-[1.5px] border-primary-solid`
// edge with a `text-primary-solid` label. ENG-828 introduced `text-primary-solid`
// as the AA-safe CHIP/badge ink (on a `bg-primary/N` tint + `border-primary/30`),
// so a bare `text-primary-solid` is no longer a CTA-regression signal on its
// own — the tell is the `border-[1.5px] border-primary-solid` OUTLINE edge.
// OUTLINE_LABEL now requires that outline edge to co-occur (chips use the `/30`
// alpha border, never `border-primary-solid`), so the contrast-token chip fix
// doesn't false-positive as a button regression.
const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;
const OUTLINE_LABEL =
  /border-\[1\.5px\]\s+border-primary-solid[\s\S]{0,160}text-primary-solid|text-primary-solid[\s\S]{0,160}border-\[1\.5px\]\s+border-primary-solid/;

describe("Wave E (web) — HouseholdPanel join/create card", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(PANEL).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("idle card: 'Create Household' is a SOLID primary, 'Join with Code' is a GHOST", () => {
    // The idle pair leads with the create affordance (primary) and offers the
    // join-by-code path as the secondary (ghost). Mirrors mobile HouseholdCard.
    expect(PANEL).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,120}>Create Household<\/SupprButton>/,
    );
    expect(PANEL).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,120}>Join with Code<\/SupprButton>/,
    );
  });

  it("expanded create form: 'Create' is a SOLID primary, 'Cancel' is a GHOST", () => {
    expect(PANEL).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,120}>Create<\/SupprButton>/,
    );
    expect(PANEL).toMatch(
      /onClick=\{\(\)\s*=>\s*setShowCreate\(false\)\}[\s\S]{0,40}>Cancel<\/SupprButton>/,
    );
  });

  it("expanded join form: 'Join' is a SOLID primary, 'Cancel' is a GHOST", () => {
    expect(PANEL).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,120}>Join<\/SupprButton>/,
    );
    expect(PANEL).toMatch(
      /onClick=\{\(\)\s*=>\s*setShowJoin\(false\)\}[\s\S]{0,40}>Cancel<\/SupprButton>/,
    );
  });

  it("no HouseholdPanel CTA regresses to the retired outline pill / label", () => {
    expect(PANEL).not.toMatch(OUTLINE_PILL);
    expect(PANEL).not.toMatch(OUTLINE_LABEL);
  });
});

describe("Wave E (web) — HouseholdSettingsPage sharing editor", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(SETTINGS).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("'Save changes' footer CTA is a SOLID primary (the editor's ONE commit action)", () => {
    // Carries the loading + owner-gated disable; verb flips with save state.
    // The owner-gated disable + loading + testid all sit on the one primary
    // tag (loading/disabled precede the testid in source order).
    expect(SETTINGS).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}loading=\{saving\}[\s\S]{0,80}disabled=\{!household\.isOwner\}[\s\S]{0,80}data-testid="household-settings-save"/,
    );
    expect(SETTINGS).toMatch(/savedToast \? "Household saved" : "Save changes"/);
  });

  it("solo-state 'Invite' is a GHOST (secondary action, matches mobile solo-invite)", () => {
    expect(SETTINGS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,200}data-testid="household-settings-solo-invite"/,
    );
  });

  it("no HouseholdSettingsPage CTA regresses to the retired outline pill / label", () => {
    expect(SETTINGS).not.toMatch(OUTLINE_PILL);
    expect(SETTINGS).not.toMatch(OUTLINE_LABEL);
  });
});

describe("Wave E (web) — SANCTIONED: FoodSearchPanel portion-picker steppers stay raw", () => {
  it("the −/＋ 'Number of servings' quantity adjusters are raw circular buttons, not SupprButtons", () => {
    // They are numeric increment/decrement affordances, NOT the panel's commit
    // CTA — so they intentionally keep the raw `<button>` + `rounded-full
    // border border-border` treatment. A future button-system sweep must not
    // migrate them (that would erase the stepper affordance + double-count the
    // commit CTA).
    expect(FOOD_SEARCH).toMatch(/Number of servings/);
    // Two raw circular stepper buttons (the − and the ＋) sit either side of the
    // quantity <input>, each on the shared `w-8 h-8 rounded-full border
    // border-border` treatment.
    const rawStepper = /className="w-8 h-8 rounded-full border border-border flex items-center justify-center/g;
    expect(FOOD_SEARCH.match(rawStepper)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("the steppers are deliberately NOT wrapped in a SupprButton", () => {
    // Pin the negative: neither stepper carries a SupprButton variant. The
    // quantity decrement is gated (>0.25); the increment steps the same way.
    expect(FOOD_SEARCH).not.toMatch(
      /<SupprButton[\s\S]{0,200}quantity\s*-\s*step/,
    );
    expect(FOOD_SEARCH).not.toMatch(
      /<SupprButton[\s\S]{0,200}quantity\s*\+\s*step/,
    );
  });
});
