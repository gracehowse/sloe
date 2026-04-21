import * as React from "react";
import { View } from "react-native";
import { Activity, Armchair, Dumbbell, Flame, Footprints, type LucideIcon } from "lucide-react-native";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { ActivityLevel } from "@/lib/tdee";
import { useOnboardingV2 } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const ACTIVITIES: {
  id: ActivityLevel;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}[] = [
  { id: "sedentary", title: "Sedentary", subtitle: "Mostly sitting, little walking", Icon: Armchair },
  { id: "light", title: "Lightly active", subtitle: "1–3 workouts or active days / wk", Icon: Footprints },
  { id: "moderate", title: "Moderately active", subtitle: "3–5 sessions + daily movement", Icon: Activity },
  { id: "active", title: "Very active", subtitle: "6–7 sessions, physical job", Icon: Dumbbell },
  { id: "very_active", title: "Athlete", subtitle: "Twice-daily training, competitive", Icon: Flame },
];

export function MobileActivityStep() {
  const { state, set } = useOnboardingV2();
  const colors = useThemeColors();
  const overline = useStepOverline();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="How active are you?"
        subtitle="Rough estimate — Suppr will refine this using your activity data over ~2 weeks."
      />
      <View style={{ gap: 8 }}>
        {ACTIVITIES.map((a) => {
          const selected = state.activity === a.id;
          return (
            <OptionCard
              key={a.id}
              compact
              selected={selected}
              onPress={() => set({ activity: a.id })}
              icon={
                <a.Icon
                  size={18}
                  color={selected ? Accent.primaryLight : colors.icon}
                  strokeWidth={1.75}
                />
              }
              title={a.title}
              subtitle={a.subtitle}
            />
          );
        })}
      </View>
    </MobileStepBody>
  );
}
