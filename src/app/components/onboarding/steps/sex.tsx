"use client";

import * as React from "react";
import { Info, Shield } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import type { Sex } from "@/lib/nutrition/tdee";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

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
    // Diversity-inclusion Stage F sign-off — be explicit about the
    // numeric trade-off rather than implying "midpoint" is itself an
    // identity choice.
    subtitle: "Uses a midpoint estimate (~166 kcal between sexes).",
  },
];

export function SexStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const genderFieldEnabled = isFeatureEnabled("onboarding_gender_field_v1");

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Sex"
        subtitle="Used to estimate your metabolic rate. You can change this anytime."
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

      {genderFieldEnabled && (
        <div className="rounded-xl border border-border bg-card p-4">
          <label
            htmlFor="onboarding-pronouns"
            className="block text-sm font-semibold text-foreground"
          >
            Pronouns or gender (optional)
          </label>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
            This is for how Sloe refers to you — it never changes your metabolic
            estimate.
          </p>
          <input
            id="onboarding-pronouns"
            type="text"
            value={state.pronouns}
            onChange={(event) => set({ pronouns: event.target.value })}
            placeholder="e.g. she/her, they/them, non-binary"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      )}

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
            What Sloe does with this
          </div>
          <p className="m-0 mb-2.5">
            The Mifflin-St Jeor equation uses different coefficients for male
            and female metabolic rate — the difference is about 166 kcal/day.
          </p>
          <p className="m-0 mb-2.5">
            If you&apos;re trans, non-binary, or gender non-conforming:
            there&apos;s no perfect answer here. If you haven&apos;t started
            gender-affirming hormones, your sex assigned at birth is usually the
            closer estimate. After several months on hormones, body composition
            shifts and the other coefficient may begin to fit better — but
            evidence is limited. Pick what feels right, or choose &ldquo;Prefer
            not to say&rdquo; for the midpoint.
          </p>
          <p className="m-0 text-muted-foreground">
            For best results, consult your doctor. You can change this at any
            time — Sloe also re-calibrates from your actual logs.
          </p>
        </div>
      )}

      <div className="mt-auto pt-5 text-[11px] text-muted-foreground leading-relaxed flex gap-2 items-start">
        <Shield className="size-3 text-muted-foreground mt-px" aria-hidden />
        <span>
          Stored privately on your device and synced only to your Sloe account.
          Never shared.
        </span>
      </div>
    </StepBody>
  );
}
