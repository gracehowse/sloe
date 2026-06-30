"use client";

import * as React from "react";
import { ONBOARDING_REVEAL_WHY_NOW_REFLECTION } from "@/lib/onboarding/figmaCopy";
import type { WhyNow } from "@/lib/onboarding/state";

/**
 * ENG-963 — reveal-step reflection of the optional why-now intent ("a plan
 * built around feeling better day to day"). Extracted into its own file so
 * the (legacy, over-budget) reveal step doesn't grow. Renders nothing when
 * no intent was picked (the step is flag-gated + optional). Copy is sourced
 * from `figmaCopy.ts` so it never drifts from the mobile twin.
 */
export function RevealWhyNowReflection({ whyNow }: { whyNow: WhyNow }) {
  if (!whyNow) return null;
  return (
    <p
      className="font-[family-name:var(--font-headline)] text-base italic text-foreground-brand mx-auto mt-3 leading-relaxed max-w-[340px]"
      data-testid="onboarding-reveal-why-now"
      style={{ textWrap: "pretty" } as React.CSSProperties}
    >
      {ONBOARDING_REVEAL_WHY_NOW_REFLECTION[whyNow]}
    </p>
  );
}
