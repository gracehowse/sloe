import * as React from "react";
import { Text, View } from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Shared settings-row primitives (extracted from SettingsBundleContent for the
 * ENG-717 screen budget so they can be reused by sibling sections such as
 * BarcodeContributionsSection without a circular import). Visuals unchanged.
 */
export function IconBox({
  color,
  size = 36,
  children,
}: {
  color: string;
  size?: number;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  // Sloe DS (Figma 09 Settings `335:2`): every settings-row glyph sits
  // in a WHITE circle with a hairline outline (not a colour-tinted
  // rounded square). The circle reads as a quiet container; the glyph
  // itself carries any semantic colour the caller passes (e.g. clay
  // for nav rows, sage for Apple Health, red for delete). `color` is
  // intentionally NOT used as a fill any more — the frame's plates are
  // uniform white with a `cardBorder` ring.
  void color;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

export function SettingsRow({
  icon: Icon,
  iconColor,
  label,
  sub,
  badge,
  isFirst,
  testID,
  onPress,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  sub?: string;
  badge?: string;
  isFirst?: boolean;
  testID?: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  // P2-10 (2026-05-01) — tabular-nums on numeric sub copies. Things
  // like "400 mg/day", "120 g/week", "build 47" align across rows
  // when figures share the same advance width. Detection: any digit
  // in the string. Pure-text subs (e.g. "Connected") fall through
  // to the default proportional figures.
  const subHasNumber = typeof sub === "string" && /\d/.test(sub);
  return (
    <PressableScale
      haptic="selection"
      testID={testID}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.cardBorder,
      }}
    >
      <IconBox color={iconColor}>
        <Icon size={18} color={iconColor} strokeWidth={1.75} />
      </IconBox>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text,
            lineHeight: 17,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 2,
              ...(subHasNumber
                ? { fontVariant: ["tabular-nums"] as const }
                : {}),
            }}
            numberOfLines={2}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {badge ? (
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
            {badge}
          </Text>
        ) : null}
        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
      </View>
    </PressableScale>
  );
}
