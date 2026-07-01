/**
 * HouseholdInviteSheet — F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`,
 * 2026-05-06): the previously-dead "+ Add" button on the Household
 * settings page now opens this sheet. Owner enters an email, the
 * RPC `household_invite_send` persists a pending invite, the next
 * time the invitee opens Suppr they see an Accept/Decline banner on
 * /household.
 *
 * Two surfaces inside the sheet:
 *  - Send invite: email input + "Send invite" button.
 *  - Sent invites: list of outstanding invites with status pill +
 *    cancel action for pending rows.
 *
 * The 6-char invite code is also surfaced at the bottom for users who
 * prefer the share-the-code flow (it remains the working fallback).
 */
import React, { useCallback, useEffect, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Mail, Plus, Trash2, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { getSupprApiBase, getSupprWebBase } from "@/lib/supprWeb";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { supabase } from "@/lib/supabase";
import {
  cancelHouseholdInvite,
  listSentHouseholdInvites,
  sendHouseholdInvite,
  type HouseholdInvite,
} from "@suppr/shared/household/householdClient";
import {
  getOrCreateReferralReward,
  REFERRAL_FLAG,
  type ReferralReward,
} from "@suppr/shared/referrals/referralClient";
import { ReferralRewardCard } from "./ReferralRewardCard";

export interface HouseholdInviteSheetProps {
  visible: boolean;
  householdId: string;
  inviteCode: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<HouseholdInvite["status"], string> = {
  pending: "Pending",
  accepted: "Joined",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

const ERROR_COPY: Record<string, string> = {
  missing_email: "Add an email address first.",
  invalid_email: "That doesn't look like a valid email.",
  cannot_invite_self: "You can't invite yourself.",
  not_household_owner: "Only the household owner can send invites.",
  invite_failed: "Couldn't send the invite — try again in a moment.",
  cancel_failed: "Couldn't cancel that invite.",
  load_failed: "Couldn't load invites.",
};

export function HouseholdInviteSheet({
  visible,
  householdId,
  inviteCode,
  onClose,
}: HouseholdInviteSheetProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Send CTA and the
  // pending-invites spinner. Revoke actions keep `Accent.destructive`.
  const accent = useAccent();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [referralReward, setReferralReward] = useState<ReferralReward | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const referralEnabled = isFeatureEnabled(REFERRAL_FLAG);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await listSentHouseholdInvites(supabase as any, householdId);
    setInvites(result.data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    if (visible) void reload();
    else setEmail("");
  }, [visible, reload]);

  useEffect(() => {
    if (!visible || !referralEnabled) return;
    let cancelled = false;
    const base = getSupprWebBase() || getSupprApiBase();
    setReferralLoading(true);
    setReferralError(null);
    void getOrCreateReferralReward(supabase as any, base)
      .then((result) => {
        if (cancelled) return;
        setReferralReward(result.data);
        setReferralError(result.error);
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, referralEnabled]);

  const onSend = useCallback(async () => {
    setSending(true);
    const result = await sendHouseholdInvite(supabase as any, householdId, email);
    setSending(false);
    if (result.error) {
      Alert.alert("Couldn't send invite", ERROR_COPY[result.error] ?? ERROR_COPY.invite_failed);
      return;
    }
    setEmail("");
    await reload();
  }, [email, householdId, reload]);

  const onCancel = useCallback(
    async (invite: HouseholdInvite) => {
      Alert.alert("Cancel invite", `Cancel the invite to ${invite.invitee_email}?`, [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel invite",
          style: "destructive",
          onPress: async () => {
            const result = await cancelHouseholdInvite(supabase as any, invite.id);
            if (result.error) {
              Alert.alert("Couldn't cancel", ERROR_COPY[result.error] ?? "Try again.");
              return;
            }
            await reload();
          },
        },
      ]);
    },
    [reload],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: MODAL_OVERLAY_SCRIM }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingHorizontal: Spacing.xl,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.xxxl,
            maxHeight: "92%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.lg,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
              Invite to household
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close invite sheet"
              onPress={onClose}
              hitSlop={10}
            >
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {referralEnabled && (
              <ReferralRewardCard
                reward={referralReward}
                loading={referralLoading}
                error={referralError}
              />
            )}

            {/* Email input + send action */}
            <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                Send by email
              </Text>
              <View style={{ flexDirection: "row", gap: Spacing.sm, alignItems: "center" }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.sm,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: Radius.md,
                    paddingHorizontal: Spacing.md,
                  }}
                >
                  <Mail size={16} color={colors.textTertiary} />
                  <TextInput
                    testID="household-invite-email-input"
                    accessibilityLabel="Invite email"
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!sending}
                    style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text }}
                  />
                </View>
                <Pressable
                  testID="household-invite-send"
                  accessibilityRole="button"
                  accessibilityLabel="Send invite"
                  onPress={onSend}
                  disabled={sending || email.trim().length === 0}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: Spacing.lg,
                    borderRadius: Radius.md,
                    backgroundColor: accent.primary,
                    opacity: sending || email.trim().length === 0 ? 0.5 : 1,
                  }}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 14 }}>Send</Text>
                  )}
                </Pressable>
              </View>
              <Text style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16 }}>
                {"They'll see an Accept / Decline prompt the next time they open Sloe."}
              </Text>
            </View>

            {/* Sent invites list */}
            <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                Invites sent
              </Text>
              {loading ? (
                <View style={{ paddingVertical: Spacing.lg, alignItems: "center" }}>
                  <ActivityIndicator color={accent.primary} />
                </View>
              ) : invites.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textTertiary, paddingVertical: Spacing.sm }}>
                  No invites yet.
                </Text>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: Radius.md,
                    overflow: "hidden",
                  }}
                >
                  {invites.map((inv, i) => (
                    <View
                      key={inv.id}
                      testID={`household-invite-row-${inv.id}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
                        padding: Spacing.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                          {inv.invitee_email}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {STATUS_LABEL[inv.status]}
                        </Text>
                      </View>
                      {inv.status === "pending" && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel invite to ${inv.invitee_email}`}
                          onPress={() => onCancel(inv)}
                          hitSlop={6}
                        >
                          <Trash2 size={16} color={Accent.destructive} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Invite code fallback */}
            <View
              style={{
                gap: Spacing.sm,
                padding: Spacing.lg,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: Radius.md,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                Or share a code
              </Text>
              <Text
                testID="household-invite-code"
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  letterSpacing: 4,
                  fontVariant: ["tabular-nums"],
                  textAlign: "center",
                  paddingVertical: Spacing.sm,
                }}
              >
                {inviteCode.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16, textAlign: "center" }}>
                {'Anyone with this code can join from "Join household" on their device.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default HouseholdInviteSheet;

// Reference required identifiers to silence the unused-import linter
// for icons that may be used in test snapshots only.
void Plus;
