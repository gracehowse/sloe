import React from "react";
import { View } from "react-native";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";
import { Spacing } from "@/constants/theme";

/**
 * Reserved branding row at the top of Today — Sloe wordmark only.
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
      <SloeHeaderWordmark fontSize={22} />
    </View>
  );
}
