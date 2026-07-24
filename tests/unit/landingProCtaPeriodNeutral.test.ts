/**
 * ENG-1489 — the landing Pro pricing card leads with the MONTHLY price
 * (the trial is annual-only), so a "Start free trial" CTA there is a CMA
 * mismatch: a trial claim next to a no-trial default. The card's CTA is
 * period-neutral ("Get started"); the trial is still offered downstream
 * in the onboarding upgrade step, which correctly defaults to the
 * annual/trial SKU.
 *
 * Source-level guard (the landing page pulls Next/Link + client hooks
 * that aren't worth mounting for a copy assertion). It pins that NO
 * landing CTA re-introduces a "Start free trial" claim. Note: the two
 * onboarding-upgrade "Start free trial" CTAs live in separate files
 * (src/app/components/onboarding/steps/upgrade.tsx + the mobile mirror)
 * and are intentionally NOT covered here — they already land on a
 * trial-default paywall (ENG-1241 / legal C2) and remain correct.
 *
 * Scans the whole `app/(landing)` route group, not `LandingPage.tsx` alone.
 * The Pro pricing card this test is named for lives in `Pricing.tsx`, and the
 * design-consistency pass (2026-07-24) moved the shared sign-up label into
 * `landingLinks.ts` (`SIGNUP_CTA_LABEL`) — reading one file meant the guard
 * had drifted off its own subject.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING_DIR = resolve(__dirname, "../../app/(landing)");

describe("landing page — ENG-1489 period-neutral Pro CTA", () => {
  const src = readdirSync(LANDING_DIR)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .sort()
    .map((f) => readFileSync(join(LANDING_DIR, f), "utf8"))
    .join("\n");

  it('no landing CTA claims "Start free trial" (the card leads with the no-trial monthly price)', () => {
    expect(src).not.toContain("Start free trial");
  });

  it("the Pro card CTA is period-neutral", () => {
    expect(src).toContain("Get started");
  });
});
