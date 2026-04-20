import * as React from "react";
import { View } from "react-native";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "@/components/RulerSlider";
import { useOnboardingV2 } from "../context";
import { MobileSegmented } from "../segmented";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function MobileHeightStep() {
  const { state, set } = useOnboardingV2();
  const overline = useStepOverline();
  const metric = state.unitSystem === "metric";
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
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
      {/* Fluid wrapper (max 380) so RulerSlider scales with the
          container instead of sitting at a fixed 320 px — matches
          the web Height step behaviour after the visual-qa polish
          sweep. RulerSlider measures its container via onLayout and
          fills available width automatically. */}
      <View style={{ alignItems: "center", alignSelf: "stretch" }}>
        <View style={{ width: "100%", maxWidth: 380 }}>
        {metric ? (
          <RulerSlider
            value={state.heightCm}
            onChange={(v) => set({ heightCm: v })}
            min={140}
            max={210}
            step={1}
            unit="cm"
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
            accessibilityLabel="Height"
          />
        )}
        </View>
      </View>
    </MobileStepBody>
  );
}
