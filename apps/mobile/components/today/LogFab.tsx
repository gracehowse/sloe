import React from "react";
import { Alert, Pressable, View } from "react-native";
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
 * Phase 2 ships the FAB *placement and existence* only. The tap
 * action is intentionally a no-op for Phase 2 — it surfaces a brief
 * "Coming in Phase 3" alert so the user knows the surface is there
 * without us shipping a half-built sheet behind it. Phase 3 wires the
 * canonical `<LogSheet>` to this FAB (B2.1).
 *
 * Why ship it now (rather than wait for Phase 3): the FAB's vertical
 * position interacts with every other Today element (the meals
 * section's Complete Day button, scroll-end padding, etc.). Holding
 * the slot in Phase 2 means Phase 3 only fills the sheet — no further
 * layout drift for Today's composition root.
 *
 * Tap, scale, haptic per §1.1 of the production design spec:
 *   "FAB tap. Scale 1 → 0.94 → 1 over 180ms. Combined with haptic
 *    medium." We use Reanimated-free CSS-style press feedback because
 *    the FAB is a single Pressable; springing it adds no value for the
 *    placeholder behaviour. Phase 3 swaps in the spring as part of the
 *    LogSheet wiring.
 */
export interface LogFabProps {
  /** Whether the FAB is visible. Hidden when an explicit overlay is
   *  open (e.g. add-meal form, scanner sheet). */
  visible?: boolean;
  /** Optional override for the tap handler. When omitted, Phase 2
   *  surfaces a "Coming in Phase 3" alert. Phase 3 will wire this to
   *  the LogSheet open handler. */
  onPress?: () => void;
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
    if (onPress) {
      onPress();
      return;
    }
    Alert.alert(
      "Coming in Phase 3",
      "The unified log sheet ships in the next phase. For now, tap a meal slot or use the search/barcode/voice/photo affordances above.",
      [{ text: "OK", style: "default" }],
    );
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
