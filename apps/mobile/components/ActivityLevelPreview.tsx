/**
 * ActivityLevelPreview (mobile) — five tappable activity-level rows
 * with a live maintenance-kcal preview line beneath. Extracted
 * 2026-04-19 for build 10 fix E-2 (activity-level self-edit in
 * Settings). Mirrors the web component at
 * `src/app/components/suppr/activity-level-preview.tsx`.
 *
 * Math delegated to `calculateTDEE` / `activityLevelPreviewKcal` in
 * `src/lib/nutrition/tdee.ts` — this file never duplicates multipliers
 * or BMR formulae.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ACTIVITY_SHORT_LABELS,
  activityLevelPreviewKcal,
  type ActivityLevel,
  type Sex,
} from "@suppr/shared/nutrition/tdee";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type ActivityLevelPreviewProps = {
  sex: Sex;
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  age: number | null | undefined;
  selected: ActivityLevel;
  onSelect: (level: ActivityLevel) => void;
  /** When true (default), renders the five options above the preview
   *  line. When false, only the preview line is emitted (for callers
   *  like onboarding that render their own option buttons). */
  renderOptions?: boolean;
};

const ORDER: readonly ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little to no exercise",
  light: "Light exercise 1–3 days/week",
  moderate: "Moderate exercise 3–5 days/week",
  active: "Hard exercise 6–7 days/week",
  very_active: "Very hard exercise or physical job",
};

export default function ActivityLevelPreview({
  sex,
  weightKg,
  heightCm,
  age,
  selected,
  onSelect,
  renderOptions = true,
}: ActivityLevelPreviewProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active activity-
  // level option (edge, tint, label).
  const accent = useAccent();
  const preview = activityLevelPreviewKcal(sex, weightKg, heightCm, age);

  const handlePress = (lvl: ActivityLevel) => {
    onSelect(lvl);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View testID="activity-level-preview" style={{ gap: Spacing.sm }}>
      {renderOptions ? (
        <View style={{ gap: Spacing.sm }}>
          {ORDER.map((lvl) => {
            const active = lvl === selected;
            const kcal = preview ? preview[lvl] : null;
            return (
              <Pressable
                key={lvl}
                testID={`activity-level-option-${lvl}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => handlePress(lvl)}
                style={[
                  styles.option,
                  {
                    borderColor: active ? accent.primary : colors.border,
                    backgroundColor: active
                      ? accent.primary + "15"
                      : colors.inputBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    {
                      color: active ? accent.primary : colors.text,
                    },
                  ]}
                >
                  {ACTIVITY_SHORT_LABELS[lvl]}
                </Text>
                <Text
                  style={[
                    styles.optionDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  {ACTIVITY_DESCRIPTIONS[lvl]}
                </Text>
                {kcal != null ? (
                  <Text
                    style={[
                      styles.optionKcal,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Maintenance ≈ {kcal.toLocaleString()} kcal
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {preview ? (
        <Text
          testID="activity-level-preview-row"
          accessibilityLabel="Maintenance calorie preview by activity level"
          style={[
            styles.previewRow,
            { color: colors.textSecondary },
          ]}
        >
          {ORDER.map((lvl, i) => {
            const isSelected = lvl === selected;
            const sep = i > 0 ? " \u00B7 " : "";
            return (
              <Text key={lvl}>
                {sep}
                <Text
                  style={
                    isSelected
                      ? { fontWeight: "700", color: colors.text }
                      : undefined
                  }
                >
                  {ACTIVITY_SHORT_LABELS[lvl]}: {preview[lvl].toLocaleString()} kcal
                </Text>
              </Text>
            );
          })}
        </Text>
      ) : (
        <Text
          testID="activity-level-preview-fallback"
          style={[styles.previewFallback, { color: colors.textTertiary }]}
        >
          Pick your activity level — we&apos;ll compute your maintenance calories once your basics are in.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  optionKcal: {
    fontSize: 12,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  previewRow: {
    fontSize: 12,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
    marginTop: Spacing.sm,
  },
  previewFallback: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
});
