/**
 * ENG-1081 — card-fill cohesion (Grace 2026-06-13: "flat white for now, maybe
 * circle back"). The Progress "This Week" insight card and the Settings "Sloe
 * Pro" banner used a ~12-16% lilac/primary wash that read as a lone grey card
 * beside white siblings. They render flat WHITE.
 *
 * ENG-1356 (flag-collapse sweep, 2026-07-06): `card_cohesion_white_v1` was
 * always-on in production (REDESIGN_DEFAULT_ON) and is now collapsed — the
 * flag check and the legacy lilac/primary-tint (flag-off) branch are gone;
 * only the white-slab path remains.
 *
 * Structural source test (reads the files) so one spec covers both platforms,
 * matching `discoverThreeSectionLayout.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const M_HEADLINE = read("apps/mobile/components/today/ProgressHeadline.tsx");
const M_GATE = read("apps/mobile/components/today/ProgressStoryGate.tsx");
const M_SETTINGS = read("apps/mobile/components/settings/SettingsBundleContent.tsx");
const W_HEADLINE = read("src/app/components/suppr/progress-headline.tsx");
const W_GATE = read("src/app/components/suppr/progress-story-gate.tsx");
const W_SETTINGS = read("src/app/components/Settings.tsx");

const FLAG = /isFeatureEnabled\("card_cohesion_white_v1"\)/;
const COHESION_WHITE_VAR = /\bcohesionWhite\b/;

describe("ENG-1081 — Progress insight card is an unconditional white slab (ENG-1356 collapse)", () => {
  it("mobile ProgressHeadline: no flag check, no legacy lilac wash", () => {
    expect(M_HEADLINE).not.toMatch(FLAG);
    expect(M_HEADLINE).not.toMatch(COHESION_WHITE_VAR);
    expect(M_HEADLINE).not.toMatch(/PROGRESS_INSIGHT_LILAC_BG/);
    expect(M_HEADLINE).toMatch(/backgroundColor:\s*cardElevation\.liftBg \?\? colors\.card/);
  });

  it("mobile ProgressStoryGate twins the headline (no tone change on unlock)", () => {
    expect(M_GATE).not.toMatch(FLAG);
    expect(M_GATE).not.toMatch(COHESION_WHITE_VAR);
    expect(M_GATE).not.toMatch(/PROGRESS_INSIGHT_LILAC_BG/);
    expect(M_GATE).toMatch(/backgroundColor:\s*cardElevation\.liftBg \?\? colors\.card/);
  });

  it("web progress-headline: no flag check, no lilac style override", () => {
    expect(W_HEADLINE).not.toMatch(FLAG);
    expect(W_HEADLINE).not.toMatch(COHESION_WHITE_VAR);
    expect(W_HEADLINE).not.toMatch(/PROGRESS_INSIGHT_LILAC_STYLE/);
  });

  it("web progress-story-gate twins the headline", () => {
    expect(W_GATE).not.toMatch(FLAG);
    expect(W_GATE).not.toMatch(COHESION_WHITE_VAR);
    expect(W_GATE).not.toMatch(/PROGRESS_INSIGHT_LILAC_STYLE/);
  });
});

describe("ENG-1081 — Settings 'Sloe Pro' banner is an unconditional white slab (ENG-1356 collapse)", () => {
  it("mobile Pro banner: white slab + hairline, no flag / aubergine-tint else", () => {
    expect(M_SETTINGS).not.toMatch(FLAG);
    expect(M_SETTINGS).not.toMatch(COHESION_WHITE_VAR);
    expect(M_SETTINGS).toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,700}backgroundColor:\s*statTileElevation\.liftBg \?\? colors\.card/,
    );
    expect(M_SETTINGS).toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,800}borderColor:\s*colors\.cardBorder/,
    );
  });

  it("web Pro banner: white card-slab shell, no flag / primary-tint else", () => {
    expect(W_SETTINGS).not.toMatch(FLAG);
    expect(W_SETTINGS).not.toMatch(COHESION_WHITE_VAR);
    expect(W_SETTINGS).not.toMatch(/color-mix\(in srgb, var\(--primary\) 16%/);
    // ENG-1500: the bespoke inline `var(--card)` fill + 0.5px hairline moved
    // to the standard `.card-slab` treatment (white fill + 1px `--border`).
    expect(W_SETTINGS).toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,400}rounded-card-lg card-slab/,
    );
  });
});

describe("ENG-1081 — flag fully retired from both REDESIGN_DEFAULT_ON sets", () => {
  it("is absent from both sets (no live call sites remain)", () => {
    expect(read("apps/mobile/lib/analytics.ts")).not.toMatch(/"card_cohesion_white_v1"/);
    expect(read("src/lib/analytics/track.ts")).not.toMatch(/"card_cohesion_white_v1"/);
  });
});
