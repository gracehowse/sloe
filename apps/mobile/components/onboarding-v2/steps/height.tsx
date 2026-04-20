import * as React from "react";
import { View } from "react-native";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "@/components/RulerSlider";
import { useOnboardingV2 } from "../context";
import { MobileSegmented } from "../segmented";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

export function MobileHeightStep() {
  const { state, set } = useOnboardingV2();
  const metric = state.unitSystem === "metric";
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 06 of 12"
        title="How tall are you?"
        compact
      />
      <View style={{ marginBottom: 20 }}>
        <MobileSegmented
          value={state.unitSystem}
          onChange={(v) => set({ unitSystem: v })}
          options={[
            { value: "metric", label: "cm" },
            { value: "imperial", label: "ft / in" },
          ]}
          ariaLabel="Height units"
        />
      </View>
      <View style={{ alignItems: "center" }}>
        {metric ? (
          <RulerSlider
            value={state.heightCm}
            onChange={(v) => set({ heightCm: v })}
            min={140}
            max={210}
            step={1}
            unit="cm"
            width={320}
            accessibilityLabel="Height"
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
            accessibilityLabel="Height"
          />
        )}
      </View>
    </MobileStepBody>
  );
}
