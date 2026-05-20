import React from "react";
import { View } from "react-native";
import { SupprPlateWordmark } from "@/components/SupprMark";
import { Spacing } from "@/constants/theme";

/**
 * Reserved branding row at the top of Today — Tare-style plate mark
 * with the working name "Suppr" until rebrand.
 */
export function TodayBrandBar() {
  return (
    <View
      testID="today-brand-bar"
      style={{
        minHeight: 36,
        justifyContent: "center",
      }}
    >
      <SupprPlateWordmark size={26} />
    </View>
  );
}
