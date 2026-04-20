import * as React from "react";
import { View } from "react-native";
import { useOnboardingV2 } from "../context";
import { MobileNumberStepper } from "../number-stepper";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

export function MobileAgeStep() {
  const { state, set } = useOnboardingV2();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 05 of 12"
        title="How old are you?"
        subtitle="Metabolic rate drops ~1% per decade after 20 — we'll factor that in."
      />
      <View style={{ alignItems: "center", marginTop: 20 }}>
        <MobileNumberStepper
          value={state.age}
          onChange={(v) => set({ age: v })}
          min={14}
          max={100}
          suffix="years"
          big
          ariaLabel="Age"
        />
      </View>
    </MobileStepBody>
  );
}
