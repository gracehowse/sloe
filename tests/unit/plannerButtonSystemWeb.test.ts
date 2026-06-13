/**
 * Plan lane (WEB) — SOLID-PRIMARY / GHOST button system
 * (cohesion wave 2026-06-13, ENG-1080;
 * `docs/decisions/2026-06-12-button-system-solid-primary.md` +
 * `docs/ux/design-system-canon.md` Known cohesion debt #1).
 *
 * The Plan surface's Generate / Regenerate / Shopping-list CTAs were the last
 * holdouts still on the retired Sloe treatments: the aubergine OUTLINE pill
 * (`border-[1.5px] border-primary-solid text-primary-solid`) and the beige
 * `bg-card border border-border` secondary slab. The button migration that
 * reached Today + Recipe-import didn't reach Plan. This wave routes all three
 * CTA sites (empty-state, week-summary card, bottom CTA row) through the
 * shared `SupprButton` grammar so Plan reads as one system with the rest of
 * the app:
 *   - PRIMARY (each surface's ONE generate/regenerate action) → `variant="primary"`:
 *     SOLID `bg-primary-solid` fill, white sans label, full pill, no border/shadow.
 *   - SECONDARY (Shopping list) → `variant="ghost"`: transparent, plum label, no border.
 *
 * Mobile parity: `apps/mobile/app/(tabs)/planner.tsx` already pairs a solid
 * `SupprButton variant="primary"` Generate with a `variant="ghost"` Adjust —
 * this pins the web side to the same primitive + grammar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const PLANNER = read("src/app/components/MealPlanner.tsx");
const MOBILE_PLANNER = read("apps/mobile/app/(tabs)/planner.tsx");

const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;
const BEIGE_SLAB = /bg-card border border-border text-foreground font-semibold/;

describe("MealPlanner CTAs — solid primary / ghost (cohesion wave 2026-06-13)", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(PLANNER).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("empty-state 'Generate meal plan' is a SOLID primary (the surface's ONE action)", () => {
    expect(PLANNER).toMatch(
      /<SupprButton\s+data-testid="planner-empty-generate-btn"\s+variant="primary"/,
    );
    // Keeps the source-blocked disable + the in-flight loading state.
    expect(PLANNER).toMatch(
      /data-testid="planner-empty-generate-btn"[\s\S]{0,160}loading=\{isGenerating\}[\s\S]{0,60}disabled=\{!sourceCanGenerate\}/,
    );
  });

  it("week-summary card: Generate/Regenerate is a SOLID primary, Shopping list is a GHOST", () => {
    // Verb flips with plan state (DC12 parity) — pin the primary wrapping it.
    expect(PLANNER).toMatch(
      /<SupprButton\s+variant="primary"\s+loading=\{isGenerating\}\s+onClick=\{handleRegenerate\}[\s\S]{0,400}planHasRealMeals \? "Regenerate" : "Generate"/,
    );
    expect(PLANNER).toMatch(
      /<SupprButton\s+variant="ghost"\s+onClick=\{handleShoppingList\}[\s\S]{0,120}Shopping list\s*</,
    );
  });

  it("bottom CTA row: Generate/Regenerate is a SOLID primary, Shopping list is a GHOST", () => {
    // The generate verb flips with plan state; pin the primary wrapping it.
    expect(PLANNER).toMatch(
      /<SupprButton\s+variant="primary"\s+loading=\{isGenerating\}\s+disabled=\{!sourceCanGenerate\}\s+onClick=\{handleRegenerate\}[\s\S]{0,600}plan\.length > 0 \? "Regenerate week" : "Generate my plan"/,
    );
    // The empty-state generate (above) carries the same primary trio but a
    // testid; this row's primary is the one without it. Both are solid.
  });

  it("ONE-CTA LAW: bottom row is hidden on empty plans so it never co-renders a second solid primary with the empty-state Generate", () => {
    // The empty-state card owns the sole Generate on an empty plan. The bottom
    // CTA row must therefore exclude `isPlanEmpty` from its render gate — else
    // two solid primaries stack on the most-seen Plan state (the regression the
    // 2026-06-13 cohesion review caught). It still renders for the
    // plan-exists-but-no-score case.
    expect(PLANNER).toMatch(
      /data-testid="planner-desktop-cta-row"[\s\S]{0,400}className=\{showSummaryCard \|\| isPlanEmpty \? "hidden" : "flex"\}/,
    );
  });

  it("ONE-CTA LAW: empty-state card is suppressed when the summary card leads, so they never stack two solid primaries", () => {
    // The summary card renders even in its "Plan your week" / placeholder-slots
    // form (showSummaryCard true, planHasRealMeals false) with a solid
    // Generate. The empty-state card ALSO carries a solid Generate, so it must
    // gate on `!showSummaryCard` — otherwise both render on the
    // slots-but-no-meals state (the second co-render path the review missed).
    // When the summary card leads we drop to the kanban (empty day columns +
    // add chips), mirroring mobile's empty day rows.
    expect(PLANNER).toMatch(
      /\{isPlanEmpty && !showSummaryCard \? \(/,
    );
  });

  it("summary card's Generate verb flips with plan state (no 'Regenerate' when nothing is generated)", () => {
    // DC12 parity: "Regenerate" misreads on the placeholder-slots form.
    expect(PLANNER).toMatch(/planHasRealMeals \? "Regenerate" : "Generate"/);
  });

  it("no Plan CTA regresses to the retired outline pill or beige secondary slab", () => {
    // Outline pill was on the empty-state Generate + both Shopping-list buttons;
    // beige slab was on both Regenerate buttons. All three sites are SupprButtons now.
    expect(PLANNER).not.toMatch(OUTLINE_PILL);
    expect(PLANNER).not.toMatch(BEIGE_SLAB);
  });
});

describe("Plan button grammar — cross-platform parity (web ↔ mobile)", () => {
  it("mobile planner pairs a solid primary Generate with a ghost Adjust", () => {
    expect(MOBILE_PLANNER).toMatch(
      /<SupprButton\s+variant="primary"\s+testID="plan-generate-menu"/,
    );
    expect(MOBILE_PLANNER).toMatch(
      /<SupprButton\s+variant="ghost"\s+testID="plan-summary-adjust-constraints"/,
    );
  });

  it("both platforms drive the Plan CTAs through the same SupprButton primitive", () => {
    expect(PLANNER).toMatch(/<SupprButton\s+/);
    expect(MOBILE_PLANNER).toMatch(/<SupprButton\s+/);
  });
});
