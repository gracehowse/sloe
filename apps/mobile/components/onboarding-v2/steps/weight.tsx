import * as React from "react";
import { View } from "react-native";
import { RulerSlider } from "@/components/RulerSlider";
import { useOnboardingV2 } from "../context";
import { MobileSegmented } from "../segmented";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

export function MobileWeightStep() {
  const { state, set } = useOnboardingV2();
  const metric = state.unitSystem === "metric";
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 07 of 12"
        title="And your weight?"
        subtitle="We'll store this privately. You can log it whenever — no daily prompts."
        compact
      />
      <View style={{ marginBottom: 20 }}>
        <MobileSegmented
          value={state.unitSystem}
          onChange={(v) => set({ unitSystem: v })}
          options={[
            { value: "metric", label: "kg" },
            { value: "imperial", label: "lb" },
          ]}
          ariaLabel="Weight units"
        />
      </View>
      <View style={{ alignItems: "center" }}>
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
            accessibilityLabel="Weight"
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
            accessibilityLabel="Weight"
          />
        )}
      </View>
    </MobileStepBody>
  );
}
