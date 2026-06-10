/**
 * Unified serif screen titles — Sloe Spec 3 (2026-06-09).
 *
 * ui-product-designer consolidated five hand-rolled push-screen H1s (Targets
 * was genuinely Inter; Health-Sync serif 28/700; Household serif 28/600;
 * Weight & Trends `Type.display`-at-28; Nutrition-sources `Type.title`) onto
 * ONE token, `Type.screenTitle` (Newsreader serif 28/34, weight 600). The
 * compact nav-bar-row title voice moves to `Type.navTitle` (serif 18/22,
 * weight 500), wired through the single shared `PushScreenHeader` lever.
 *
 * This is a source-level structural pin: it breaks if any of those screens
 * regresses to an ad-hoc `fontFamily` / `fontSize` / `fontWeight` header, or
 * if the two tokens drift from the spec's metrics. Web parity for the mirror
 * classes (`.screen-title` / `.nav-title`) lives in
 * `tests/unit/screenTitleSerifWeb.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Type, FontFamily } from "../../constants/theme";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const TARGETS = read("app/targets.tsx");
const HEALTH = read("app/health-sync.tsx");
const HOUSEHOLD = read("app/household-settings.tsx");
const WEIGHT = read("app/weight-tracker.tsx");
const NUTRITION_SOURCES = read("app/nutrition-sources.tsx");
const PUSH_HEADER = read("components/PushScreenHeader.tsx");

describe("Type tokens — screenTitle / navTitle metrics (Spec 3)", () => {
  it("screenTitle is Newsreader serifSemibold 28/34, weight 600, tracking -0.3", () => {
    expect(Type.screenTitle.fontFamily).toBe(FontFamily.serifSemibold);
    expect(Type.screenTitle.fontSize).toBe(28);
    expect(Type.screenTitle.lineHeight).toBe(34);
    expect(Type.screenTitle.fontWeight).toBe("600");
    expect(Type.screenTitle.letterSpacing).toBe(-0.3);
  });

  it("navTitle is Newsreader serifMedium 18/22, weight 500, tracking -0.1", () => {
    expect(Type.navTitle.fontFamily).toBe(FontFamily.serifMedium);
    expect(Type.navTitle.fontSize).toBe(18);
    expect(Type.navTitle.lineHeight).toBe(22);
    expect(Type.navTitle.fontWeight).toBe("500");
    expect(Type.navTitle.letterSpacing).toBe(-0.1);
  });
});

describe("Unified serif screen titles — the five in-body H1s use Type.screenTitle", () => {
  it("Targets 'Daily targets' is on Type.screenTitle (the one real Inter→serif fix)", () => {
    expect(TARGETS).toMatch(/title:\s*\{\s*\n\s*\.\.\.Type\.screenTitle/);
    // Must NOT regress to the old hand-rolled Inter 24/700 header.
    expect(TARGETS).not.toMatch(/title:\s*\{[\s\S]{0,80}fontSize:\s*24,\s*\n\s*fontWeight:\s*"700"/);
  });

  it("Health-Sync title is on Type.screenTitle (was serif 28/700)", () => {
    expect(HEALTH).toMatch(/title:\s*\{\s*\n\s*\.\.\.Type\.screenTitle/);
    // The old hand-rolled serif 28/700 header must be gone.
    expect(HEALTH).not.toMatch(/title:\s*\{[\s\S]{0,120}fontSize:\s*28,[\s\S]{0,60}fontWeight:\s*"700"/);
  });

  it("Household title is on Type.screenTitle (was hand-rolled serif 28/600)", () => {
    expect(HOUSEHOLD).toMatch(/\.\.\.Type\.screenTitle[\s\S]{0,80}Household/);
    expect(HOUSEHOLD).not.toMatch(/fontFamily:\s*FontFamily\.serifSemibold,\s*fontSize:\s*28[\s\S]{0,60}Household/);
  });

  it("Weight & Trends title is on Type.screenTitle (was Type.display@28)", () => {
    expect(WEIGHT).toMatch(/headerTitle:\s*\{\s*\n\s*\.\.\.Type\.screenTitle/);
    expect(WEIGHT).not.toMatch(/headerTitle:\s*\{[\s\S]{0,40}\.\.\.Type\.display/);
  });

  it("Nutrition-sources heading is on Type.screenTitle (was Type.title)", () => {
    expect(NUTRITION_SOURCES).toMatch(/heading:\s*\{\s*\.\.\.Type\.screenTitle/);
    expect(NUTRITION_SOURCES).not.toMatch(/heading:\s*\{\s*\.\.\.Type\.title/);
  });
});

describe("PushScreenHeader — the single shared nav-title lever (Spec 3)", () => {
  it("renders the title with Type.navTitle, not Type.headline", () => {
    expect(PUSH_HEADER).toMatch(/\.\.\.Type\.navTitle,\s*color:\s*colors\.text[\s\S]{0,40}\{title\}/);
    expect(PUSH_HEADER).not.toMatch(/\.\.\.Type\.headline,\s*color:\s*colors\.text[\s\S]{0,40}\{title\}/);
  });
});
