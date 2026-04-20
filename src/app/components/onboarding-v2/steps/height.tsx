"use client";

import * as React from "react";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "@/app/components/suppr/ruler-slider";
import { Segmented } from "../segmented";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

export function HeightStep() {
  const { state, set } = useOnboardingV2();
  const overline = useStepOverline();
  const metric = state.unitSystem === "metric";
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="How tall are you?"
        compact
      />
      <div className="flex justify-center mb-5">
        <Segmented
          value={state.unitSystem}
          onChange={(v) => set({ unitSystem: v })}
          options={[
            { value: "metric", label: "cm" },
            { value: "imperial", label: "ft / in" },
          ]}
          ariaLabel="Height units"
        />
      </div>
      {/* Fluid container per visual-qa P1 — RulerSlider was hard-coded
          at 320 px, leaving the slider visibly unmoored in the wider
          right-column card. The component reads track.clientWidth for
          the canvas, so giving it a fluid wrapper just works. */}
      <div className="w-full max-w-[380px] mx-auto">
        {metric ? (
          <RulerSlider
            value={state.heightCm}
            onChange={(v) => set({ heightCm: v })}
            min={140}
            max={210}
            step={1}
            unit="cm"
            ariaLabel="Height"
          />
        ) : (
          <RulerSlider
            value={Math.round(state.heightCm / 2.54)}
            onChange={(totalIn) =>
              set({ heightCm: Math.round(totalIn * 2.54) })
            }
            min={48}
            max={84}
            step={1}
            format={formatImperialHeightInches}
            parseInput={parseImperialHeightInches}
            ariaLabel="Height"
          />
        )}
      </div>
    </StepBody>
  );
}
