/**
 * Onboarding handoff — no price shock (audit 2026-04-30).
 *
 * Cal AI's failure pattern: hide the paywall until the user has spent
 * 6 minutes on onboarding answering body-stat questions, then surprise
 * them with a $79.99 annual sticker. Suppr's terminal step routes
 * directly to `/(tabs)?onboarding_complete=1&firstRun=1` — never to
 * the paywall — so the user lands inside the product first and
 * encounters the paywall only when they hit a Pro-gated entry point.
 *
 * This test guards that the handoff stays Today-first. If anyone
 * later re-routes onboarding into `/paywall`, the test breaks and
 * the change has to make the price visible from screen 1 of the
 * paywall (which it already is — the trust strip + tier card render
 * before any user input).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FLOW_PATH = resolve(
  __dirname,
  "../../components/onboarding/mobile-flow.tsx",
);

describe("mobile onboarding — no post-onboarding paywall hop", () => {
  const src = readFileSync(FLOW_PATH, "utf8");

  it("terminal-step completion routes to /(tabs), not /paywall", () => {
    // The successful completion branch lands on Today directly. A
    // future regression that adds `router.replace("/paywall")` here
    // would price-shock users — surface that as a test failure so
    // the regression is forced to think about price-visibility.
    // 2026-05-11 (refresh-plan flow): the route call now carries an
    // `as any` cast because the homeQs branches between
    // `&firstRun=1` (true first-time completion) and `&refresh=1`
    // (Settings → Refresh my plan). Match the prefix substring so
    // the test stays implementation-flexible.
    expect(src).toMatch(/router\.replace\(`\/\(tabs\)\$\{homeQs\}`/);
    expect(src).not.toMatch(/router\.replace\(\s*["'`]\/paywall/);
  });

  it("handoff query string carries firstRun=1 for first-time completion", () => {
    // 2026-05-11 (refresh-plan flow): refresh-plan branch uses
    // `&refresh=1` instead of `&firstRun=1` so Today can skip the
    // first-run polish on a re-run. First-time completion path must
    // still set firstRun.
    expect(src).toContain("&firstRun=1");
    expect(src).toContain("onboarding_complete=1");
  });
});
