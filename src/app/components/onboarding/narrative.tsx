"use client";

import * as React from "react";
import type { OnboardingState, StepId } from "@/lib/onboarding/state";
import type { V2Targets } from "@/lib/onboarding/targets";
import { isFeatureEnabled } from "@/lib/analytics/track";
import {
  ONBOARDING_REVEAL_BMR_LABEL_GLOSS,
  ONBOARDING_REVEAL_BMR_LABEL_PLAIN,
  ONBOARDING_REVEAL_TDEE_LABEL_GLOSS,
  ONBOARDING_REVEAL_TDEE_LABEL_PLAIN,
} from "@/lib/onboarding/figmaCopy";

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
  // ENG-963 — the optional "What's bringing you here?" intent step. A calm,
  // body-neutral aside; the pick is never required (footer Continue always
  // advances). Flag-gated behind `onboarding-why-now` — when OFF this step
  // never renders, so this narrative block is dormant until the flag ramps.
  "why-now": {
    eyebrow: "Why now",
    head: "What's bringing\nyou here?",
    body: "Optional, and there's no wrong answer. It just helps us keep your plan encouraging — skip it if you'd rather.",
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
    extra: ({ targets }) => {
      // ENG-1469 (ENG-1461 follow-up) — this desktop narrative column
      // duplicates the SAME BMR/TDEE tile pair the right-side reveal
      // step renders (`steps/reveal.tsx`); reuses those exact gloss
      // constants rather than a third label variant, per ENG-1461's
      // "one canonical label per concept" rule. Was the real ENG-1187
      // gap — this column was never wired to the gloss flag at all.
      const glossOn = isFeatureEnabled("onboarding_jargon_gloss_v1");
      const bmrLabel = glossOn ? ONBOARDING_REVEAL_BMR_LABEL_GLOSS : ONBOARDING_REVEAL_BMR_LABEL_PLAIN;
      const tdeeLabel = glossOn ? ONBOARDING_REVEAL_TDEE_LABEL_GLOSS : ONBOARDING_REVEAL_TDEE_LABEL_PLAIN;
      return targets ? (
        <div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <NarrativeStat label={bmrLabel} value={targets.bmr} unit="kcal/day" />
          <NarrativeStat label={tdeeLabel} value={targets.tdee} unit="kcal/day" />
        </div>
      ) : null;
    },
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

/**
 * The narrative column's CONTENT — eyebrow → serif headline → body → optional
 * extras. Extracted from `web-flow.tsx` (2026-07-24) so that screen keeps
 * shrinking toward the 400-line target rather than growing; the copy it renders
 * already lives in this file, so this is where the markup belongs too.
 *
 * `web-flow.tsx` keeps the surrounding LAYOUT (grid column, brand gradient,
 * per-step fade, the `hidden md:flex` breakpoint) — this component is purely
 * the typographic block inside it, and renders nothing for a step with no
 * narrative entry.
 */
export function NarrativeBody({
  stepId,
  state,
  targets,
}: {
  stepId: StepId;
  state: OnboardingState;
  targets: V2Targets | null;
}) {
  const narrative = NARRATIVE[stepId];
  // Design-consistency pass (2026-07-24) — the narrative eyebrow was
  // 11/600/0.14em in `--foreground-tertiary`, a fourth spelling of the app's
  // section label. Onboarding is a front door: the visitor meets this eyebrow
  // minutes before the in-app one, so it now uses the canonical treatment
  // (11/600/0.12em full ink + a hairline rule running to the margin) that
  // `ScreenChrome` and `ScreenSectionChrome` ship. Flag-off keeps the old
  // tertiary label as the kill switch.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  if (!narrative) return null;
  return (
    <div>
      {unifiedChrome ? (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
            {narrative.eyebrow}
          </span>
          <span className="flex-1 h-px bg-border" />
        </div>
      ) : (
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-tertiary mb-4">
          {narrative.eyebrow}
        </div>
      )}
      {/* Sloe reskin (Figma onboarding parity 2026-06-07): the narrative
          headline reads in plum Newsreader serif to match the editorial
          warm-coaching direction. */}
      <h1
        className="font-[family-name:var(--font-headline)] text-[44px] font-normal tracking-tight text-foreground-brand m-0 mb-4 leading-[1.08] max-w-[520px]"
        style={{
          letterSpacing: "-0.02em",
          textWrap: "balance",
          whiteSpace: "pre-line",
        } as React.CSSProperties}
      >
        {narrative.head}
      </h1>
      {narrative.body && (
        <p
          className="text-base text-muted-foreground m-0 leading-relaxed max-w-[440px]"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {narrative.body}
        </p>
      )}
      {narrative.extra && (
        <div className="mt-8">{narrative.extra({ state, targets })}</div>
      )}
    </div>
  );
}

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
        className={`${isFeatureEnabled("type_scale_v1") ? "font-[family-name:var(--font-headline)] text-xl font-normal" : "text-[18px] font-bold"} text-foreground tabular-nums leading-none`}
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
