"use client";

import * as React from "react";
import type { OnboardingState, StepId } from "@/lib/onboarding/v2/state";
import type { V2Targets } from "@/lib/onboarding/v2/targets";

/**
 * Per-step narrative content for the web split layout's left column.
 *
 * Mobile uses the right-side step-card content directly (no narrative
 * column — that pattern doesn't fit the iPhone safe area). Adding a
 * narrative entry here is therefore web-only.
 */

interface NarrativeContext {
  state: OnboardingState;
  targets: V2Targets | null;
}

interface NarrativeBlock {
  eyebrow: string;
  head: string;
  body?: string;
  /** Optional rich extras rendered under the body — e.g. the BMR/TDEE
   *  tile pair on the Reveal step. */
  extra?: (ctx: NarrativeContext) => React.ReactNode;
}

export const NARRATIVE: Partial<Record<StepId, NarrativeBlock>> = {
  signup: {
    eyebrow: "Step 02 · Account",
    head: "One account.\nEvery device.",
    body: "Sign in on your laptop, keep logging from your phone — same plan, same targets, always in sync.",
  },
  goal: {
    eyebrow: "Step 03 · Goal",
    head: "What's the plan?",
    body: "You can change this anytime. Real goals shift, and Suppr adapts with them — your targets recalculate automatically.",
  },
  sex: {
    eyebrow: "Step 04 · Metabolism",
    head: "A quick detail\nabout you.",
    body: "Male vs female shifts basal metabolic rate by ~166 kcal/day. Only affects calories.",
  },
  age: {
    eyebrow: "Step 05 · Metabolism",
    head: "And your age.",
    body: "Metabolic rate drops about 1% per decade after 20. We'll factor that in — and keep re-calibrating as Suppr learns from your logs.",
  },
  height: {
    eyebrow: "Step 06 · Metabolism",
    head: "How tall are you?",
    body: "Height is the last variable we need to estimate your resting burn.",
  },
  weight: {
    eyebrow: "Step 07 · Metabolism",
    head: "And your current weight.",
    body: "Stored privately. We'll never prompt you for a daily weigh-in — log it when you want to, skip it when you don't.",
  },
  activity: {
    eyebrow: "Step 08 · Activity",
    head: "How much do you move?",
    body: "Rough estimate is fine. Suppr will re-calibrate using your active-energy data over the first two weeks.",
  },
  pace: {
    eyebrow: "Step 09 · Pace",
    head: "How fast\nshould we go?",
    body: "Now that we know your body, we can translate pace into a daily target. We'll flag anything below the safety floor — change pace anytime in Settings.",
  },
  diet: {
    eyebrow: "Step 10 · Preferences",
    head: "Anything off the table?",
    body: "We use this to filter recipes in Discover and to suggest swaps. Keep it empty if nothing applies — you can tweak any time.",
  },
  strategy: {
    eyebrow: "Step 11 · Macro style",
    head: "Pick your\nmacro style.",
    body: "We pre-pick the split that fits your goal — you can override if you eat differently. The Reveal step will recompute your numbers either way.",
  },
  reveal: {
    eyebrow: "Step 12 · Your targets",
    head: "Here's what your\nday looks like.",
    body: "Calculated from everything you just told us. These numbers will adapt as Suppr learns from your logs.",
    extra: ({ targets }) =>
      targets ? (
        <div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <NarrativeStat
            label="Your BMR"
            value={targets.bmr}
            unit="kcal/day"
          />
          <NarrativeStat
            label="Estimated TDEE"
            value={targets.tdee}
            unit="kcal/day"
          />
        </div>
      ) : null,
  },
  permissions: {
    eyebrow: "Step 13 · Access",
    head: "Quick permission.",
    body: "Optional and revocable. Suppr only asks for what it needs to surface useful nudges.",
  },
  import: {
    eyebrow: "Try it",
    head: "Import your\nfirst recipe.",
    body: "Paste any link — Instagram reel, TikTok, a blog post — and Suppr parses ingredients, matches them against USDA, and calculates macros in seconds.",
  },
};

function NarrativeStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-[14px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className="text-[18px] font-bold text-foreground tabular-nums leading-none"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value.toLocaleString()}
        <span className="ml-1 text-[11px] text-muted-foreground font-medium">
          {unit}
        </span>
      </div>
    </div>
  );
}
