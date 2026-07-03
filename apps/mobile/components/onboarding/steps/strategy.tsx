import * as React from "react";
import { Spacing, Type } from "@/constants/theme";
import { View, Text } from "react-native";
import { Dumbbell, Flame, Leaf, type LucideIcon, Scale } from "lucide-react-native";
import { OptionCard } from "@/components/OptionCard";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { mapGoalToStrategy } from "@/lib/onboarding";
import type { NutritionStrategy } from "@/lib/tdee";
import { useOnboarding } from "../context";
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
  icon: LucideIcon;
}

const STRATEGIES: StrategyOption[] = [
  {
    id: "balanced",
    title: "Balanced",
    subtitle: "Even split, flexible across cuisines.",
    icon: Scale,
  },
  {
    id: "high_protein",
    title: "High protein",
    subtitle: "~2.2 g/kg, muscle-building leaning.",
    icon: Dumbbell,
  },
  {
    id: "high_satisfaction",
    title: "High satisfaction",
    subtitle: "Filling meals, easier in a deficit.",
    icon: Leaf,
  },
  {
    id: "low_carb",
    title: "Low carb",
    subtitle: "Carbs minimised, fat-led.",
    icon: Flame,
  },
];

export function MobileStrategyStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // Secondary accent (Frost flag → damson, else clay) for the selected option's
  // icon tint + the "RECOMMENDED" pill. The card chrome flips via `OptionCard`.
  const accent = useAccent();
  const recommended = state.goal ? mapGoalToStrategy(state.goal) : "balanced";
  const selected = state.nutritionStrategy ?? recommended;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Pick your macro style"
        subtitle="Pre-picked from your goal. Tap to override."
      />
      <View style={{ gap: Spacing.dense }}>
        {STRATEGIES.map((s) => {
          const isSelected = selected === s.id;
          const isRecommended = s.id === recommended;
          const Icon = s.icon;
          return (
            <OptionCard
              key={s.id}
              selected={isSelected}
              onPress={() => set({ nutritionStrategy: s.id })}
              icon={
                <Icon
                  size={20}
                  color={isSelected ? accent.primaryLight : colors.icon}
                />
              }
              title={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontFamily: Type.bodyLarge.fontFamily, fontSize: Type.bodyLarge.fontSize, lineHeight: Type.bodyLarge.lineHeight, fontWeight: "700",
                    }}
                  >
                    {s.title}
                  </Text>
                  {isRecommended && (
                    <View
                      style={{
                        backgroundColor: `${accent.primaryLight}26`,
                        paddingHorizontal: Spacing.sm,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: accent.primaryLight,
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
        Macro ratios are a starting point. Sloe recalibrates protein and carbs
        as you log and weigh in.
      </MobileMethodologyNote>
    </MobileStepBody>
  );
}
