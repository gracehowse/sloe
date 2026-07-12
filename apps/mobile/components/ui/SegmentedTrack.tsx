import * as React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Radius, ShadowColor, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

/**
 * SegmentedTrack — THE §8 segmented control (ENG-1375 S2/S3, component-grammar
 * epic). One track-and-thumb treatment for every segmented control, ratified
 * 2026-07-10 (`docs/decisions/2026-07-10-chip-grammar-soft-tint.md`,
 * "Segmented controls" section):
 *
 *   - Track: full-radius `inputBg` rail with the 2px inner pad.
 *   - Active segment: card-white full-radius thumb + the subtle 1px shadow
 *     (legal under the interactive-elevation carve-out in
 *     `2026-07-10-card-grammar-rounder-flat.md` — a thumb is feedback chrome,
 *     not a resting card).
 *   - Active label: `accent.primarySolid` semibold. Inactive: `textSecondary`
 *     medium. Ramp: `Type.captionSmall`.
 *
 * Extracted verbatim from the two conforming references
 * (`progress/WeightRangeToggle.tsx`, `progress/ProgressPeriodControl.tsx`).
 * Selection fires the `selection` haptic via `PressableScale`, only on an
 * actual change (the canonical MobileSegmented rule — see
 * `dailyLoopHapticsWiring.test.ts`).
 *
 * Deliberately NOT this primitive: CookMode's A−/A+ text-size stepper — that
 * is a stepper (increment/decrement), not a single-select track; documented
 * as intentionally-different in the ruling.
 *
 * Web mirror: `src/app/components/ui/segmented-track.tsx`.
 */

/** §8 track inner pad (chips census 2026-06-10; ratified 2026-07-10). 2 is
 *  deliberately off the `Spacing` rhythm scale — it is a control-internal
 *  inset (the sliver of rail visible around the thumb), not a layout rhythm
 *  value. It lives ONLY here, in the single primitive — intentionally a
 *  module constant, not a `Spacing` token, so `2` never becomes a legal
 *  layout value — not a gap. */
const TRACK_PAD = 2;

export interface SegmentedTrackOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Spoken label when the visual one is terse (e.g. "W" → "Weekly"). */
  accessibilityLabel?: string;
  testID?: string;
}

export interface SegmentedTrackProps<T extends string = string> {
  options: readonly SegmentedTrackOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `tablist` for view switches (default); `radiogroup` for form inputs
   *  (unit toggles, preference pickers). */
  role?: "tablist" | "radiogroup";
  accessibilityLabel?: string;
  testID?: string;
  /** `stretch` (default): segments share the track width (`flex: 1`).
   *  `hug`: the track hugs its labels (inline pill, e.g. the onboarding
   *  metric/imperial toggle). */
  fit?: "stretch" | "hug";
  style?: StyleProp<ViewStyle>;
}

export function SegmentedTrack<T extends string = string>({
  options,
  value,
  onChange,
  role = "tablist",
  accessibilityLabel,
  testID,
  fit = "stretch",
  style,
}: SegmentedTrackProps<T>) {
  const colors = useThemeColors();
  const accent = useAccent();
  const segmentRole = role === "tablist" ? "tab" : "radio";

  return (
    <View
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.track,
        fit === "hug" && styles.trackHug,
        { backgroundColor: colors.inputBg },
        style,
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            haptic={active ? "none" : "selection"}
            testID={opt.testID}
            accessibilityRole={segmentRole}
            accessibilityLabel={opt.accessibilityLabel}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) onChange(opt.value);
            }}
            style={[
              styles.segment,
              fit === "hug" && styles.segmentHug,
              active && styles.thumb,
              active && { backgroundColor: colors.card },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? accent.primarySolid : colors.textSecondary },
                active && styles.labelActive,
              ]}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: Radius.full,
    padding: TRACK_PAD,
    alignSelf: "stretch",
  },
  trackHug: {
    alignSelf: "center",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  segmentHug: {
    flex: 0,
    paddingHorizontal: Spacing.dense,
    paddingVertical: Spacing.sm,
  },
  // The subtle 1px thumb shadow — the interactive carve-out permits it
  // (feedback chrome, not a resting card).
  thumb: {
    shadowColor: ShadowColor.cast,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontFamily: Type.captionSmall.fontFamily,
    fontSize: Type.captionSmall.fontSize,
    lineHeight: Type.captionSmall.lineHeight,
    fontWeight: "500",
  },
  labelActive: {
    fontWeight: "600",
  },
});
