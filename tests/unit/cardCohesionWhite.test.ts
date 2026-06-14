/**
 * ENG-1081 — card-fill cohesion (Grace 2026-06-13: "flat white for now, maybe
 * circle back"). The Progress "This Week" insight card and the Settings "Sloe
 * Pro" banner used a ~12-16% lilac/primary wash that read as a lone grey card
 * beside white siblings. They now render flat WHITE, flag-gated on
 * `card_cohesion_white_v1` (default-on) with the legacy tint in the flag-off
 * path for a possible Option-C accent revisit.
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

describe("ENG-1081 — Progress insight card flips to white (flag-gated)", () => {
  it("mobile ProgressHeadline: white slab by default, lilac wash in the else", () => {
    expect(M_HEADLINE).toMatch(FLAG);
    expect(M_HEADLINE).toMatch(/cohesionWhite[\s\S]{0,80}colors\.card[\s\S]{0,80}PROGRESS_INSIGHT_LILAC_BG/);
  });

  it("mobile ProgressStoryGate twins the headline (no tone change on unlock)", () => {
    expect(M_GATE).toMatch(FLAG);
    expect(M_GATE).toMatch(/cohesionWhite[\s\S]{0,80}colors\.card[\s\S]{0,80}PROGRESS_INSIGHT_LILAC_BG/);
  });

  it("web progress-headline drops the lilac style override when white", () => {
    expect(W_HEADLINE).toMatch(FLAG);
    expect(W_HEADLINE).toMatch(/cohesionWhite \? undefined : PROGRESS_INSIGHT_LILAC_STYLE/);
  });

  it("web progress-story-gate twins the headline", () => {
    expect(W_GATE).toMatch(FLAG);
    expect(W_GATE).toMatch(/cohesionWhite \? undefined : PROGRESS_INSIGHT_LILAC_STYLE/);
  });
});

describe("ENG-1081 — Settings 'Sloe Pro' banner flips to white (flag-gated)", () => {
  it("mobile Pro banner: white slab + hairline by default, aubergine tint in the else", () => {
    expect(M_SETTINGS).toMatch(FLAG);
    expect(M_SETTINGS).toMatch(/cohesionWhite[\s\S]{0,120}colors\.card[\s\S]{0,120}accent\.primarySoft/);
    expect(M_SETTINGS).toMatch(/cohesionWhite[\s\S]{0,120}colors\.cardBorder/);
  });

  it("web Pro banner: var(--card) + border by default, primary tint in the else", () => {
    expect(W_SETTINGS).toMatch(FLAG);
    expect(W_SETTINGS).toMatch(/cohesionWhite[\s\S]{0,80}var\(--card\)[\s\S]{0,120}color-mix\(in srgb, var\(--primary\) 16%/);
    expect(W_SETTINGS).toMatch(/cohesionWhite \?.{0,60}border:/);
  });
});

describe("ENG-1081 — flag registered default-on, both platforms", () => {
  it("is in both REDESIGN_DEFAULT_ON sets", () => {
    expect(read("apps/mobile/lib/analytics.ts")).toMatch(/"card_cohesion_white_v1"/);
    expect(read("src/lib/analytics/track.ts")).toMatch(/"card_cohesion_white_v1"/);
  });
});
