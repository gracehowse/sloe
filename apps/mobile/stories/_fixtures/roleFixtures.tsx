import React from "react";
import { View, Text } from "react-native";
import { Info } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/** Catalog fixture for the IconButton role — shared primitive is not shipped yet. */
export function IconButtonFixture({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="selection"
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.fillQuiet,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Info size={IconSize.sm} color={accent.primarySolid} strokeWidth={2.25} />
    </PressableScale>
  );
}

/** Catalog fixture for the CountBadge role — extracted from SubTabPill grammar. */
export function CountBadgeFixture({
  count,
  active = false,
}: {
  count: number;
  active?: boolean;
}) {
  const colors = useThemeColors();

  if (count <= 0) return null;

  return (
    <View
      style={{
        minWidth: 20,
        height: 18,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.full,
        backgroundColor: active ? colors.text : colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: active ? colors.primaryForeground : colors.textSecondary,
        }}
      >
        {count > 999 ? "999+" : count}
      </Text>
    </View>
  );
}

/** Catalog fixture for the Sheet role — chrome only, not a feature sheet. */
export function SheetChromeFixture({ title }: { title: string }) {
  const colors = useThemeColors();

  return (
    <View style={{ width: 360 }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />
      <View
        style={{
          marginTop: Spacing.xxl,
          borderTopLeftRadius: Radius.card,
          borderTopRightRadius: Radius.card,
          backgroundColor: colors.cardElevated,
          padding: Spacing.lg,
          gap: Spacing.sm,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: Radius.full,
            backgroundColor: colors.border,
          }}
        />
        <Text style={{ ...Type.title, color: colors.text }}>{title}</Text>
        <Text style={{ ...Type.body, color: colors.textSecondary }}>
          Sheet body — floated task surface with the same 24px corner as cards.
        </Text>
      </View>
    </View>
  );
}
