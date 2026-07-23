import * as React from "react";
import { useState } from "react";
import { Modal, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ellipsis, type LucideIcon } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprCard } from "@/components/ui/SupprCard";
import { Accent, Radius, Spacing, StimulantColors, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useMacroColors } from "@/lib/macroColors";
import { useThemeColors } from "@/hooks/use-theme-colors";

function tones(water: string): Record<"water" | "caffeine" | "alcohol", string> {
  return { water, caffeine: StimulantColors.caffeine, alcohol: Accent.warning };
}

export function SloeCard({
  title,
  rightLabel,
  children,
  testID,
  accessibilityLabel,
  style,
}: {
  title: string;
  rightLabel?: string;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  return (
    <SupprCard lift="soft" testID={testID} accessibilityLabel={accessibilityLabel} padding="none" style={style}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.sm,
        }}
      >
        <Text style={{ ...Type.headline, color: colors.navPrimary }}>{title}</Text>
        {rightLabel ? (
          <Text style={{ ...Type.caption, color: colors.textTertiary }}>{rightLabel}</Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>{children}</View>
    </SupprCard>
  );
}

export function HydrationStimulantRow({
  label,
  icon: Icon,
  tone,
  value,
  unitSuffix,
  secondaryLine,
  pct,
  overTarget,
  overCopy,
  emphasizeValue,
  topBorder,
  children,
  onReset,
}: {
  label: string;
  icon: LucideIcon;
  tone: "water" | "caffeine" | "alcohol";
  value: string;
  unitSuffix: string;
  secondaryLine?: string;
  pct: number;
  overTarget: boolean;
  overCopy: string;
  emphasizeValue?: boolean;
  topBorder?: boolean;
  children: React.ReactNode;
  onReset: () => void;
}) {
  const colors = useThemeColors();
  const tone$ = tones(useMacroColors().colors.water);
  const cardElevation = useCardElevation();
  const [menuOpen, setMenuOpen] = useState(false);
  const barColor = overTarget ? Accent.warning : tone$[tone];
  return (
    <View
      style={{
        paddingTop: topBorder ? Spacing.md : 0,
        borderTopWidth: topBorder ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.border,
        marginTop: topBorder ? Spacing.md : 0,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Icon size={18} color={tone$[tone]} />
          <Text numberOfLines={1} style={{ ...Type.bodyLarge, color: colors.text }}>
            {label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Text
            style={{
              ...(emphasizeValue ? Type.title : Type.headline),
              color: colors.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {value}
            {unitSuffix ? (
              <Text style={{ ...Type.caption, color: colors.textTertiary }}> {unitSuffix}</Text>
            ) : null}
          </Text>
          <PressableScale
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={`${label} row more options`}
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={{ padding: 0 }}
          >
            <Ellipsis size={16} color={colors.textSecondary} />
          </PressableScale>
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        style={{
          width: "100%",
          height: tone === "water" ? 8 : 6,
          borderRadius: 4,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: "100%",
            borderRadius: 4,
            backgroundColor: barColor,
          }}
        />
      </View>

      {secondaryLine ? (
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: Spacing.xs }}>
          {secondaryLine}
        </Text>
      ) : null}
      {overTarget ? (
        <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.warningSolid, marginTop: Spacing.xs }}>
          {overCopy}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.md }}>
        {children}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <PressableScale
          scaleTo={1}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          onPress={() => setMenuOpen(false)}
          style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "center", alignItems: "center" }}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={[
              {
                minWidth: 220,
                backgroundColor: cardElevation.liftBg ?? colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: cardElevation.useBorder ? 1 : 0,
                borderColor: colors.cardBorder,
              },
              cardElevation.shadowStyle,
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm }}>
              {label} — more
            </Text>
            <PressableScale
              haptic="destructive"
              accessibilityRole="button"
              accessibilityLabel={`Reset today's ${label.toLowerCase()}`}
              onPress={() => {
                onReset();
                setMenuOpen(false);
              }}
              style={{ paddingVertical: Spacing.dense }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Reset today</Text>
            </PressableScale>
            <PressableScale
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setMenuOpen(false)}
              style={{ paddingVertical: Spacing.dense }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textSecondary }}>Cancel</Text>
            </PressableScale>
          </View>
        </PressableScale>
      </Modal>
    </View>
  );
}

export function HydrationQuickAddChip({
  tone,
  label,
  accessibilityLabel,
  onPress,
}: {
  tone: "water" | "caffeine" | "alcohol";
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const waterTone = useMacroColors().colors.water;
  const labelColor = tone === "alcohol" ? accent.alcoholSolid : tones(waterTone)[tone];
  return (
    <PressableScale
      haptic="confirm"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: "22%",
        alignItems: "center",
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.full,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: labelColor }}>
        {label}
      </Text>
    </PressableScale>
  );
}
