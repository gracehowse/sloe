import type { WhyNow } from "./state";

/**
 * ENG-963 (2026-06-30) — shared copy for the optional "What's bringing you
 * here?" (`why-now`) onboarding step.
 *
 * Single source of truth so the web step
 * (`src/app/components/onboarding/steps/why-now.tsx`) and the mobile step
 * (`apps/mobile/components/onboarding/steps/why-now.tsx`) render the exact
 * same options, in the same order, with byte-for-byte identical copy — the
 * step can never drift between platforms.
 *
 * Body-neutral by design: every option is a calm, supportive framing of
 * *why now*, never a body-shaming, weight-loss-promising, or
 * outcome-guaranteeing one. Trust posture — Sloe is a tool, not a clinician
 * (no health claims, no "lose X to feel better"). The reflection copy on the
 * reveal step is sourced from `figmaCopy.ts` (`WHY_NOW_REVEAL_REFLECTIONS`),
 * NOT duplicated here.
 */
export const ONBOARDING_WHY_NOW_OPTIONS: ReadonlyArray<{
  id: Exclude<WhyNow, null>;
  title: string;
  subtitle: string;
}> = [
  {
    id: "feel-better",
    title: "I want to feel better day to day",
    subtitle: "More energy, fewer slumps",
  },
  {
    id: "stronger",
    title: "I want to get stronger",
    subtitle: "Support training and recovery",
  },
  {
    id: "habit",
    title: "I want to build a steady habit",
    subtitle: "Small, sustainable changes",
  },
  {
    id: "event",
    title: "I've got something coming up",
    subtitle: "A trip, an event, a fresh start",
  },
  {
    id: "curious",
    title: "I'm just curious",
    subtitle: "Exploring — no pressure",
  },
] as const;

export const ONBOARDING_WHY_NOW_QUESTION = "What's bringing you here?";
export const ONBOARDING_WHY_NOW_SUBTITLE =
  "Optional — it helps us keep your plan encouraging. Skip if you'd rather.";
