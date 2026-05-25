import React from "react";
import { View } from "react-native";
import { SupprPlateMark } from "@/components/SupprMark";
import { Spacing } from "@/constants/theme";

/**
 * Reserved branding row at the top of Today — plate mark only.
 * Serif wordmark removed here so "Today" stays the single display
 * headline (see `docs/ux/color-direction-noom-lifesum-2026-05.md`).
 */
export function TodayBrandBar() {
  return (
    <View
      testID="today-brand-bar"
      style={{
        minHeight: 28,
        justifyContent: "center",
      }}
    >
      <SupprPlateMark size={24} />
    </View>
  );
}
