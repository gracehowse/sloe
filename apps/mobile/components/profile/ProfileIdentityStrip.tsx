import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BookOpen, Flame } from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";

export interface ProfileIdentityStripProps {
  monogramInitial: string;
  displayName: string;
  isPro: boolean;
  joinedLabel: string | null;
  recipeCount: number;
  streak: number;
}

/**
 * ProfileIdentityStrip — the legacy §3.2 identity card + Recipes/Day-streak
 * stats strip (the partial gap #16 UI). Extracted out of the pinned
 * `app/profile.tsx` (ENG-1246) so the screen shell shrinks; rendered only in
 * the `sloe_v3_profile`-OFF kill-switch path. The flag-ON path renders
 * `EditorialProfileBlock` instead. Presentation unchanged from the inline
 * original — a lift-and-shift, not a redesign. Stats strip keeps the
 * subtractive-zero rule (each tile hidden at its own 0).
 */
function ProfileIdentityStripImpl({
  monogramInitial,
  displayName,
  isPro,
  joinedLabel,
  recipeCount,
  streak,
}: ProfileIdentityStripProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation({ variant: "soft" });
  const styles = useMemo(
    () => makeStyles(colors, accent, cardElevation),
    [colors, accent, cardElevation],
  );

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.identityCard}>
        <View style={styles.monogram} accessible={false}>
          <Text style={styles.monogramInitial}>{monogramInitial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.identityName} numberOfLines={1}>
            {displayName.trim() || "Your profile"}
          </Text>
          <Text style={styles.identityMeta} numberOfLines={1}>
            {isPro ? "Pro" : "Free"}
            {joinedLabel ? ` · ${joinedLabel}` : ""}
          </Text>
        </View>
        {isPro ? (
          <View style={styles.tierPill}>
            <Text style={styles.tierPillText}>Pro</Text>
          </View>
        ) : null}
      </View>

      {recipeCount > 0 || streak > 0 ? (
        <View style={styles.statsStrip}>
          {recipeCount > 0 ? (
            <View style={styles.statTile}>
              <View style={styles.statTileHeader}>
                <BookOpen size={16} color={Accent.success} strokeWidth={1.75} />
                <Text style={styles.statTileLabel}>Recipes saved</Text>
              </View>
              <Text style={styles.statTileValue}>{recipeCount}</Text>
            </View>
          ) : null}
          {streak > 0 ? (
            <View style={styles.statTile}>
              <View style={styles.statTileHeader}>
                <Flame size={16} color={accent.primarySolid} strokeWidth={1.75} />
                <Text style={styles.statTileLabel}>Day streak</Text>
              </View>
              <Text style={styles.statTileValue}>{streak}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
  cardElevation: ReturnType<typeof useCardElevation>,
) {
  return StyleSheet.create({
    identityCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: Radius.lg,
      borderWidth: cardElevation.useBorder ? 1 : 0,
      borderColor: colors.border,
      padding: Spacing.md,
      ...(cardElevation.shadowStyle ?? {}),
    },
    monogram: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      backgroundColor: accent.primarySolid,
      alignItems: "center",
      justifyContent: "center",
    },
    monogramInitial: { ...Type.title, color: colors.primaryForeground },
    identityName: { ...Type.title, color: colors.text },
    identityMeta: { ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    tierPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: accent.primarySoft,
    },
    tierPillText: { ...Type.label, color: accent.primarySolid },
    statsStrip: { flexDirection: "row", gap: Spacing.md },
    statTile: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    statTileHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    statTileLabel: { ...Type.caption, color: colors.textSecondary },
    statTileValue: {
      ...Type.heroValue,
      fontSize: 24,
      lineHeight: 28,
      fontVariant: ["tabular-nums"],
      color: colors.text,
    },
  });
}

export const ProfileIdentityStrip = memo(ProfileIdentityStripImpl);

export default ProfileIdentityStrip;
