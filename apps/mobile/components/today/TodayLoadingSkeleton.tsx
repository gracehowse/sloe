import { memo } from "react";
import { View } from "react-native";

import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Shimmer } from "@/components/ui/SkeletonRow";
import { Radius, Spacing } from "@/constants/theme";

/**
 * TodayLoadingSkeleton — ENG-889 L1 / Figma `326:2` loading frame (mobile).
 *
 * Mirrors the loaded Today day-view layout and the web
 * `TodayLoadingSkeleton` (greeting → week strip → hero → macro grid →
 * meal rows) so journal hydration reads as "Today is loading" in light
 * and dark (`Shimmer` uses theme `inputBg`).
 */
function TodayLoadingSkeletonImpl() {
  return (
    <View testID="today-loading-skeleton" accessibilityLabel="Loading Today">
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: Spacing.md,
        }}
      >
        <Shimmer style={{ width: 80, height: 20, borderRadius: Radius.sm }} />
        <Shimmer style={{ width: 72, height: 16, borderRadius: Radius.sm }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: Spacing.sm,
          marginBottom: Spacing.lg,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: Spacing.sm }}>
            <Shimmer style={{ width: 24, height: 10, borderRadius: Radius.sm }} />
            <Shimmer style={{ width: 32, height: 32, borderRadius: Radius.full }} />
          </View>
        ))}
      </View>

      <Shimmer
        style={{
          height: 200,
          borderRadius: CARD_RADIUS,
          marginBottom: Spacing.md,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Spacing.md,
          marginBottom: Spacing.lg,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer
            key={i}
            style={{
              width: "47%",
              height: 80,
              borderRadius: CARD_RADIUS,
            }}
          />
        ))}
      </View>

      {[1, 2].map((i) => (
        <Shimmer
          key={i}
          style={{
            height: 64,
            borderRadius: CARD_RADIUS,
            marginBottom: Spacing.md,
          }}
        />
      ))}
    </View>
  );
}

export const TodayLoadingSkeleton = memo(TodayLoadingSkeletonImpl);
