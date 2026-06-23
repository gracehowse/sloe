/**
 * ENG-1230 — cook-mode timer parity for the LIVE inline overlay.
 *
 * The "Start Cooking" button opens the inline cook overlay inside
 * `app/recipe/[id].tsx` (the `CookStepSwipeSurface` path), NOT the
 * orphaned standalone `app/cook.tsx` route. Before this fix the inline
 * overlay had ZERO timers, while web `CookMode.tsx` and the orphaned
 * mobile `cook.tsx` both have full step timers — an unflagged parity
 * break: the cook path the user actually reaches was missing timers that
 * exist elsewhere in the codebase AND on web.
 *
 * This pins that the inline overlay now wires `CookTimerPanel`, and that
 * the panel REUSES the existing timer primitives (`useCookRunningTimers`
 * + `CookRunningTimerStrip` + `CookStepTimerPills`) rather than rebuilding
 * them. It parses timers off the RAW cleaned step (pre-scale) so offsets
 * stay stable across scale changes, matching web.
 *
 * Source-level tests because the mobile cook surfaces use Expo Router +
 * react-native primitives that vitest/jsdom can't render — same precedent
 * as `cookWatchOriginalParity.test.ts` / `cookMultiTimers.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RECIPE_PATH = resolve(__dirname, "../../app/recipe/[id].tsx");
const PANEL_PATH = resolve(
  __dirname,
  "../../components/cook/CookTimerPanel.tsx",
);

const RECIPE_SOURCE = readFileSync(RECIPE_PATH, "utf8");
const PANEL_SOURCE = readFileSync(PANEL_PATH, "utf8");

describe("ENG-1230 inline cook overlay — timer wiring (recipe/[id].tsx)", () => {
  it("imports CookTimerPanel from the cook components dir", () => {
    expect(RECIPE_SOURCE).toMatch(
      /import\s*\{\s*CookTimerPanel\s*\}\s*from\s+["']@\/components\/cook\/CookTimerPanel["']/,
    );
  });

  it("renders CookTimerPanel inside the inline overlay", () => {
    expect(RECIPE_SOURCE).toMatch(/<CookTimerPanel\b/);
  });

  it("gates the panel behind cook_multi_timers_v1 (parity with web + cook.tsx)", () => {
    expect(RECIPE_SOURCE).toMatch(
      /<CookTimerPanel[\s\S]*?enabled=\{\s*isFeatureEnabled\(\s*["']cook_multi_timers_v1["']\s*\)\s*\}/,
    );
  });

  it("passes the current cook step index to the panel", () => {
    expect(RECIPE_SOURCE).toMatch(
      /<CookTimerPanel[\s\S]*?stepIndex=\{\s*cookStep\s*\}/,
    );
  });

  it("parses timers off the RAW cleaned step (not the scaled text)", () => {
    // `cleanedStep` is the pre-scale string; `scaledStep` is the rewritten
    // one. Web parses against `currentStepCleaned` for stable offsets — the
    // overlay must hand the panel `cleanedStep`, never `scaledStep`.
    expect(RECIPE_SOURCE).toMatch(
      /<CookTimerPanel[\s\S]*?stepText=\{\s*cleanedStep\s*\}/,
    );
    expect(RECIPE_SOURCE).not.toMatch(
      /<CookTimerPanel[\s\S]*?stepText=\{\s*scaledStep\s*\}/,
    );
  });
});

describe("ENG-1230 CookTimerPanel — reuses existing primitives (no rebuild)", () => {
  it("uses the shared useCookRunningTimers hook", () => {
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*useCookRunningTimers\s*\}\s*from\s+["']@\/hooks\/useCookRunningTimers["']/,
    );
    expect(PANEL_SOURCE).toMatch(/useCookRunningTimers\(/);
  });

  it("renders the existing CookRunningTimerStrip + CookStepTimerPills", () => {
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*CookRunningTimerStrip\s*\}\s*from\s+["']@\/components\/cook\/CookRunningTimerStrip["']/,
    );
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*CookStepTimerPills\s*\}\s*from\s+["']@\/components\/cook\/CookStepTimerPills["']/,
    );
    expect(PANEL_SOURCE).toMatch(/<CookRunningTimerStrip\b/);
    expect(PANEL_SOURCE).toMatch(/<CookStepTimerPills\b/);
  });

  it("parses durations via the shared parseTimersInStep", () => {
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*parseTimersInStep\s*\}\s*from\s+["']@suppr\/nutrition-core\/recipeTimers["']/,
    );
    expect(PANEL_SOURCE).toMatch(/parseTimersInStep\(\s*stepText\s*\)/);
  });

  it("starts a parsed timer stamped with the active step index", () => {
    expect(PANEL_SOURCE).toMatch(/startParsedTimer\(\s*timer\s*,\s*stepIndex\s*\)/);
  });

  it("wires reset + cancel through to the strip", () => {
    expect(PANEL_SOURCE).toMatch(/onReset=\{\s*resetTimer\s*\}/);
    expect(PANEL_SOURCE).toMatch(/onCancel=\{\s*cancelTimer\s*\}/);
  });

  it("flag-off (enabled=false) is a hard revert — renders nothing", () => {
    expect(PANEL_SOURCE).toMatch(/if\s*\(\s*!enabled\s*\)\s*return null/);
  });

  it("only pulses the first pill when no timer is running on this step", () => {
    expect(PANEL_SOURCE).toMatch(/activeStepTimerCount\s*===\s*0/);
    expect(PANEL_SOURCE).toMatch(/timer\.stepIndex\s*===\s*stepIndex/);
  });
});
