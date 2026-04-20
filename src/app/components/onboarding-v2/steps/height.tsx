"use client";

import * as React from "react";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "@/app/components/suppr/ruler-slider";
import { Segmented } from "../segmented";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader } from "../scaffold";

export function HeightStep() {
  const { state, set } = useOnboardingV2();
  const metric = state.unitSystem === "metric";
  return (
    <StepBody>
      <StepHeader
        overline="Step 06 of 12"
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
      <div className="flex justify-center">
        {metric ? (
          <RulerSlider
            value={state.heightCm}
            onChange={(v) => set({ heightCm: v })}
            min={140}
            max={210}
            step={1}
            unit="cm"
            width={320}
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
            width={320}
            ariaLabel="Height"
          />
        )}
      </div>
    </StepBody>
  );
}
