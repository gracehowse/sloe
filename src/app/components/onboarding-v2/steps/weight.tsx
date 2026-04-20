"use client";

import * as React from "react";
import { RulerSlider } from "@/app/components/suppr/ruler-slider";
import { Segmented } from "../segmented";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader } from "../scaffold";

export function WeightStep() {
  const { state, set } = useOnboardingV2();
  const metric = state.unitSystem === "metric";
  return (
    <StepBody>
      <StepHeader
        overline="Step 07 of 12"
        title="And your weight?"
        subtitle="We'll store this privately. You can log it whenever — no daily prompts."
        compact
      />
      <div className="flex justify-center mb-5">
        <Segmented
          value={state.unitSystem}
          onChange={(v) => set({ unitSystem: v })}
          options={[
            { value: "metric", label: "kg" },
            { value: "imperial", label: "lb" },
          ]}
          ariaLabel="Weight units"
        />
      </div>
      <div className="flex justify-center">
        {metric ? (
          <RulerSlider
            value={state.weightKg}
            onChange={(v) => set({ weightKg: v })}
            min={40}
            max={150}
            step={0.5}
            decimals={1}
            unit="kg"
            width={320}
            ariaLabel="Weight"
          />
        ) : (
          <RulerSlider
            value={+(state.weightKg * 2.2046).toFixed(1)}
            onChange={(v) => set({ weightKg: +(v / 2.2046).toFixed(2) })}
            min={90}
            max={330}
            step={1}
            unit="lb"
            width={320}
            ariaLabel="Weight"
          />
        )}
      </div>
    </StepBody>
  );
}
