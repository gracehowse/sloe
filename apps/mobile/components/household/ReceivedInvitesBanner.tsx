/**
 * ReceivedInvitesBanner — F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`,
 * 2026-05-06): the invitee side of the email-targeted household invite
 * flow. Pulls pending invites addressed to the caller's email (RLS
 * scopes by JWT email) and surfaces an Accept / Decline pair per invite.
 *
 * Mounted on `HouseholdCard` (Plan tab) so it's the first thing a user
 * with no household sees — the moment they sign in after being invited
 * the banner appears, no email or push notification needed in v1.
 *
 * Self-loading + self-refreshing — host just renders it and passes an
 * `onAccepted` callback so household state can be re-pulled after the
 * user joins.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Mail } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import {
  acceptHouseholdInvite,
  declineHouseholdInvite,
  listReceivedHouseholdInvites,
  type HouseholdInvite,
} from "@suppr/shared/household/householdClient";

export interface ReceivedInvitesBannerProps {
  onAccepted?: () => void;
}

export function ReceivedInvitesBanner({ onAccepted }: ReceivedInvitesBannerProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await listReceivedHouseholdInvites(supabase as any);
    setInvites(result.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAccept = useCallback(
    async (invite: HouseholdInvite) => {
      setBusyId(invite.id);
      const result = await acceptHouseholdInvite(supabase as any, invite.id);
      setBusyId(null);
      if (result.error) {
        Alert.alert(
          "Couldn't accept invite",
          result.error === "accept_failed"
            ? "The invite may have expired. Ask the inviter to send a new one."
            : "Try again in a moment.",
        );
        return;
      }
      await reload();
      onAccepted?.();
    },
    [onAccepted, reload],
  );

  const handleDecline = useCallback(
    async (invite: HouseholdInvite) => {
      Alert.alert(
        "Decline invite?",
        `Decline the invite to join ${invite.invitee_email.split("@")[0]}'s household?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: async () => {
              setBusyId(invite.id);
              const result = await declineHouseholdInvite(supabase as any, invite.id);
              setBusyId(null);
              if (result.error) {
                Alert.alert("Couldn't decline", "Try again in a moment.");
                return;
              }
              await reload();
            },
          },
        ],
      );
    },
    [reload],
  );

  if (loading || invites.length === 0) {
    return null;
  }

  return (
    <View
      testID="household-received-invites-banner"
      style={{
        gap: Spacing.sm,
        marginBottom: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: accent.primary + "40",
        backgroundColor: accent.primary + "10",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mail size={16} color={accent.primary} />
        <Text style={{ fontSize: 13, fontWeight: "700", color: accent.primary, letterSpacing: 0.5 }}>
          {invites.length === 1 ? "Household invitation" : `${invites.length} household invitations`}
        </Text>
      </View>
      {invites.map((inv) => (
        <View key={inv.id} style={{ gap: Spacing.sm, paddingTop: Spacing.xs }}>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
            {"You've been invited to join a household."}
          </Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <Pressable
              testID={`household-invite-accept-${inv.id}`}
              accessibilityRole="button"
              accessibilityLabel="Accept invite"
              onPress={() => handleAccept(inv)}
              disabled={busyId === inv.id}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: Radius.md,
                backgroundColor: accent.primary,
                alignItems: "center",
                opacity: busyId === inv.id ? 0.5 : 1,
              }}
            >
              {busyId === inv.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Accept</Text>
              )}
            </Pressable>
            <Pressable
              testID={`household-invite-decline-${inv.id}`}
              accessibilityRole="button"
              accessibilityLabel="Decline invite"
              onPress={() => handleDecline(inv)}
              disabled={busyId === inv.id}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                alignItems: "center",
                opacity: busyId === inv.id ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                Decline
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export default ReceivedInvitesBanner;
