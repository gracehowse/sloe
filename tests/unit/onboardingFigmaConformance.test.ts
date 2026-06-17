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

const ROOT = resolve(__dirname, "../..");

describe("ENG-895 — onboarding Figma conformance pins", () => {
  it("goal step uses Sloe copy + four Figma thumbnail options", () => {
    expect(ONBOARDING_GOAL_QUESTION).toBe("What brings you to Sloe?");
    expect(ONBOARDING_GOAL_OPTIONS).toHaveLength(4);
    for (const opt of ONBOARDING_GOAL_OPTIONS) {
      expect(opt.thumbnailTitle.length).toBeGreaterThan(0);
    }
  });

  it("web welcome hero uses Sloe headline + clay pill primary CTA", () => {
    const welcome = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/steps/welcome.tsx"),
      "utf8",
    );
    expect(welcome).toContain("Eat well,");
    expect(welcome).toContain("on your terms.");
    expect(welcome).toMatch(/rounded-full/);
    expect(welcome).toContain("Get started — free");
    // User-facing copy only — comment may mention legacy "Suppr Club".
    expect(welcome).toContain("Sloe breaks down the macros");
    expect(welcome).not.toMatch(/>\s*Suppr Club\s*</);
  });

  it("mobile welcome hero matches Sloe headline + pill Get started CTA", () => {
    const welcome = readFileSync(
      resolve(ROOT, "apps/mobile/components/onboarding/steps/welcome.tsx"),
      "utf8",
    );
    expect(welcome).toContain("Eat well,");
    expect(welcome).toContain("on your terms.");
    expect(welcome).toMatch(/borderRadius: 999/);
    expect(welcome).toContain("Get started");
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
    expect(flow).toMatch(/borderRadius: 999/);
  });

  it("web step headers use plum Newsreader serif (scaffold)", () => {
    const scaffold = readFileSync(
      resolve(ROOT, "src/app/components/onboarding/scaffold.tsx"),
      "utf8",
    );
    expect(scaffold).toContain("text-foreground-brand");
    expect(scaffold).toContain("--font-headline");
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
    expect(webReveal).toContain("onboarding-reveal-projection");
    expect(mobileReveal).toContain("computeOnboardingRevealProjection");
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
