/**
 * ENG-1233 — guided first-win log prompt (mobile).
 */
import * as React from "react";
import { Text, View } from "react-native";
import { Coffee, Search, Sun } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { FIRST_LOG_CHIPS } from "@suppr/shared/onboarding/conversionFunnel";
import type { FirstLogChoice } from "@/lib/onboarding";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const ICONS = {
  breakfast: Sun,
  coffee: Coffee,
  search: Search,
} as const;

export function FirstLogStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();

  const pick = React.useCallback(
    (id: Exclude<FirstLogChoice, null>) => {
      set({ firstLogChoice: id });
      track(AnalyticsEvents.onboarding_first_log_prompt, {
        choice: id,
        platform: "mobile",
      });
    },
    [set],
  );

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="One quick win"
        subtitle="Log something small now — you'll land on Today ready to keep going."
      />

      <View style={{ gap: Spacing.sm }}>
        {FIRST_LOG_CHIPS.map((chip) => {
          const Icon = ICONS[chip.id];
          const selected = state.firstLogChoice === chip.id;
          return (
            <PressableScale
              key={chip.id}
              haptic="selection"
              onPress={() => pick(chip.id)}
              style={{
                borderWidth: 1,
                borderColor: selected ? colors.navPrimary : colors.border,
                borderRadius: 12,
                padding: Spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
              }}
            >
              <Icon size={20} color={colors.navPrimary} />
              <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>
                {chip.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <PressableScale haptic="none" onPress={() => pick("skip")} style={{ marginTop: Spacing.md }}>
        <Text style={[Type.caption, { color: colors.textTertiary, textAlign: "center" }]}>
          Skip for now
        </Text>
      </PressableScale>
    </MobileStepBody>
  );
}
