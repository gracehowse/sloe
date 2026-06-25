/**
 * Onboarding welcome — v3 deep-plum brand screen (ENG-1247 M1).
 *
 * The adversarial review caught that the deep-plum brand welcome had landed
 * MOBILE-ONLY — the web twin still rendered the old oat ground + success/
 * macro-fat radial washes + floating product-preview tiles. This pins the
 * fixed treatment on BOTH platforms so the parity can't drift again:
 *   - deep-plum ground (web `--primary-deep` / mobile `Accent.primaryDeep`),
 *   - lowercase Fraunces "sloe" wordmark + italic serif tagline,
 *   - white "Get started" CTA + "Private by default / About a minute" footer,
 *   - and the old oat/green/preview treatment is GONE on web.
 *
 * Source-level structural check (the rendered pixels are covered by the
 * gate15 Playwright visual snapshots).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, "..", "..", rel), "utf8");
const WEB = read("src/app/components/onboarding/steps/welcome.tsx");
const MOBILE = read("apps/mobile/components/onboarding/steps/welcome.tsx");

describe("Onboarding welcome — deep-plum brand screen (ENG-1247 M1)", () => {
  it("web renders the deep-plum brand ground, not the retired oat/green washes", () => {
    expect(WEB).toMatch(/var\(--primary-deep\)/);
    expect(WEB).not.toMatch(/bg-background/);
    // The retired success/macro-fat gradient washes + preview tiles are gone.
    expect(WEB).not.toMatch(/--success|--macro-fat/);
    expect(WEB).not.toMatch(/FloatingPreview|WebWelcomeVisual|Checkline/);
  });

  it("web shows the lowercase Fraunces wordmark + italic frost tagline", () => {
    expect(WEB).toMatch(/font-\[family-name:var\(--font-brand\)\]/);
    expect(WEB).toMatch(/>\s*sloe\s*</);
    expect(WEB).toMatch(/var\(--accent-frost\)/);
    expect(WEB).toMatch(/italic/);
  });

  it("web preserves the onboarding contract (Get started → track + go(1); login link)", () => {
    expect(WEB).toMatch(/onboarding_step_completed/);
    expect(WEB).toMatch(/go\(1\)/);
    expect(WEB).toMatch(/"\/login"/);
  });

  it("web + mobile share the brand screen, tagline, CTA + trust footer (parity)", () => {
    for (const src of [WEB, MOBILE]) {
      expect(src).toMatch(/>\s*sloe\s*</);
      expect(src).toMatch(/Cook what you love\. Still reach your goals\./);
      expect(src).toMatch(/Get started/);
      expect(src).toMatch(/Private by default/);
      expect(src).toMatch(/About a minute/);
    }
    // Both grounds are the fixed deep-plum (web token / mobile constant).
    expect(WEB).toMatch(/var\(--primary-deep\)/);
    expect(MOBILE).toMatch(/Accent\.primaryDeep/);
  });
});
