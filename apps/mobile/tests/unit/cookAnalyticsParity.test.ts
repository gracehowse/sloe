/**
 * Mobile cook-mode analytics parity (audit R2, 2026-04-18).
 *
 * Pins that `apps/mobile/app/cook.tsx` fires the same analytics events
 * that web `src/app/components/CookMode.tsx` fires on the equivalent
 * user actions. Mobile previously silent for an entire sprint — see
 * `docs/planning/post-feature-expansion-audit-2026-04-18-verification.md`.
 *
 * This is a structural source-level test because the mobile cook screen
 * uses Expo Router + expo-keep-awake + react-native components that the
 * vitest/jsdom environment cannot render — RNTL install (R7 backlog)
 * would replace this with a real render test.
 *
 * Events under test:
 *   - `cook_mode_opened` on screen mount (web `CookMode.tsx:114`).
 *   - `recipe_timer_started` on timer start (web `CookMode.tsx:226`).
 *
 * Intentional mobile divergence (documented in the report):
 *   - `recipe_timer_completed` is NOT fired on mobile. The mobile timer
 *     is a count-up stopwatch with no natural completion event — the
 *     user always presses Stop. Firing it on Stop would conflate "user
 *     cancelled" with the web countdown's "timer hit zero".
 *   - Mobile `recipe_timer_started` payload omits `seconds` because the
 *     mobile stopwatch has no pre-set duration at start time. Emitting
 *     a placeholder value would poison the dashboard.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const SOURCE = readFileSync(COOK_PATH, "utf8");

describe("mobile cook analytics parity (audit R2)", () => {
  it("imports track from the mobile analytics module", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/lib\/analytics["']/);
    expect(SOURCE).toMatch(/\bimport\b[^;]*\btrack\b[^;]*@\/lib\/analytics/);
  });

  it("imports AnalyticsEvents from the shared events module", () => {
    // Same import path as every other mobile file (parity with
    // PhotoLogSheet, VoiceLogSheet, more.tsx, planner.tsx …).
    expect(SOURCE).toMatch(
      /AnalyticsEvents[^;]*from\s+["']\.\.\/\.\.\/\.\.\/src\/lib\/analytics\/events["']/,
    );
  });

  it("fires cook_mode_opened (web parity: CookMode.tsx:114)", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.cook_mode_opened\b/);
  });

  it("fires recipe_timer_started (web parity: CookMode.tsx:226 — the R2 gap)", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.recipe_timer_started\b/);
  });

  it("documents why recipe_timer_completed is intentionally NOT fired on mobile", () => {
    // This guard is what prevents someone "adding the missing event"
    // without realising the mobile stopwatch has no completion moment.
    // If you want to remove it, you must also change the mobile timer
    // to a countdown with a preset duration.
    // Collapse whitespace + comment-line prefixes so the match is
    // resilient to JSDoc-style line wrapping.
    const collapsed = SOURCE.replace(/\s*\/\/\s*/g, " ").replace(/\s+/g, " ");
    expect(collapsed).toMatch(/recipe_timer_completed.{0,40}not fired on mobile/i);
  });
});
