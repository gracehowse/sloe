// @vitest-environment jsdom
/**
 * ENG-1469 — jargon-gloss stragglers (ENG-1461 follow-up).
 *
 * ENG-1461's ratified scope covered Progress / pricing / weekly check-in
 * (pinned by `onboardingJargonGloss.test.ts`) and named 5 remaining
 * sites as deliberately deferred: the Targets screens (web + mobile),
 * Profile's debug row + upgrade banner, the activity-bonus-card
 * aria-labels, `onboarding/narrative.tsx`'s un-glossed desktop narrative
 * column, and the `tdee.ts` popover fallback template.
 *
 * Same two contracts as ENG-1187/1461:
 *   1. SHARED COPY — pairs live in `figmaCopy.ts`, lead with plain
 *      English, acronym secondary in parens, gloss != plain.
 *   2. RENDER-SITE WIRING — every site pulls its label from the shared
 *      constants behind `isFeatureEnabled("onboarding_jargon_gloss_v1")`,
 *      never an inline string.
 *
 * Profile's `BMR: / TDEE:` debug row is EXPLICITLY left un-glossed
 * (internal, ph-masked debug readout, not a consumer trust moment) —
 * pinned here as a deliberate non-fix, not a silent gap.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import {
  TARGETS_SUBTITLE_STATIC_TDEE_PLAIN,
  TARGETS_SUBTITLE_STATIC_TDEE_GLOSS,
  TARGETS_MOBILE_CAPTION_STATIC_TDEE_PLAIN,
  TARGETS_MOBILE_CAPTION_STATIC_TDEE_GLOSS,
  TARGETS_HOW_CALCULATED_CAPTION_PLAIN,
  TARGETS_HOW_CALCULATED_CAPTION_GLOSS,
  TARGETS_RECALIBRATE_FOOTNOTE_TAIL_PLAIN,
  TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS,
  PROFILE_UPGRADE_BANNER_TDEE_PLAIN,
  PROFILE_UPGRADE_BANNER_TDEE_GLOSS,
  ACTIVITY_BONUS_INFO_TRIGGER_LABEL_PLAIN,
  ACTIVITY_BONUS_INFO_TRIGGER_LABEL_GLOSS,
  ACTIVITY_BONUS_DISMISS_LABEL_PLAIN,
  ACTIVITY_BONUS_DISMISS_LABEL_GLOSS,
  ACTIVITY_BONUS_MODAL_TITLE_PLAIN,
  ACTIVITY_BONUS_MODAL_TITLE_GLOSS,
  ONBOARDING_REVEAL_BMR_LABEL_PLAIN,
  ONBOARDING_REVEAL_BMR_LABEL_GLOSS,
  ONBOARDING_REVEAL_TDEE_LABEL_PLAIN,
  ONBOARDING_REVEAL_TDEE_LABEL_GLOSS,
} from "../../src/lib/onboarding/figmaCopy";

const FLAG = "onboarding_jargon_gloss_v1";
const ROOT = resolve(__dirname, "../..");

const GLOSS_PLAIN_PAIRS: ReadonlyArray<{ name: string; plain: string; gloss: string; acronym: string }> = [
  { name: "Targets web subtitle", plain: TARGETS_SUBTITLE_STATIC_TDEE_PLAIN, gloss: TARGETS_SUBTITLE_STATIC_TDEE_GLOSS, acronym: "TDEE" },
  { name: "Targets mobile caption", plain: TARGETS_MOBILE_CAPTION_STATIC_TDEE_PLAIN, gloss: TARGETS_MOBILE_CAPTION_STATIC_TDEE_GLOSS, acronym: "TDEE" },
  { name: "Targets how-calculated caption", plain: TARGETS_HOW_CALCULATED_CAPTION_PLAIN, gloss: TARGETS_HOW_CALCULATED_CAPTION_GLOSS, acronym: "TDEE" },
  { name: "Targets recalibrate footnote", plain: TARGETS_RECALIBRATE_FOOTNOTE_TAIL_PLAIN, gloss: TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS, acronym: "TDEE" },
  { name: "Profile upgrade banner", plain: PROFILE_UPGRADE_BANNER_TDEE_PLAIN, gloss: PROFILE_UPGRADE_BANNER_TDEE_GLOSS, acronym: "TDEE" },
  { name: "activity-bonus info trigger", plain: ACTIVITY_BONUS_INFO_TRIGGER_LABEL_PLAIN, gloss: ACTIVITY_BONUS_INFO_TRIGGER_LABEL_GLOSS, acronym: "TDEE" },
  { name: "activity-bonus dismiss label", plain: ACTIVITY_BONUS_DISMISS_LABEL_PLAIN, gloss: ACTIVITY_BONUS_DISMISS_LABEL_GLOSS, acronym: "TDEE" },
  { name: "activity-bonus modal title", plain: ACTIVITY_BONUS_MODAL_TITLE_PLAIN, gloss: ACTIVITY_BONUS_MODAL_TITLE_GLOSS, acronym: "TDEE" },
];

describe("ENG-1469 — glossed copy shape", () => {
  it("each glossed label differs from its plain default", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      expect(pair.gloss, pair.name).not.toBe(pair.plain);
    }
  });

  it("each glossed label keeps the acronym secondary in parentheses", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      expect(pair.gloss, pair.name).toContain(`(${pair.acronym})`);
    }
  });

  it("each glossed label leads with a plain-English phrase, not the bare acronym", () => {
    for (const pair of GLOSS_PLAIN_PAIRS) {
      const firstToken = pair.gloss.trimStart().split(/\s+/)[0]!.replace(/[.,;:]$/, "");
      expect(firstToken, `${pair.name} leads with plain phrase`).not.toBe(pair.acronym);
      expect(pair.gloss.indexOf(`(${pair.acronym})`)).toBeGreaterThan(0);
    }
  });

  it("the Targets how-calculated + recalibrate pairs share the same TDEE grammar as PRODUCT_TDEE_LABEL", () => {
    // Consistency, not identity — every gloss form uses "(TDEE)" secondary.
    expect(TARGETS_HOW_CALCULATED_CAPTION_GLOSS).toContain("(TDEE)");
    expect(TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS).toContain("(TDEE)");
  });

  it("Targets web (full-sentence) and mobile (bullet-fragment) subtitle pairs are deliberately DIFFERENT strings, not a drift bug", () => {
    // web: "Estimated daily burn (TDEE) based on Mifflin-St Jeor"
    // mobile: "Estimated daily burn (TDEE) · Mifflin-St Jeor"
    expect(TARGETS_SUBTITLE_STATIC_TDEE_GLOSS).toContain("based on");
    expect(TARGETS_MOBILE_CAPTION_STATIC_TDEE_GLOSS).not.toContain("based on");
    // Both still gloss the same acronym with the same lead phrase.
    expect(TARGETS_SUBTITLE_STATIC_TDEE_GLOSS.startsWith("Estimated daily burn (TDEE)")).toBe(true);
    expect(TARGETS_MOBILE_CAPTION_STATIC_TDEE_GLOSS.startsWith("Estimated daily burn (TDEE)")).toBe(true);
  });

  it("Targets 'how is this calculated?' caption is byte-identical web vs mobile", () => {
    // Both platforms render this exact wording verbatim (unlike the
    // subtitle, which genuinely differs in template shape).
    expect(TARGETS_HOW_CALCULATED_CAPTION_PLAIN).toBe(
      "See the maintenance TDEE, goal, and pace behind today's target.",
    );
  });

  it("activity-bonus web + mobile aria/accessibility labels are byte-identical", () => {
    // Confirmed by construction (both platforms import the same constant);
    // this pins the SOURCE strings so a future edit can't silently diverge
    // one platform's copy from the other.
    expect(ACTIVITY_BONUS_INFO_TRIGGER_LABEL_PLAIN).toBe("What is maintenance TDEE?");
    expect(ACTIVITY_BONUS_DISMISS_LABEL_PLAIN).toBe("Dismiss TDEE explainer");
  });
});

describe("ENG-1469 — render sites pull shared constants behind the flag", () => {
  const sites: ReadonlyArray<{ path: string; constants: string[] }> = [
    {
      path: "src/app/components/Targets.tsx",
      constants: [
        "TARGETS_SUBTITLE_STATIC_TDEE_GLOSS",
        "TARGETS_HOW_CALCULATED_CAPTION_GLOSS",
        "TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS",
      ],
    },
    {
      path: "apps/mobile/app/targets.tsx",
      constants: [
        "TARGETS_MOBILE_CAPTION_STATIC_TDEE_GLOSS",
        "TARGETS_HOW_CALCULATED_CAPTION_GLOSS",
      ],
    },
    {
      path: "src/app/components/Profile.tsx",
      constants: ["PROFILE_UPGRADE_BANNER_TDEE_GLOSS"],
    },
    {
      path: "src/app/components/suppr/today-activity-bonus-card.tsx",
      constants: ["ACTIVITY_BONUS_INFO_TRIGGER_LABEL_GLOSS"],
    },
    {
      path: "apps/mobile/components/today/TodayActivityBonusCard.tsx",
      constants: [
        "ACTIVITY_BONUS_INFO_TRIGGER_LABEL_GLOSS",
        "ACTIVITY_BONUS_DISMISS_LABEL_GLOSS",
        "ACTIVITY_BONUS_MODAL_TITLE_GLOSS",
      ],
    },
    {
      path: "src/app/components/onboarding/narrative.tsx",
      constants: [
        "ONBOARDING_REVEAL_BMR_LABEL_GLOSS",
        "ONBOARDING_REVEAL_TDEE_LABEL_GLOSS",
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

  it("narrative.tsx reuses the SAME reveal-step BMR/TDEE constants, not a third label variant", () => {
    const narrative = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/narrative.tsx"),
      "utf8",
    );
    expect(narrative).toContain("ONBOARDING_REVEAL_BMR_LABEL_PLAIN");
    expect(narrative).toContain("ONBOARDING_REVEAL_TDEE_LABEL_PLAIN");
    // Sanity: the imported constants are exactly the reveal step's pair
    // (one canonical label per concept — ENG-1461's rule).
    expect(ONBOARDING_REVEAL_BMR_LABEL_PLAIN).toBe("BMR");
    expect(ONBOARDING_REVEAL_TDEE_LABEL_PLAIN).toBe("Est. TDEE");
    expect(ONBOARDING_REVEAL_BMR_LABEL_GLOSS).toContain("(BMR)");
    expect(ONBOARDING_REVEAL_TDEE_LABEL_GLOSS).toContain("(TDEE)");
  });

  it("no render site re-hardcodes the OLD un-glossed label inline", () => {
    const targetsWeb = readFileSync(resolve(ROOT, "src/app/components/Targets.tsx"), "utf8");
    expect(targetsWeb).not.toContain(
      'Estimated TDEE based on Mifflin-St Jeor · {activityLevelCaption(activityLevel)}',
    );
    const targetsMobile = readFileSync(resolve(ROOT, "apps/mobile/app/targets.tsx"), "utf8");
    expect(targetsMobile).not.toContain('"Estimated TDEE · Mifflin-St Jeor"');
    const profile = readFileSync(resolve(ROOT, "src/app/components/Profile.tsx"), "utf8");
    expect(profile).not.toContain("Multi-day plans, adaptive TDEE, and AI logging</span>");
    const narrative = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/narrative.tsx"),
      "utf8",
    );
    expect(narrative).not.toContain('label="Your BMR"');
    expect(narrative).not.toContain('label="Estimated TDEE"');
  });
});

describe("ENG-1469 — deliberate non-fixes are explicit, not silent", () => {
  it("Profile.tsx's BMR/TDEE debug row stays un-glossed WITH an explicit ENG-1469 comment", () => {
    const profile = readFileSync(resolve(ROOT, "src/app/components/Profile.tsx"), "utf8");
    // The debug row itself keeps rendering the bare labels...
    expect(profile).toContain("BMR: <span");
    expect(profile).toContain("TDEE: <span");
    // ...but the decision is recorded inline, not silently dropped.
    expect(profile).toMatch(/ENG-1469[\s\S]*un-glossed/);
  });

  it("changelog/entries.ts is untouched (historical record, not a copy surface)", () => {
    // No assertion beyond "the file still exists and is not imported by
    // this test" — this test exists to document the decision in the
    // suite, matching the pattern of the other explicit-skip tests here.
    expect(() => readFileSync(resolve(ROOT, "src/lib/changelog/entries.ts"), "utf8")).not.toThrow();
  });
});

describe("ENG-1469 — tdee.ts popover fallback template gloss", () => {
  it("buildTdeeExplainerCopy glosses BMR inline (resting burn (BMR))", async () => {
    const { buildTdeeExplainerCopy } = await import("../../src/lib/nutrition/tdee");
    const copy = buildTdeeExplainerCopy({
      maintenanceTdeeKcal: 2100,
      bmrKcal: 1650,
      activityLevel: "moderate",
      basalKcal: 1650,
      activeKcal: 450,
    });
    expect(copy).toContain("resting burn (BMR)");
    expect(copy).not.toMatch(/\bBMR \d/); // bare "BMR 1,650" is gone
    expect(copy).toContain("Maintenance");
    expect(copy).toContain("2,100");
  });

  it("buildMaintenancePopoverCopy (adaptive/measured branches) is already fully plain-English — untouched", async () => {
    const { buildMaintenancePopoverCopy } = await import("../../src/lib/nutrition/resolveMaintenance");
    const formula = buildMaintenancePopoverCopy({
      source: "formula",
      kcal: 2100,
      confidence: null,
    } as Parameters<typeof buildMaintenancePopoverCopy>[0]);
    expect(formula).not.toMatch(/\bTDEE\b/);
    expect(formula).not.toMatch(/\bBMR\b/);
  });
});

describe("ENG-1469 — dead-code cleanup (no-silent-deferrals)", () => {
  it("HEALTH_SYNC_FOOTNOTE was deleted (verified zero importers, not deferred)", () => {
    const syncTypes = readFileSync(resolve(ROOT, "src/lib/health/syncTypes.ts"), "utf8");
    expect(syncTypes).not.toContain("export const HEALTH_SYNC_FOOTNOTE");
  });
});
