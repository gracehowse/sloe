"use client";

import * as React from "react";
import type { OnboardingState, StepId } from "@/lib/onboarding/state";
import type { V2Targets } from "@/lib/onboarding/targets";

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
  // Eyebrows are framing-only category labels — deliberately NO static
  // step numbers. ENG-895 (2026-06-16): per-step position is owned by the
  // segmented progress bar in the header (the numeric "n/12" counter was
  // already removed in web-flow). Hardcoded "Step N ·" numbers were also
  // wrong whenever the flag-gated `app-choice` step is ON — it shifts every
  // later step by one (goal becomes step 3, not 2) — so they're dropped
  // here rather than re-numbered (a static renumber just moves the mismatch).
  "app-choice": {
    eyebrow: "Switching apps",
    head: "Bring your\nhistory with you.",
    body: "Moving from another tracker? We'll import your meal history so your trends, streak, and patterns carry over — your numbers stay exactly as you logged them.",
  },
  signup: {
    eyebrow: "Account",
    head: "Save your plan\nand keep going.",
    body: "You've seen your targets — create an account so they sync across devices and we can build your first week.",
  },
  goal: {
    eyebrow: "Goal",
    head: "What's the plan?",
    body: "You can change this anytime. Real goals shift, and Sloe adapts with them — your targets recalculate automatically.",
  },
  sex: {
    eyebrow: "Metabolism",
    head: "A quick detail\nabout you.",
    body: "Male vs female shifts basal metabolic rate by ~166 kcal/day. Only affects calories.",
  },
  age: {
    eyebrow: "Metabolism",
    head: "And your age.",
    body: "Metabolic rate drops about 1% per decade after 20. We'll factor that in — and keep re-calibrating as Sloe learns from your logs.",
  },
  height: {
    eyebrow: "Metabolism",
    head: "How tall are you?",
    body: "Height is the last variable we need to estimate your resting burn.",
  },
  weight: {
    eyebrow: "Metabolism",
    head: "And your current weight.",
    body: "Stored privately. We'll never prompt you for a daily weigh-in — log it when you want to, skip it when you don't.",
  },
  activity: {
    eyebrow: "Activity",
    head: "How much do you move?",
    body: "Rough estimate is fine. Sloe will re-calibrate using your active-energy data over the first two weeks.",
  },
  pace: {
    eyebrow: "Pace",
    head: "How fast\nshould we go?",
    body: "Now that we know your body, we can translate pace into a daily target. We'll flag anything below the safety floor — change pace anytime in Settings.",
  },
  diet: {
    eyebrow: "Preferences",
    head: "Anything off the table?",
    body: "We use this to filter recipes in Discover and to suggest swaps. Keep it empty if nothing applies — you can tweak any time.",
  },
  strategy: {
    eyebrow: "Macro style",
    head: "Pick your\nmacro style.",
    body: "We pre-pick the split that fits your goal — you can override if you eat differently. The Reveal step will recompute your numbers either way.",
  },
  reveal: {
    eyebrow: "Your targets",
    head: "Your plan\nis ready.",
    body: "Calculated from everything you just told us. These numbers will adapt as Sloe learns from your logs.",
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
  // Build-40 (2026-05-01) — data-bridges step. Customer-lens audit
  // found three competitor-refugee personas bouncing on day 1 because
  // there was no path to bring their existing data with them; this
  // step bundles the bridges most likely to land that hand-off.
  "data-bridges": {
    eyebrow: "Bring your data",
    head: "Skip what you don't need.",
    body: "Already know your targets? Paste them in. Want gentle reminders or to try a recipe import? Tap a card. Or skip the lot — none of this is required.",
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
