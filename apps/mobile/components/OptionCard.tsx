import * as React from "react";
import {
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * OptionCard — tappable selection card used by onboarding (goal, sex,
 * activity, diet) and any flow that picks one or many from a small list.
 * Mirrors the web component at `src/app/components/ui/option-card.tsx`.
 *
 * Behaviour:
 *  - Renders a Pressable; selected state uses the secondary accent (Frost
 *    flag → damson, else clay) for the border + an 8% tinted background so it
 *    reads against both light and dark.
 *  - Optional `icon` slot uses a tinted square that flips to the accent
 *    when selected.
 *  - `trailing` prop overrides the default check/uncheck radio (pass
 *    `null` to suppress, e.g. for chip-style multi-select).
 *
 * Used only by onboarding steps (goal/sex/activity/diet/app-choice/strategy),
 * so this single accent read flips every step's selected-card chrome in
 * lockstep with `scaffold.tsx` — the per-step icon tints are passed in by the
 * step files.
 */

export interface OptionCardProps {
  selected?: boolean;
  onPress?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Replace the default trailing checkmark. Pass `null` to hide it. */
  trailing?: React.ReactNode | null;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function OptionCard({
  selected = false,
  onPress,
  title,
  subtitle,
  icon,
  trailing,
  compact = false,
  disabled = false,
  style,
  accessibilityLabel,
}: OptionCardProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the selected card's
  // border, 8% tint fill, icon-square, and checkmark. Lifted from a former
  // module-level `PRIMARY_TINT` constant so the hook can drive it (the
  // `TodayPlannedMealsCard` StyleSheet-lift pattern).
  const accent = useAccent();
  const primaryTint = accent.primary + "14"; // ~8% alpha
  const showCheckbox = trailing === undefined;

  // Wrap onPress so the disabled guard is enforced even if a host
  // component forwards `disabled` without honouring it (e.g. test
  // shims, or a parent that strips RN-specific props).
  const handlePress = React.useCallback(() => {
    if (disabled) return;
    onPress?.();
  }, [disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={
        accessibilityLabel ??
        (typeof title === "string" ? title : undefined)
      }
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? Spacing.sm + 2 : Spacing.md + 2,
          padding: compact ? 12 : 16,
          borderRadius: Radius.lg,
          backgroundColor: selected ? primaryTint : colors.card,
          borderWidth: 1,
          borderColor: selected ? accent.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: compact ? 32 : 44,
            height: compact ? 32 : 44,
            borderRadius: Radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected
              ? accent.primary + "26"
              : colors.inputBg,
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text
            numberOfLines={compact ? 1 : 2}
            adjustsFontSizeToFit
            minimumFontScale={compact ? 0.7 : 0.85}
            // Compact fontSize lowered from 14 → 13 (Grace cohort 2026-05-12):
            // single-word labels like "Mediterranean" in the 2-col diet grid
            // (card width ~48% of viewport) exceeded the text container at
            // 14pt and RN broke them mid-word ("Mediterranea / n"). At 13pt
            // with the existing 0.7 minimumFontScale floor, the engine can
            // both fit at full size for shorter labels AND shrink long ones
            // to ~9pt for the rare overflow case. Non-compact stays 15pt.
            style={{
              color: colors.text,
              fontSize: compact ? 13 : 15,
              fontWeight: "600",
              letterSpacing: -0.2,
              lineHeight: 20,
            }}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text
              numberOfLines={2}
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: 2,
                lineHeight: 16,
              }}
            >
              {subtitle}
            </Text>
          ) : (
            <View style={{ marginTop: 2 }}>{subtitle}</View>
          )
        ) : null}
      </View>
      {trailing !== undefined
        ? trailing
        : showCheckbox && (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: selected ? accent.primary : colors.cardBorder,
                backgroundColor: selected ? accent.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected ? (
                <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
              ) : null}
            </View>
          )}
    </Pressable>
  );
}

export default OptionCard;
