import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Package, Trash2 } from "lucide-react-native";

import { Accent, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import {
  BARCODE_CONTRIBUTIONS_PRIVACY_COPY,
  BARCODE_CONTRIBUTIONS_SETTINGS_LABEL,
  BARCODE_CONTRIBUTIONS_SETTINGS_SUB,
  barcodeContributionStatusLabel,
  barcodeContributionTitle,
  barcodeContributionsCountLabel,
  type BarcodeContributionSummary,
} from "@suppr/nutrition-core/barcodeContributions";

import { SettingsRow } from "./SettingsRow";

/**
 * Barcode community-contribution withdrawal section (ENG-1250), extracted from
 * SettingsBundleContent for the ENG-717 screen budget. Self-contained: owns its
 * own fetch/state. Lists the caller's shared barcode products and lets them
 * remove (withdraw) any of them. Mobile reads/deletes directly via RLS-scoped
 * `user_foods` (submitted_by = userId). Web parity:
 * `src/app/components/settings/BarcodeContributionsSection.tsx`.
 */
export function BarcodeContributionsSection({ userId }: { userId: string | null }) {
  const accent = useAccent();
  const colors = useThemeColors();
  const [barcodeContributions, setBarcodeContributions] = useState<BarcodeContributionSummary[]>([]);
  const [barcodeContributionsLoading, setBarcodeContributionsLoading] = useState(false);
  const [barcodeContributionsOpen, setBarcodeContributionsOpen] = useState(false);
  const [barcodeContributionDeletingId, setBarcodeContributionDeletingId] = useState<string | null>(null);

  const loadBarcodeContributions = useCallback(async () => {
    if (!userId) {
      setBarcodeContributions([]);
      return;
    }
    setBarcodeContributionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_foods")
        .select("id, barcode, name, brand, verification_status, upvotes, downvotes, created_at, updated_at")
        .eq("submitted_by", userId)
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error || !data) {
        setBarcodeContributions([]);
        return;
      }
      setBarcodeContributions(data as BarcodeContributionSummary[]);
    } finally {
      setBarcodeContributionsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadBarcodeContributions();
  }, [loadBarcodeContributions]);

  const confirmDeleteBarcodeContribution = useCallback(
    (item: BarcodeContributionSummary) => {
      if (!userId) return;
      Alert.alert(
        "Remove barcode contribution?",
        `${barcodeContributionTitle(item)} will be removed from the community database. Your diary entries stay as they are.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setBarcodeContributionDeletingId(item.id);
              try {
                const { error } = await supabase
                  .from("user_foods")
                  .delete()
                  .eq("id", item.id)
                  .eq("submitted_by", userId);
                if (error) {
                  Alert.alert("Couldn't remove contribution", "Please try again.");
                  return;
                }
                setBarcodeContributions((current) =>
                  current.filter((candidate) => candidate.id !== item.id),
                );
              } finally {
                setBarcodeContributionDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [userId],
  );

  return (
    <>
      <SettingsRow
        testID="settings-bundle-barcode-contributions-row"
        icon={Package}
        iconColor={accent.primary}
        label={BARCODE_CONTRIBUTIONS_SETTINGS_LABEL}
        sub={
          barcodeContributionsLoading
            ? "Loading shared barcode products…"
            : `${barcodeContributionsCountLabel(barcodeContributions.length)}. ${BARCODE_CONTRIBUTIONS_SETTINGS_SUB}`
        }
        onPress={() => {
          setBarcodeContributionsOpen((open) => !open);
          if (!barcodeContributionsOpen) void loadBarcodeContributions();
        }}
      />
      {barcodeContributionsOpen ? (
        <View
          testID="settings-bundle-barcode-contributions-list"
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              lineHeight: 15,
              color: colors.textSecondary,
            }}
          >
            {BARCODE_CONTRIBUTIONS_PRIVACY_COPY}
          </Text>
          {barcodeContributions.length === 0 ? (
            <Text
              style={{
                ...Type.captionSmall,
                lineHeight: 16,
                color: colors.textSecondary,
              }}
            >
              Nothing shared yet. Barcode corrections you add will appear here.
            </Text>
          ) : (
            barcodeContributions.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  padding: 12,
                  backgroundColor: colors.background,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13,
                      lineHeight: 17,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {barcodeContributionTitle(item)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      lineHeight: 15,
                      color: colors.textSecondary,
                    }}
                  >
                    {item.barcode} · {barcodeContributionStatusLabel(item.verification_status)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${barcodeContributionTitle(item)} from barcode contributions`}
                  disabled={barcodeContributionDeletingId === item.id}
                  onPress={() => confirmDeleteBarcodeContribution(item)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: Radius.full,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: Accent.destructive,
                    opacity: barcodeContributionDeletingId === item.id ? 0.4 : 1,
                  }}
                >
                  <Trash2 size={16} color={Accent.destructive} strokeWidth={1.75} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}
    </>
  );
}

export default BarcodeContributionsSection;
