"use client";

import * as React from "react";
import { Info, Shield } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import type { Sex } from "@/lib/nutrition/tdee";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader } from "../scaffold";

/**
 * Sex step — step 04. Inclusive copy locked in by the
 * `diversity-inclusion` review (Phase 2 sign-off gate).
 *
 * Three options: Female, Male, Prefer not to say.
 *
 * The expanded help-text panel covers trans / non-binary / GNC users
 * explicitly so nobody has to guess what we do with this number. The
 * BMR equation uses different coefficients per sex (~166 kcal/day
 * difference); we describe that calmly without coding "right answer"
 * judgement into the UI. `unspecified` maps to the male/female midpoint
 * in `calculateBMR` — see `tests/unit/onboardingV2Targets.test.ts`.
 */

const OPTIONS: { id: Sex; title: string; subtitle?: string }[] = [
  { id: "female", title: "Female" },
  { id: "male", title: "Male" },
  {
    id: "unspecified",
    title: "Prefer not to say",
    subtitle: "Uses the male/female midpoint",
  },
];

export function SexStep() {
  const { state, set } = useOnboardingV2();
  const [helpOpen, setHelpOpen] = React.useState(false);

  return (
    <StepBody>
      <StepHeader
        overline="Step 04 of 12"
        title="Sex"
        subtitle="Please select which sex we should use to calculate your calorie needs."
      />

      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.id ?? "unspec"}
            selected={state.sex === o.id}
            onClick={() => set({ sex: o.id })}
            title={o.title}
            subtitle={o.subtitle}
            compact
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        aria-expanded={helpOpen}
        className="bg-transparent border-0 pt-3.5 pb-0 text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2 text-left self-start"
      >
        <Info className="size-3.5 text-primary" />
        <span className="underline decoration-border underline-offset-[3px]">
          Which one should I choose?
        </span>
      </button>

      {helpOpen && (
        <div className="mt-3 p-3.5 bg-primary/5 border border-primary/15 rounded-xl text-xs text-foreground leading-relaxed">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
            What Suppr does with this
          </div>
          <p className="m-0 mb-2.5">
            The Mifflin-St Jeor equation uses different coefficients for male
            and female metabolic rate — the difference is about 166 kcal/day.
          </p>
          <p className="m-0 mb-2.5">
            If you&apos;re trans, non-binary, or gender non-conforming: if you
            haven&apos;t started gender-affirming hormones, selecting your sex
            assigned at birth will most accurately reflect your metabolic
            rate. If you&apos;ve been on hormones for more than a few months,
            your metabolism may be closer to your gender identity.
          </p>
          <p className="m-0 text-muted-foreground">
            For best results, consult your doctor. You can change this at any
            time — Suppr also re-calibrates from your actual logs.
          </p>
        </div>
      )}

      <div className="mt-auto pt-5 text-[11px] text-muted-foreground leading-relaxed flex gap-2 items-start">
        <Shield className="size-3 text-muted-foreground mt-px" aria-hidden />
        <span>
          Stored privately on your device and synced only to your Suppr
          account. Never shared.
        </span>
      </div>
    </StepBody>
  );
}
