import * as React from "react";
import {
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Check } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
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
  /** Round food thumbnail (Figma onboarding 189:2) — takes precedence over icon. */
  thumbnail?: React.ReactNode;
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
  thumbnail,
  trailing,
  compact = false,
  disabled = false,
  style,
  accessibilityLabel,
}: OptionCardProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the selected card's
  // border, soft tint fill, icon-square, and checkmark. Lifted from a former
  // module-level `PRIMARY_TINT` constant so the hook can drive it (the
  // `TodayPlannedMealsCard` StyleSheet-lift pattern).
  const accent = useAccent();
  const primaryTint = accent.primarySoft;
  const showCheckbox = trailing === undefined;
  const leading = thumbnail ?? icon;

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
      {leading ? (
        <View
          style={{
            width: thumbnail ? 56 : compact ? 32 : 44,
            height: thumbnail ? 56 : compact ? 32 : 44,
            borderRadius: thumbnail ? 28 : Radius.md,
            alignItems: "center",
            justifyContent: "center",
            overflow: thumbnail ? "hidden" : "visible",
            backgroundColor: thumbnail
              ? colors.inputBg
              : selected
                ? accent.primarySoft
                : colors.inputBg,
          }}
        >
          {leading}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text
            numberOfLines={compact ? 1 : 2}
            // ENG-1452: `adjustsFontSizeToFit` (floor 0.7) removed. iOS's
            // fit engine shrank labels that comfortably fit ("Very active",
            // "Halal", "Kosher") to ~70% of their siblings — stale/fractional
            // width measurement, not real overflow — so option lists rendered
            // with visibly mismatched title sizes. Titles now sit on the Type
            // ramp at a fixed size (captionStrong 13 compact / bodyLarge 15,
            // the sizes the shrink build targeted; web mirror is fixed
            // text-sm / text-[15px] with no shrink either). A genuinely
            // overflowing compact label (none today — "Mediterranean" fits at
            // 13pt per the 2026-05-12 cohort check) ellipsizes predictably
            // instead of silently changing size.
            style={{
              ...(compact ? Type.captionStrong : Type.bodyLarge),
              color: colors.text,
              fontWeight: "600",
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
                ...Type.captionSmall,
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
                <Check size={12} strokeWidth={3} color={colors.primaryForeground} />
              ) : null}
            </View>
          )}
    </Pressable>
  );
}

export default OptionCard;
