"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { NumberStepper } from "../number-stepper";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Web Age step.
 *
 * 2026-05-13 (premium-bar audit DC7 web parity): mirrors the mobile
 * Age step pattern (apps/mobile/components/onboarding/steps/age.tsx)
 * with a "How does age affect my target?" expander below the stepper.
 * The Mifflin-St Jeor age coefficient is small but non-zero (~5 kcal/year
 * subtracted from BMR); the expander surfaces that math + the "we
 * re-calibrate from your actual logs" reassurance so a user worried
 * the number is a hard cap reads the truth before tap.
 */
export function AgeStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const [helpOpen, setHelpOpen] = React.useState(false);
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="How old are you?"
        subtitle="Metabolic rate drops ~1% per decade after 20 — we'll factor that in."
      />
      <div className="flex justify-center my-5">
        <NumberStepper
          value={state.age}
          onChange={(v) => set({ age: v })}
          min={14}
          max={100}
          suffix="years"
          big
          ariaLabel="Age"
        />
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        aria-expanded={helpOpen}
        className="bg-transparent border-0 pt-3.5 pb-0 text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2 text-left self-start"
      >
        <Info className="size-3.5 text-primary" />
        <span className="underline decoration-border underline-offset-[3px]">
          How does age affect my target?
        </span>
      </button>

      {helpOpen && (
        <div className="mt-3 p-3.5 bg-primary/5 border border-primary/15 rounded-xl text-xs text-foreground leading-relaxed">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
            What Sloe does with this
          </div>
          <p className="m-0 mb-2.5">
            The Mifflin-St Jeor equation subtracts about 5 kcal/year from
            your estimated BMR — so a 25-year-old and a 45-year-old at the
            same weight + height get targets ~100 kcal apart.
          </p>
          <p className="m-0 mb-2.5">
            This is an estimate, not a verdict on your metabolism. Sloe
            adaptive-TDEE will re-calibrate from your actual logged intake
            + weight changes after ~2 weeks, replacing the formula with
            your real maintenance.
          </p>
          <p className="m-0 text-muted-foreground">
            You can change your age (or any other plan input) anytime from
            Settings.
          </p>
        </div>
      )}
    </StepBody>
  );
}
