"use client";

import * as React from "react";
import { NumberStepper } from "../number-stepper";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader } from "../scaffold";

export function AgeStep() {
  const { state, set } = useOnboardingV2();
  return (
    <StepBody>
      <StepHeader
        overline="Step 05 of 12"
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
    </StepBody>
  );
}
