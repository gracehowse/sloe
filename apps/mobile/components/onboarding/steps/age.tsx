import * as React from "react";
import { View } from "react-native";
import { useOnboarding } from "../context";
import { MobileNumberStepper } from "../number-stepper";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function MobileAgeStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
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
