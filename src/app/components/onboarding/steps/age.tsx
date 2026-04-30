"use client";

import * as React from "react";
import { NumberStepper } from "../number-stepper";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

export function AgeStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
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
    </StepBody>
  );
}
