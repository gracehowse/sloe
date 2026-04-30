"use client";

import * as React from "react";
import { RulerSlider } from "@/app/components/suppr/ruler-slider";
import { Segmented } from "../segmented";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Weight step — step 07. Includes a "Prefer not to enter" path
 * (diversity-inclusion Stage F sign-off): users with active ED or in
 * recovery can advance without entering a number. When skipped, the
 * Pace step is auto-skipped and the Reveal step shows a "calibrate
 * from your logs" message instead of concrete kcal targets.
 */

export function WeightStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const metric = state.unitSystem === "metric";
  if (state.weightSkipped) {
    return (
      <StepBody>
        <StepHeader
          overline={overline}
          title="Skipped — that's fine"
          subtitle="We'll calibrate your targets from your meal logs over the first couple of weeks. You can add a weight any time from Settings."
          compact
        />
        <button
          type="button"
          onClick={() => set({ weightSkipped: false })}
          className="text-sm font-semibold text-primary self-start mt-2 bg-transparent border-0 cursor-pointer p-0"
        >
          Actually, I&apos;ll enter it
        </button>
      </StepBody>
    );
  }
  return (
    <StepBody>
      <StepHeader
        overline={overline}
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
      <div className="w-full max-w-[380px] mx-auto">
        {metric ? (
          <RulerSlider
            value={state.weightKg}
            onChange={(v) => set({ weightKg: v })}
            min={40}
            max={150}
            step={0.5}
            decimals={1}
            unit="kg"
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
            ariaLabel="Weight"
          />
        )}
      </div>
      <div className="text-center mt-6">
        <button
          type="button"
          onClick={() => set({ weightSkipped: true })}
          className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-[3px] bg-transparent border-0 cursor-pointer p-0"
          data-testid="weight-skip"
        >
          Prefer not to enter
        </button>
        <div className="text-[11px] text-muted-foreground mt-1.5 max-w-[280px] mx-auto leading-relaxed">
          We&apos;ll calibrate from your meal logs over the first couple of
          weeks instead.
        </div>
      </div>
    </StepBody>
  );
}
