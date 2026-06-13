/**
 * Cohesion wave 2026-06-13 — ENG-1080.
 *
 * Pins the Plan summary-card CTAs (Generate + Adjust constraints) onto the
 * SupprButton button-system primitive, draining the "Known cohesion debt"
 * HIGH item in `docs/ux/design-system-canon.md`:
 *
 *   "Plan: Generate + Adjust constraints are still outline/beige buttons …
 *    Generate = solid SupprButton primary; Adjust = ghost."
 *
 * Before this wave the two CTAs were hand-rolled `Pressable`s: Generate was a
 * transparent aubergine OUTLINE (`borderWidth: 1.5`, `borderColor:
 * accent.primarySolid`) and Adjust was a beige `colors.background` fill with a
 * hairline border — the retired "Sloe treatment §1" grammar. Canon now puts
 * the solid aubergine on the everyday primary and ghost on the secondary, so
 * Plan reads as one system with Today's Complete Day CTA.
 *
 * These are static-source pins (the screen is a 3k-line RSC-free RN file that
 * can't be cheaply rendered here) — they break if anyone reverts the Generate
 * CTA to an outline, drops the SupprButton import, or re-introduces the
 * borderWidth on the summary CTA styles.
 *
 * Web parity is owned by the web lane (`src/app/components/MealPlanner.tsx`
 * Generate row → solid primary); not asserted here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const MOBILE_SRC = readFileSync(PLANNER_PATH, "utf8");

describe("Plan summary CTAs — button system migration (ENG-1080)", () => {
  it("imports the shared SupprButton primitive", () => {
    expect(MOBILE_SRC).toContain(
      'import { SupprButton } from "@/components/ui/SupprButton"',
    );
  });

  it("Generate is a solid SupprButton primary", () => {
    // The Generate menu trigger keeps its testID + loading wiring, now on the
    // primary variant (solid aubergine fill).
    const block = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf('testID="plan-generate-menu"') - 200,
      MOBILE_SRC.indexOf('testID="plan-generate-menu"') + 200,
    );
    expect(block).toContain('variant="primary"');
    expect(block).toContain('testID="plan-generate-menu"');
  });

  it("Generate loading state routes through SupprButton (no double-submit)", () => {
    const block = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf('testID="plan-generate-menu"') - 200,
      MOBILE_SRC.indexOf('testID="plan-generate-menu"') + 260,
    );
    expect(block).toContain("loading={generating}");
  });

  it("Adjust constraints is a SupprButton ghost (secondary)", () => {
    const idx = MOBILE_SRC.indexOf('testID="plan-summary-adjust-constraints"');
    expect(idx).toBeGreaterThan(-1);
    const block = MOBILE_SRC.slice(idx - 200, idx + 200);
    expect(block).toContain('variant="ghost"');
  });

  it("retires the outline/beige treatment on the summary CTA styles", () => {
    // The migrated style overrides are layout-only — no border survives on
    // either summary CTA (SupprButton owns fill/border/radius). Pin that the
    // old outline grammar is gone so a revert is caught.
    const start = MOBILE_SRC.indexOf("summaryPrimaryBtn: {");
    const end = MOBILE_SRC.indexOf("summarySecondaryText:");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const styleBlock = MOBILE_SRC.slice(start, end);
    expect(styleBlock).not.toContain("borderWidth");
    expect(styleBlock).not.toContain("borderColor");
  });

  it("Generate label stays sans (Type.button), never serif", () => {
    const start = MOBILE_SRC.indexOf("summaryPrimaryText:");
    const line = MOBILE_SRC.slice(start, start + 120);
    expect(line).toContain("Type.button");
  });
});
