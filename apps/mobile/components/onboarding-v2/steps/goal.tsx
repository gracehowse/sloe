import * as React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { Goal } from "@/lib/onboarding-v2";
import { useOnboardingV2 } from "../context";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

const GOALS: { id: Goal; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "lose", title: "Lose fat", subtitle: "Gradual deficit, protein-first", icon: "trending-down-outline" },
  { id: "maintain", title: "Maintain", subtitle: "Keep things steady", icon: "remove-outline" },
  { id: "gain", title: "Gain muscle", subtitle: "Small surplus, high protein", icon: "trending-up-outline" },
  { id: "recomp", title: "Recomposition", subtitle: "Slight deficit, strength-focused", icon: "swap-horizontal-outline" },
];

export function MobileGoalStep() {
  const { state, set } = useOnboardingV2();
  const colors = useThemeColors();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 03 of 12"
        title="What's your goal?"
        subtitle="We'll tailor your calorie and macro targets to match. You can change this anytime."
      />
      <View style={{ gap: 10 }}>
        {GOALS.map((g) => {
          const selected = state.goal === g.id;
          return (
            <OptionCard
              key={g.id}
              selected={selected}
              onPress={() => set({ goal: g.id })}
              icon={
                <Ionicons
                  name={g.icon}
                  size={20}
                  color={selected ? Accent.primaryLight : colors.icon}
                />
              }
              title={g.title}
              subtitle={g.subtitle}
            />
          );
        })}
      </View>
    </MobileStepBody>
  );
}
