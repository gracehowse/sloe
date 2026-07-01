import React, { useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from "react-native";
import { Gift, Share2 } from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { ReferralReward } from "@suppr/shared/referrals/referralClient";

export function ReferralRewardCard({
  reward,
  loading,
  error,
}: {
  reward: ReferralReward | null;
  loading: boolean;
  error: string | null;
}) {
  const colors = useThemeColors();
  const accent = useAccent();

  const onShare = useCallback(async () => {
    if (!reward?.referralUrl) return;
    try {
      await Share.share({
        message: `Try Sloe with me. We both get 30 Pro days when you join: ${reward.referralUrl}`,
      });
    } catch {
      Alert.alert("Couldn't share", "Try again in a moment.");
    }
  }, [reward?.referralUrl]);

  return (
    <View
      testID="referral-reward-card"
      style={{
        gap: Spacing.md,
        padding: Spacing.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: Radius.md,
        marginBottom: Spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: Radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.primarySoft,
          }}
        >
          <Gift size={16} color={accent.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...Type.body, color: colors.text }}>
            Give 30 Pro days
          </Text>
          <Text style={{ ...Type.captionStrong, marginTop: Spacing.xs, color: colors.textSecondary }}>
            Share your Sloe link. When a friend joins, you both earn a 30-day Pro reward.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={accent.primary} />
      ) : error ? (
        <Text style={{ ...Type.caption, color: Accent.destructive }}>
          {"Couldn't load your referral link."}
        </Text>
      ) : reward ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share referral link"
          onPress={onShare}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: Spacing.sm,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ ...Type.captionStrong, flex: 1, color: colors.text }}
          >
            {reward.referralUrl}
          </Text>
          <Share2 size={16} color={accent.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
