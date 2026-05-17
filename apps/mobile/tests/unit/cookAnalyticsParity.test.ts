/**
 * Mobile cook-mode analytics parity (audit R2, 2026-04-18; updated
 * 2026-04-30 for parsed-duration countdown timers).
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
 *   - `recipe_timer_completed` on count-down completion when the timer
 *     was parsed from step text (web parity: CookMode.tsx:197).
 *
 * Mobile-specific note (2026-04-30):
 *   - The manual stopwatch path (no parsed duration) still has no
 *     natural completion event; `recipe_timer_completed` only fires
 *     on the count-down branch, where elapsed >= duration. This matches
 *     web semantics where every web timer is a countdown.
 *   - The `seconds` payload is included on countdowns and omitted on
 *     stopwatch starts so the dashboard can distinguish them.
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
      /AnalyticsEvents[^;]*from\s+["']@suppr\/shared\/analytics\/events["']/,
    );
  });

  it("fires cook_mode_opened (web parity: CookMode.tsx:114)", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.cook_mode_opened\b/);
  });

  it("fires recipe_timer_started (web parity: CookMode.tsx:226 — the R2 gap)", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.recipe_timer_started\b/);
  });

  it("fires recipe_timer_completed on parsed-duration countdown completion", () => {
    // Audit 2026-04-30 added count-down support. When the step text
    // contained a parseable duration ("bake 25 minutes") the mobile
    // timer counts DOWN and has a natural completion moment — at which
    // point we emit `recipe_timer_completed` with the same payload
    // shape as web (`{ recipeId, seconds }`).
    expect(SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.recipe_timer_completed\b/,
    );
  });
});
