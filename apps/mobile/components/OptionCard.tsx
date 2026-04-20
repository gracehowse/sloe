import * as React from "react";
import {
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * OptionCard — tappable selection card used by onboarding (goal, sex,
 * activity, diet) and any flow that picks one or many from a small list.
 * Mirrors the web component at `src/app/components/ui/option-card.tsx`.
 *
 * Behaviour:
 *  - Renders a Pressable; selected state uses `Accent.primary` border +
 *    8% tinted background so it reads against both light and dark.
 *  - Optional `icon` slot uses a tinted square that flips to primary
 *    when selected.
 *  - `trailing` prop overrides the default check/uncheck radio (pass
 *    `null` to suppress, e.g. for chip-style multi-select).
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

const PRIMARY_TINT = Accent.primary + "14"; // ~8% alpha

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
          gap: Spacing.md + 2,
          padding: compact ? 14 : 16,
          borderRadius: Radius.lg,
          backgroundColor: selected ? PRIMARY_TINT : colors.card,
          borderWidth: 1,
          borderColor: selected ? Accent.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: Radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected
              ? Accent.primary + "26"
              : colors.inputBg,
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text
            numberOfLines={2}
            style={{
              color: colors.text,
              fontSize: compact ? 14 : 15,
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
                borderColor: selected ? Accent.primary : colors.cardBorder,
                backgroundColor: selected ? Accent.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected ? (
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              ) : null}
            </View>
          )}
    </Pressable>
  );
}

export default OptionCard;
