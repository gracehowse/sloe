import * as React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { mapGoalToStrategy } from "@/lib/onboarding-v2";
import type { NutritionStrategy } from "@/lib/tdee";
import { useOnboardingV2 } from "../context";
import {
  MobileMethodologyNote,
  MobileStepBody,
  MobileStepHeader,
  useStepOverline,
} from "../scaffold";

/**
 * Mobile mirror of the web Strategy step. Lets the user override the
 * goal-derived macro split (parity with the legacy onboarding's
 * nutrition_strategy step, Grace 2026-04-20).
 */

interface StrategyOption {
  id: NutritionStrategy;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STRATEGIES: StrategyOption[] = [
  {
    id: "balanced",
    title: "Balanced",
    subtitle: "Even split, flexible across cuisines.",
    icon: "scale-outline",
  },
  {
    id: "high_protein",
    title: "High protein",
    subtitle: "~2.2 g/kg, muscle-building leaning.",
    icon: "barbell-outline",
  },
  {
    id: "high_satisfaction",
    title: "High satisfaction",
    subtitle: "Filling meals, easier in a deficit.",
    icon: "leaf-outline",
  },
  {
    id: "low_carb",
    title: "Low carb",
    subtitle: "Carbs minimised, fat-led.",
    icon: "flame-outline",
  },
];

export function MobileStrategyStep() {
  const { state, set } = useOnboardingV2();
  const colors = useThemeColors();
  const overline = useStepOverline();
  const recommended = state.goal ? mapGoalToStrategy(state.goal) : "balanced";
  const selected = state.nutritionStrategy ?? recommended;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Pick your macro style"
        subtitle="Pre-picked from your goal. Tap to override."
      />
      <View style={{ gap: 10 }}>
        {STRATEGIES.map((s) => {
          const isSelected = selected === s.id;
          const isRecommended = s.id === recommended;
          return (
            <OptionCard
              key={s.id}
              selected={isSelected}
              onPress={() => set({ nutritionStrategy: s.id })}
              icon={
                <Ionicons
                  name={s.icon}
                  size={20}
                  color={isSelected ? Accent.primaryLight : colors.icon}
                />
              }
              title={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {s.title}
                  </Text>
                  {isRecommended && (
                    <View
                      style={{
                        backgroundColor: `${Accent.primaryLight}26`,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: Accent.primaryLight,
                          fontSize: 10,
                          fontWeight: "700",
                          letterSpacing: 1,
                        }}
                      >
                        RECOMMENDED
                      </Text>
                    </View>
                  )}
                </View>
              }
              subtitle={s.subtitle}
            />
          );
        })}
      </View>
      <MobileMethodologyNote>
        Macro ratios are a starting point. Suppr recalibrates protein and carbs
        as you log and weigh in.
      </MobileMethodologyNote>
    </MobileStepBody>
  );
}
