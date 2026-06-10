import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PushScreenHeader — canonical chrome for non-tab push screens.
 *
 * 2026-05-22 (DRIFT-04 fix): unifies push-screen header chrome.
 * Back chevron on the left, serif nav title (`Type.navTitle`), optional
 * caption underneath in `textSecondary`, optional right slot.
 *
 * 2026-06-09 (Spec 3): the title moved `Type.headline` → `Type.navTitle`
 * (Newsreader serif 18/22) — the single shared lever for the compact
 * nav-bar-row title voice across every push screen using this header.
 *
 * Screens that use this MUST be added to `STACK_HEADER_HIDDEN` in
 * `apps/mobile/app/_layout.tsx` so the auto-stack chrome doesn't
 * double up.
 */
export interface PushScreenHeaderProps {
  title: string;
  /** Optional caption directly under the title — date label, parent
   *  surface label, etc. Match the Burn Detail "Today" treatment. */
  caption?: string;
  onBack: () => void;
  /** Optional right-aligned slot for a contextual action / value pill. */
  rightSlot?: React.ReactNode;
  /** Override the back chevron a11y label. Default: "Back". */
  backA11yLabel?: string;
  style?: ViewStyle;
}

export function PushScreenHeader({
  title,
  caption,
  onBack,
  rightSlot,
  backA11yLabel = "Back",
  style,
}: PushScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      style={[
        {
          paddingTop: insets.top + Spacing.sm,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={backA11yLabel}
      >
        <ChevronLeft size={24} color={colors.text} strokeWidth={1.75} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ ...Type.navTitle, color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text
            style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
      </View>
      {rightSlot}
    </View>
  );
}

export default PushScreenHeader;
