import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Link2 } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import {
  MEAL_SHARED_LINKS_PRIVACY_COPY,
  MEAL_SHARED_LINKS_SETTINGS_LABEL,
  MEAL_SHARED_LINKS_SETTINGS_SUB,
  formatMealShareDate,
  mealShareViewState,
  mealShareViewStateLabel,
  mealSharedLinksCountLabel,
  parseMealShareRow,
  type MealShareRow,
} from "@suppr/shared/share/mealSharedLinks";

import { SettingsRow } from "./SettingsRow";

async function listMobileMealShares(userId: string | null, limit = 50): Promise<MealShareRow[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("meal_shares")
    .select("id, token, title, meal_slot, created_at, expires_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .map(parseMealShareRow)
    .filter((row): row is MealShareRow => row !== null);
}

async function revokeMobileMealShare(shareId: string): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc("revoke_meal_share", {
    p_share_id: shareId,
  });
  if (error || data == null || typeof data !== "object") {
    return { status: "error" };
  }
  const status = (data as Record<string, unknown>).status;
  return { status: typeof status === "string" ? status : "error" };
}

export interface MealSharedLinksSectionProps {
  userId: string | null;
  /** When true, expand the list on mount (post-share "Manage" deep link). */
  initialOpen?: boolean;
}

/**
 * ENG-1648 — meal share link management (list + revoke). Extracted from
 * SettingsBundleContent for the ENG-717 screen budget. Web parity:
 * `src/app/components/settings/MealSharedLinksSection.tsx`.
 */
export function MealSharedLinksSection({
  userId,
  initialOpen = false,
}: MealSharedLinksSectionProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  const [rows, setRows] = useState<MealShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(initialOpen);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMobileMealShares(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  const confirmRevoke = useCallback(
    (row: MealShareRow) => {
      if (!userId || mealShareViewState(row) !== "active") return;
      Alert.alert(
        "Revoke share link?",
        `"${row.title}" won't be addable from this link anymore.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              setRevokingId(row.id);
              try {
                const result = await revokeMobileMealShare(row.id);
                if (result.status !== "revoked") {
                  Alert.alert("Couldn't revoke link", "Please try again.");
                  return;
                }
                track("meal_share_link_revoked", { surface: "settings_privacy" });
                setRows((current) =>
                  current.map((candidate) =>
                    candidate.id === row.id
                      ? { ...candidate, revokedAt: new Date().toISOString() }
                      : candidate,
                  ),
                );
              } finally {
                setRevokingId(null);
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
        testID="settings-bundle-meal-shared-links-row"
        icon={Link2}
        iconColor={accent.primary}
        label={MEAL_SHARED_LINKS_SETTINGS_LABEL}
        sub={
          loading
            ? "Loading shared meal links…"
            : `${mealSharedLinksCountLabel(rows.length)}. ${MEAL_SHARED_LINKS_SETTINGS_SUB}`
        }
        onPress={() => {
          setOpen((wasOpen) => !wasOpen);
          if (!open) void loadRows();
        }}
      />
      {open ? (
        <View
          testID="settings-bundle-meal-shared-links-list"
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
            {MEAL_SHARED_LINKS_PRIVACY_COPY}
          </Text>
          {rows.length === 0 ? (
            <Text
              style={{
                ...Type.captionSmall,
                lineHeight: 16,
                color: colors.textSecondary,
              }}
            >
              Nothing shared yet. Meal links you create from Today will appear here.
            </Text>
          ) : (
            rows.map((row) => {
              const state = mealShareViewState(row);
              const canRevoke = state === "active";
              return (
                <View
                  key={row.id}
                  testID={`settings-meal-shared-link-${row.id}`}
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
                      {row.title}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        lineHeight: 15,
                        color: colors.textSecondary,
                      }}
                    >
                      {row.mealSlot} · Created {formatMealShareDate(row.createdAt)} · Expires{" "}
                      {formatMealShareDate(row.expiresAt)}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        lineHeight: 15,
                        color: colors.textSecondary,
                      }}
                    >
                      {mealShareViewStateLabel(state)}
                    </Text>
                  </View>
                  {canRevoke ? (
                    <PressableScale
                      haptic="destructive"
                      accessibilityRole="button"
                      accessibilityLabel={`Revoke share link for ${row.title}`}
                      testID={`settings-meal-shared-link-revoke-${row.id}`}
                      disabled={revokingId === row.id}
                      onPress={() => confirmRevoke(row)}
                      style={{
                        paddingHorizontal: Spacing.sm,
                        paddingVertical: Spacing.xs,
                        borderRadius: Radius.md,
                        borderWidth: 1,
                        borderColor: Accent.destructive,
                        opacity: revokingId === row.id ? 0.4 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          lineHeight: 15,
                          fontWeight: "600",
                          color: Accent.destructive,
                        }}
                      >
                        {revokingId === row.id ? "Revoking…" : "Revoke"}
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </>
  );
}

export default MealSharedLinksSection;
