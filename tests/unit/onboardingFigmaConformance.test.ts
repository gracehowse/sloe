/**
 * ENG-895 — onboarding Figma conformance pins (web + mobile source).
 *
 * Locks the highest-risk cold-open surfaces: welcome hero, goal step SSOT,
 * segmented progress, clay pill CTAs. Deeper steps (pace/reveal/diet) still
 * partial — tracked in figma-migration-tracker.md.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_GOAL_QUESTION,
} from "../../src/lib/onboarding/goalOptions";
import { GOAL_DEFAULT_PACE } from "../../src/lib/onboarding/state";
import { paceToKcalAdjustment } from "../../src/lib/onboarding/targets";

const ROOT = resolve(__dirname, "../..");

describe("ENG-1314 — goal cards never assign a silent deficit", () => {
  it("the neutral tracking intent lives on the maintain card (0 kcal adjustment)", () => {
    const trackCard = ONBOARDING_GOAL_OPTIONS.find((o) =>
      /just track/i.test(o.title),
    );
    expect(trackCard).toBeDefined();
    expect(trackCard!.id).toBe("maintain");
    expect(
      paceToKcalAdjustment(trackCard!.id, GOAL_DEFAULT_PACE[trackCard!.id]),
    ).toBe(0);
    // The subtitle says what the card does — maintenance, not a hidden cut.
    expect(trackCard!.subtitle.toLowerCase()).toContain("maintenance");
  });

  it("every deficit-mapped card discloses the deficit in its own copy", () => {
    for (const opt of ONBOARDING_GOAL_OPTIONS) {
      const adj = paceToKcalAdjustment(opt.id, GOAL_DEFAULT_PACE[opt.id]);
      if (adj < 0) {
        const copy = `${opt.title} ${opt.subtitle}`.toLowerCase();
        expect(copy, `"${opt.title}" maps to a ${adj} kcal/day cut but never says so`).toMatch(
          /deficit|lose/,
        );
      }
    }
  });

  it("recomp stays a clearly-labelled explicit opt-in, not a tracking default", () => {
    const recomp = ONBOARDING_GOAL_OPTIONS.find((o) => o.id === "recomp");
    expect(recomp).toBeDefined();
    expect(recomp!.title.toLowerCase()).not.toContain("track");
    expect(recomp!.subtitle.toLowerCase()).toContain("deficit");
  });
});

describe("ENG-895 — onboarding Figma conformance pins", () => {
  it("goal step uses Sloe copy + four Figma thumbnail options", () => {
    expect(ONBOARDING_GOAL_QUESTION).toBe("What brings you to Sloe?");
    expect(ONBOARDING_GOAL_OPTIONS).toHaveLength(4);
    for (const opt of ONBOARDING_GOAL_OPTIONS) {
      expect(opt.thumbnailTitle.length).toBeGreaterThan(0);
    }
  });

  it("web welcome hero is the v3 deep-plum brand screen (ENG-1247)", () => {
    // ENG-1247 M1: the welcome conformed from the Figma oat/body/checklist
    // hero to the v3 prototype `.ob--brand` deep-plum brand screen (wordmark
    // + tagline + CTA), mirroring mobile. Pinned in depth by
    // onboardingWelcomeParity.test.ts; this keeps the brand-line + pill CTA.
    const welcome = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/welcome.tsx"),
      "utf8",
    );
    expect(welcome).toContain("Cook what you love.");
    expect(welcome).toContain("Still reach your goals.");
    expect(welcome).toMatch(/rounded-full/);
    expect(welcome).toContain("Get started");
    expect(welcome).not.toContain("Get started — free");
    expect(welcome).toMatch(/var\(--primary-deep\)/); // deep-plum brand ground
    expect(welcome).toMatch(/>\s*sloe\s*</); // lowercase Fraunces wordmark
    expect(welcome).not.toMatch(/>\s*Suppr Club\s*</);
  });

  it("mobile welcome hero matches Figma brand line + pill Get started CTA", () => {
    const welcome = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/welcome.tsx"),
      "utf8",
    );
    expect(welcome).toContain("Cook what you love.");
    expect(welcome).toContain("Still");
    expect(welcome).toContain("reach your goals.");
    // ENG-1561: the fully-round pill now uses the Radius.full token (=9999)
    // instead of a bare `borderRadius: 999` literal. Same fully-round CTA.
    expect(welcome).toMatch(/borderRadius: Radius\.full/);
    expect(welcome).toContain("Get started");
    expect(welcome).toContain("I already have an account");
  });

  it("web flow Continue CTA is clay rounded-full pill", () => {
    const flow = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/web-flow.tsx"),
      "utf8",
    );
    expect(flow).toMatch(/rounded-full/);
    expect(flow).toContain("OnboardingSegmentedProgress");
  });

  it("mobile flow uses segmented plum progress + pill Continue", () => {
    const flow = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/mobile-flow.tsx"),
      "utf8",
    );
    expect(flow).toContain("OnboardingSegmentedProgress");
    // ENG-1561: fully-round pill now via the Radius.full token (=9999).
    expect(flow).toMatch(/borderRadius: Radius\.full/);
  });

  it("web step headers use plum Newsreader serif (scaffold)", () => {
    const scaffold = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/scaffold.tsx"),
      "utf8",
    );
    expect(scaffold).toContain("text-foreground-brand");
    expect(scaffold).toContain("--font-headline");
  });

  it("pace step uses Lucide icons (no Ionicons) on web + mobile", () => {
    const mobilePace = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/pace.tsx"),
      "utf8",
    );
    const webPace = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/pace.tsx"),
      "utf8",
    );
    // ENG-895 — Ionicons banned (2026-05-31 icon-strategy decision). Mobile
    // must mirror the web pace step's Lucide set exactly. Pin the absence of
    // the import + any `<Ionicons` JSX (a code comment may still name it).
    expect(mobilePace).not.toContain("@expo/vector-icons");
    expect(mobilePace).not.toMatch(/import\s*\{\s*Ionicons/);
    expect(mobilePace).not.toMatch(/<Ionicons/);
    expect(mobilePace).toMatch(
      /import \{[^}]*\} from "lucide-react-native"/,
    );
    // The three icons the warning banner + danger checkbox render — pinned
    // by name so a regression (e.g. reverting to Ionicons or swapping the
    // glyph) breaks the build, and so web ↔ mobile stay on the same set.
    for (const icon of ["AlertTriangle", "Check", "Info"]) {
      expect(mobilePace).toContain(icon);
      expect(webPace).toContain(icon);
    }
  });

  it("pace presets use §7 chip grammar (primary-soft fill, no accent ring) on web + mobile", () => {
    const mobilePace = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/pace.tsx"),
      "utf8",
    );
    const webPace = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/pace.tsx"),
      "utf8",
    );
    expect(webPace).toContain("bg-primary-soft text-primary-solid");
    expect(webPace).not.toMatch(/borderColor:\s*active\s*\?\s*accent/);
    expect(mobilePace).toContain("plum.primarySoft");
    expect(mobilePace).toContain("plum.primarySolid");
  });

  it("reveal step surfaces Figma plan-ready chrome (subtitle + permission quote)", () => {
    const webReveal = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/reveal.tsx"),
      "utf8",
    );
    const mobileReveal = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/reveal.tsx"),
      "utf8",
    );
    for (const src of [webReveal, mobileReveal]) {
      expect(src).toContain("ONBOARDING_REVEAL_SUBTITLE");
      expect(src).toContain("ONBOARDING_REVEAL_PERMISSION_QUOTE");
    }
    expect(webReveal).toContain("<Check");
    expect(mobileReveal).toContain("CircleCheck");
  });

  it("reveal step surfaces ENG-964 date projection on web + mobile", () => {
    const webReveal = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/reveal.tsx"),
      "utf8",
    );
    const mobileReveal = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/reveal.tsx"),
      "utf8",
    );
    expect(webReveal).toContain("computeOnboardingRevealProjection");
    expect(webReveal).toContain("OnboardingRevealProjectionChart");
    expect(webReveal).toContain("onboarding-reveal-projection");
    expect(mobileReveal).toContain("computeOnboardingRevealProjection");
    expect(mobileReveal).toContain("OnboardingRevealProjectionChart");
    expect(mobileReveal).toContain("onboarding-reveal-projection");
  });

  it("web narrative reveal head matches the step copy ('Your plan is ready.')", () => {
    const narrative = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/narrative.tsx"),
      "utf8",
    );
    // The reveal step (reveal.tsx) was re-titled "Your plan is ready."; the
    // desktop narrative column must match, not the stale dashboard framing.
    expect(narrative).toContain('head: "Your plan\\nis ready."');
    expect(narrative).not.toContain("Here's what your");
  });

  it("web narrative eyebrows carry no static step numbers (progress bar owns position)", () => {
    const narrative = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/narrative.tsx"),
      "utf8",
    );
    // Hardcoded "Step N ·" eyebrows mis-number once the flag-gated app-choice
    // step shifts the order; position is owned by OnboardingSegmentedProgress.
    expect(narrative).not.toMatch(/eyebrow:\s*"Step\s*\d/);
  });
});
