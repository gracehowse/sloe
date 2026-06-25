// @vitest-environment jsdom
/**
 * ENG-1187 — onboarding jargon gloss (TDEE / BMR / Mifflin-St Jeor).
 *
 * Three contracts pinned here:
 *
 * 1. SHARED COPY — the glossed + plain labels live in ONE module
 *    (`src/lib/onboarding/figmaCopy.ts`) that both web and mobile import
 *    via the `@suppr/shared/onboarding/figmaCopy` alias. The strings can
 *    therefore never drift between platforms; this test pins their shape
 *    (lead with the plain phrase, acronym secondary in parens) and that
 *    the gloss differs from the plain default.
 *
 * 2. RENDER-SITE WIRING — every trust-moment render site
 *    (web + mobile pace tile, web + mobile reveal BMR/TDEE/Mifflin) pulls
 *    the label from the shared constants behind
 *    `isFeatureEnabled("onboarding_jargon_gloss_v1")`, never an inline
 *    string. Source-level pins so a regression that re-hardcodes a label
 *    or drops the flag gate breaks the build.
 *
 * 3. FLAG GATING — `onboarding_jargon_gloss_v1` is DEFAULT-OFF: it is not
 *    in either platform's `REDESIGN_DEFAULT_ON` set, resolves OFF when
 *    PostHog is cold, and the web `isFeatureEnabled` flips ON only when
 *    PostHog (or a dev force) says so.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS,
  ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN,
  ONBOARDING_REVEAL_BMR_LABEL_GLOSS,
  ONBOARDING_REVEAL_BMR_LABEL_PLAIN,
  ONBOARDING_REVEAL_METHODOLOGY_GLOSS,
  ONBOARDING_REVEAL_METHODOLOGY_PLAIN,
  ONBOARDING_REVEAL_TDEE_LABEL_GLOSS,
  ONBOARDING_REVEAL_TDEE_LABEL_PLAIN,
} from "../../src/lib/onboarding/figmaCopy";

const FLAG = "onboarding_jargon_gloss_v1";
const ROOT = resolve(__dirname, "../..");

const GLOSS_PLAIN_PAIRS: ReadonlyArray<{
  name: string;
  plain: string;
  gloss: string;
  acronym: string;
}> = [
  {
    name: "pace vs-TDEE label",
    plain: ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN,
    gloss: ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS,
    acronym: "TDEE",
  },
  {
    name: "reveal BMR label",
    plain: ONBOARDING_REVEAL_BMR_LABEL_PLAIN,
    gloss: ONBOARDING_REVEAL_BMR_LABEL_GLOSS,
    acronym: "BMR",
  },
  {
    name: "reveal TDEE label",
    plain: ONBOARDING_REVEAL_TDEE_LABEL_PLAIN,
    gloss: ONBOARDING_REVEAL_TDEE_LABEL_GLOSS,
    acronym: "TDEE",
  },
];

describe("ENG-1187 — glossed copy shape (shared web ↔ mobile)", () => {
  it("each glossed label differs from its plain default", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      expect(pair.gloss, pair.name).not.toBe(pair.plain);
    }
    expect(ONBOARDING_REVEAL_METHODOLOGY_GLOSS).not.toBe(
      ONBOARDING_REVEAL_METHODOLOGY_PLAIN,
    );
  });

  it("each glossed label keeps the acronym secondary in parentheses", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      expect(pair.gloss, pair.name).toContain(`(${pair.acronym})`);
    }
  });

  it("each glossed label leads with a plain-English phrase, not the bare acronym", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      // The acronym must appear AFTER some leading plain text — i.e. the
      // first word is never the bare acronym (e.g. not "TDEE (…)").
      const firstToken = pair.gloss.trimStart().split(/\s+/)[0];
      expect(firstToken, `${pair.name} leads with plain phrase`).not.toBe(
        pair.acronym,
      );
      expect(pair.gloss.indexOf(`(${pair.acronym})`)).toBeGreaterThan(0);
    }
  });

  it("the Mifflin-St Jeor note adds a plain-English description of the formula", () => {
    expect(ONBOARDING_REVEAL_METHODOLOGY_PLAIN).toContain("Mifflin-St Jeor");
    expect(ONBOARDING_REVEAL_METHODOLOGY_GLOSS).toContain("Mifflin-St Jeor");
    // The gloss explains what the formula is in plain English.
    expect(ONBOARDING_REVEAL_METHODOLOGY_GLOSS.toLowerCase()).toContain(
      "standard formula",
    );
    expect(ONBOARDING_REVEAL_METHODOLOGY_GLOSS.toLowerCase()).toContain(
      "calories you burn",
    );
  });

  it("glossed copy stays in the calm-coach voice (no shaming / health claims)", () => {
    const allGloss = [
      ...GLOSS_PLAIN_PAIRS.map((p) => p.gloss),
      ONBOARDING_REVEAL_METHODOLOGY_GLOSS,
    ].join(" ");
    // Trust posture: nutrition stays estimated; no absolute claims.
    expect(allGloss).not.toMatch(/\bguarantee/i);
    expect(allGloss).not.toMatch(/\blose \d+\s*(kg|lbs?)/i);
  });
});

describe("ENG-1187 — render sites pull shared constants behind the flag", () => {
  const sites: ReadonlyArray<{ path: string; constants: string[] }> = [
    {
      path: "src/app/components/onboarding/steps/pace.tsx",
      constants: [
        "ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS",
        "ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN",
      ],
    },
    {
      path: "src/app/components/onboarding/steps/reveal.tsx",
      constants: [
        "ONBOARDING_REVEAL_BMR_LABEL_GLOSS",
        "ONBOARDING_REVEAL_TDEE_LABEL_GLOSS",
        "ONBOARDING_REVEAL_METHODOLOGY_GLOSS",
      ],
    },
    {
      path: "apps/mobile/components/onboarding/steps/pace.tsx",
      constants: [
        "ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS",
        "ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN",
      ],
    },
    {
      path: "apps/mobile/components/onboarding/steps/reveal.tsx",
      constants: [
        "ONBOARDING_REVEAL_BMR_LABEL_GLOSS",
        "ONBOARDING_REVEAL_TDEE_LABEL_GLOSS",
        "ONBOARDING_REVEAL_METHODOLOGY_GLOSS",
      ],
    },
  ];

  for (const site of sites) {
    it(`${site.path} gates the gloss behind ${FLAG} and uses shared constants`, () => {
      const src = readFileSync(resolve(ROOT, site.path), "utf8");
      expect(src).toContain(`isFeatureEnabled("${FLAG}")`);
      for (const c of site.constants) {
        expect(src, `${site.path} references ${c}`).toContain(c);
      }
    });
  }

  it("no render site re-hardcodes a glossed/plain label inline", () => {
    // The literal default strings must NOT appear as a JSX text node — they
    // should only flow through the shared constants. We assert the inline
    // forms that previously existed are gone.
    const welcome = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/welcome.tsx"),
      "utf8",
    );
    expect(welcome).not.toContain(
      "<Checkline>Adaptive TDEE that learns from you</Checkline>",
    );
    const webPace = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/pace.tsx"),
      "utf8",
    );
    expect(webPace).not.toContain('className="section-label mb-1">vs. your TDEE');
    const mobileReveal = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/reveal.tsx"),
      "utf8",
    );
    expect(mobileReveal).not.toContain(">BMR</Text>");
    expect(mobileReveal).not.toContain(">Est. TDEE</Text>");
  });
});

describe("ENG-1187 — flag is default-OFF on both platforms", () => {
  it("onboarding_jargon_gloss_v1 is NOT in either platform's REDESIGN_DEFAULT_ON set", () => {
    const webTrack = readFileSync(
      resolve(ROOT, "src/lib/analytics/track.ts"),
      "utf8",
    );
    const mobileAnalytics = readFileSync(
      resolve(ROOT, "apps/mobile/lib/analytics.ts"),
      "utf8",
    );
    // The flag must not be registered in any default-on registry — that
    // would make meaning-changing copy ship un-ramped.
    expect(webTrack).not.toContain(FLAG);
    expect(mobileAnalytics).not.toContain(FLAG);
  });
});

describe("ENG-1187 — web isFeatureEnabled gates the flag", () => {
  beforeEach(() => {
    delete (window as { __SUPPR_FORCE_FLAGS__?: unknown }).__SUPPR_FORCE_FLAGS__;
    try {
      window.localStorage.clear();
    } catch {
      /* storage denied in env — ignore */
    }
  });
  afterEach(() => {
    delete (window as { __SUPPR_FORCE_FLAGS__?: unknown }).__SUPPR_FORCE_FLAGS__;
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("resolves OFF by default (cold PostHog, no force) — plain copy ships", async () => {
    const { isFeatureEnabled, __resetForcedFlagSeedForTests } = await import(
      "@/lib/analytics/track"
    );
    __resetForcedFlagSeedForTests();
    // No NEXT_PUBLIC_POSTHOG_KEY in the unit env → un-registered flag
    // resolves false (not in REDESIGN_DEFAULT_ON either). This is the
    // default-OFF posture that ships the plain labels.
    expect(isFeatureEnabled(FLAG)).toBe(false);
  });

  it("flips ON when forced on via the dev/test force hook — glossed copy ships", async () => {
    const { isFeatureEnabled, __resetForcedFlagSeedForTests } = await import(
      "@/lib/analytics/track"
    );
    (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ =
      { [FLAG]: true };
    __resetForcedFlagSeedForTests();
    expect(isFeatureEnabled(FLAG)).toBe(true);
    // And an explicit force-off stays OFF (kill switch / pre-gloss capture).
    (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ =
      { [FLAG]: false };
    __resetForcedFlagSeedForTests();
    expect(isFeatureEnabled(FLAG)).toBe(false);
  });
});
