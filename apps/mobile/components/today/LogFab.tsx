import React from "react";
import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, Elevation } from "@/constants/theme";

/**
 * LogFab — persistent 56pt circular Log button that lives at
 * `right: 18, bottom: 100` on Today (Phase 2 / B1.2, production
 * design spec Surface A §10).
 *
 * Authority (D-2026-04-27-15):
 *   "Persistent Log FAB on Today. One sheet with tabs:
 *    search / barcode / recent / saved / voice / photo."
 *
 * Wired by the Today host to open the canonical `<LogSheet>` (B2.1,
 * Phase 3). `onPress` is required in practice — the previous Phase 2
 * "Coming in Phase 3" Alert.alert fallback was removed 2026-04-28
 * once Phase 3 had shipped on both platforms.
 *
 * Tap, scale, haptic per §1.1 of the production design spec:
 *   "FAB tap. Scale 1 → 0.94 → 1 over 180ms. Combined with haptic
 *    medium."
 */
export interface LogFabProps {
  /** Whether the FAB is visible. Hidden when an explicit overlay is
   *  open (e.g. add-meal form, scanner sheet). */
  visible?: boolean;
  /** Tap handler. Wires to the LogSheet open handler in the host. */
  onPress: () => void;
  /** Distance from the bottom edge in points. Defaults to 100pt
   *  (clears the system tab bar + a little breathing room). */
  bottom?: number;
  /** Distance from the right edge in points. Defaults to 18pt. */
  right?: number;
}

export function LogFab({ visible = true, onPress, bottom = 100, right = 18 }: LogFabProps) {
  if (!visible) return null;

  const handlePress = () => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom,
        right,
        zIndex: 60,
      }}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        accessibilityHint="Opens the log sheet for searching foods, scanning barcodes, or quick logging"
        hitSlop={8}
        style={({ pressed }) => [
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
          Elevation.floatPrimary,
        ]}
      >
        <Plus size={28} color="#fff" strokeWidth={2.25} />
      </Pressable>
    </View>
  );
}

export default LogFab;
