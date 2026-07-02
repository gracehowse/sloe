/**
 * Coach screen analytics parity (ENG-1288, 2026-07-01).
 *
 * Pins that BOTH Coach screens — mobile `apps/mobile/app/coach.tsx` and
 * web `src/app/components/suppr/coach-screen-client.tsx` — fire the
 * same Coach analytics events on the equivalent user moments:
 *
 *   - `meal_coach_suggestion_shown` when the ranked suggestions render,
 *     with `source` PULLED from `useCoach` (the sweep V1/V2 c10 finding:
 *     both screens previously discarded `source`, leaving the registered
 *     event with zero emit sites).
 *   - `coach_ask_answered` when an Ask-the-coach answer resolves — the
 *     completion pair for `coach_ask_chip_tapped` (tap-only). The
 *     client-side template fallback must emit `source: "template"` so
 *     template answers are not undercounted.
 *
 * This is a structural source-level test (`cookAnalyticsParity.test.ts`
 * pattern) because the coach screens use Expo Router / RN + Next client
 * components that the vitest environment cannot cheaply render.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(__dirname, "../../app/coach.tsx");
const WEB_PATH = resolve(
  __dirname,
  "../../../../src/app/components/suppr/coach-screen-client.tsx",
);
const MOBILE = readFileSync(MOBILE_PATH, "utf8");
const WEB = readFileSync(WEB_PATH, "utf8");

describe.each([
  ["mobile", MOBILE],
  ["web", WEB],
])("coach screen analytics (%s)", (_platform, SOURCE) => {
  it("pulls `source` from useCoach instead of discarding it", () => {
    expect(SOURCE).toMatch(
      /const\s*\{\s*candidates,\s*source,\s*refining\s*\}\s*=\s*useCoach\(/,
    );
  });

  it("fires meal_coach_suggestion_shown with the required payload keys", () => {
    const m = SOURCE.match(
      /track\(\s*AnalyticsEvents\.meal_coach_suggestion_shown\s*,\s*\{([\s\S]*?)\}\s*\)/,
    );
    expect(m).not.toBeNull();
    const body = m![1];
    for (const key of ["source", "candidateCount", "slot", "platform"]) {
      expect(body).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });

  it("guards the shown event with a once-per-view ref", () => {
    expect(SOURCE).toMatch(/suggestionShownRef/);
    expect(SOURCE).toMatch(/suggestionShownRef\.current\s*=\s*true/);
  });

  it("fires coach_ask_answered on answer resolution", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.coach_ask_answered\b/);
  });

  it("emits source:\"template\" from the client-side template fallback (not undercounted)", () => {
    // Both fallback arms (non-ok response shape + thrown fetch error)
    // must resolve the ask funnel as a template answer.
    const templateEmits = SOURCE.match(/emitAnswered\(\s*"template"\s*\)/g) ?? [];
    expect(templateEmits.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the ENG-1240 tap + open events alongside the new completion pair", () => {
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.coach_ask_chip_tapped\b/);
    expect(SOURCE).toMatch(/track\(\s*AnalyticsEvents\.coach_screen_opened\b/);
  });
});

describe("coach screen analytics parity (web ↔ mobile)", () => {
  it("mobile declares platform: \"mobile\" and web declares platform: \"web\" on the new events", () => {
    expect(MOBILE).toMatch(/platform:\s*"mobile"/);
    expect(MOBILE).not.toMatch(/platform:\s*"web"/);
    expect(WEB).toMatch(/platform:\s*"web"/);
    expect(WEB).not.toMatch(/platform:\s*"mobile"/);
  });
});
