import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Link2 } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { listOwnMealShares, revokeMealShare } from "@/lib/mealShare";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  MEAL_SHARE_MANAGE_FLAG,
  deriveOwnMealShareLinkState,
  type OwnMealShareRow,
} from "@suppr/shared/share/mealShareLink";

import { SettingsRow } from "./SettingsRow";

function stateLabel(row: OwnMealShareRow): string {
  const state = deriveOwnMealShareLinkState(row);
  if (state === "active") return "Active";
  if (state === "expired") return "Expired";
  return "Revoked";
}

/**
 * ENG-1648 — "My shared links" Settings list + revoke (mobile).
 * Flag `meal_share_manage_v1` default OFF. Web parity:
 * `src/app/components/settings/MealSharedLinksSection.tsx`.
 */
export function MealSharedLinksSection() {
  const accent = useAccent();
  const colors = useThemeColors();
  const enabled = isFeatureEnabled(MEAL_SHARE_MANAGE_FLAG);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OwnMealShareRow[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOwnMealShares());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const onRevoke = useCallback((row: OwnMealShareRow) => {
    if (deriveOwnMealShareLinkState(row) !== "active") return;
    Alert.alert(
      "Revoke share link?",
      `Recipients will no longer be able to open “${row.title}”.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setRevokingId(row.id);
              try {
                const result = await revokeMealShare(row.id);
                if (result.status !== "revoked") {
                  Alert.alert("Couldn’t revoke", "Try again in a moment.");
                  return;
                }
                track(AnalyticsEvents.meal_share_link_revoked, { share_id: row.id });
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
            })();
          },
        },
      ],
    );
  }, []);

  if (!enabled) return null;

  const activeCount = rows.filter((r) => deriveOwnMealShareLinkState(r) === "active").length;

  return (
    <View testID="settings-meal-shared-links-row">
      <SettingsRow
        icon={Link2}
        iconColor={accent.primary}
        label="My shared links"
        sub={
          loading
            ? "Loading shared meal links…"
            : `${activeCount} active · Manage or revoke meal share links`
        }
        onPress={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      />
      {open ? (
        <View
          style={{
            marginHorizontal: Spacing.md,
            marginBottom: Spacing.sm,
            padding: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: Spacing.sm,
          }}
        >
          {rows.length === 0 && !loading ? (
            <Text style={{ ...Type.caption, color: colors.textSecondary }}>
              No shared meal links yet. Share a meal from Today to create one.
            </Text>
          ) : null}
          {rows.map((row) => {
            const state = deriveOwnMealShareLinkState(row);
            const canRevoke = state === "active";
            return (
              <View
                key={row.id}
                testID={`meal-share-row-${row.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: Spacing.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ ...Type.body, fontWeight: "600", color: colors.text }}
                  >
                    {row.title}
                  </Text>
                  <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs }}>
                    {row.mealSlot} · {stateLabel(row)} ·{" "}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {canRevoke ? (
                  <PressableScale
                    testID={`meal-share-revoke-${row.id}`}
                    haptic="light"
                    disabled={revokingId === row.id}
                    onPress={() => onRevoke(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke share link for ${row.title}`}
                  >
                    <Text
                      style={{
                        ...Type.caption,
                        fontWeight: "700",
                        color: Accent.destructive,
                        opacity: revokingId === row.id ? 0.5 : 1,
                      }}
                    >
                      {revokingId === row.id ? "…" : "Revoke"}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
