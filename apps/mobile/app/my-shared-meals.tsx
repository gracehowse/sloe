/**
 * ENG-1648 — "My shared links" management screen (the revoke surface
 * ENG-1642 promised but never shipped a UI for).
 *
 * Reached from Settings → People → "Shared meals". Lists the current
 * user's own `meal_shares` rows — title / meal slot / created / expires /
 * state, deliberately no item count or pagination — via `listMealShares`
 * (a direct RLS-scoped `.select()`, no RPC needed to read your own rows)
 * and lets you revoke any ACTIVE row via the existing `revoke_meal_share`
 * RPC (`revokeMealShare`). Revoking never removes the row: `revokedAt`
 * flips locally, the badge flips to "Revoked", and the Revoke button
 * disappears — mirrors web's `my-shared-links-dialog.tsx` outcome exactly.
 *
 * Free tier, no paywall — this is the owner managing their own data, not a
 * premium surface.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, Users } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { useSafeBack } from "@/hooks/use-safe-back";
import { settingsRoute } from "@/lib/settingsRoute";
import { useHaptics } from "@/hooks/useHaptics";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui/Toast";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { NutritionDetailEmptyState } from "@/components/nutrition/NutritionDetailEmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { Badge } from "@/components/Badge";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { listMealShares, revokeMealShare } from "@/lib/mealShare";
import {
  deriveMealShareRowState,
  type MealShareListRow,
  type MealShareRowState,
} from "@suppr/shared/share/mealShareLink";

const ANALYTICS_SURFACE = "mobile_settings_people";

function formatShareDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Small neutral metadata pill (meal slot) — matches the row-card grammar
 *  used elsewhere in Settings (`BarcodeContributionsSection.tsx`). */
function SlotChip({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: Radius.full,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
      }}
    >
      <Text style={[Type.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function StateBadge({ state }: { state: MealShareRowState }) {
  if (state === "active") return <Badge variant="added" accessibilityLabel="Active link">Active</Badge>;
  if (state === "expired") return <Badge variant="warn" accessibilityLabel="Expired link">Expired</Badge>;
  return <Badge variant="neutral" accessibilityLabel="Revoked link">Revoked</Badge>;
}

export default function MySharedMealsScreen() {
  // Mirrors health-sync.tsx — settingsRoute() resolves to the legacy tab
  // path when `bottom_chrome_contract_v1` is off, so back never dead-ends
  // for the pre-flag fleet.
  const goBack = useSafeBack(settingsRoute());
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const accent = useAccent();
  const haptics = useHaptics();
  const toast = useToast();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<MealShareListRow[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    const result = await listMealShares(userId);
    if (result.status === "ok") {
      setRows(result.rows);
      track(AnalyticsEvents.shared_links_list_viewed, { surface: ANALYTICS_SURFACE, shareCount: result.rows.length });
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const handleRevoke = useCallback(
    (row: MealShareListRow) => {
      Alert.alert(
        "Revoke this link?",
        "Anyone with this link will no longer be able to add it to their log.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              setRevokingId(row.id);
              try {
                const result = await revokeMealShare(row.id);
                if (result.status === "revoked") {
                  setRows((current) =>
                    current.map((r) =>
                      r.id === row.id ? { ...r, revokedAt: new Date().toISOString() } : r,
                    ),
                  );
                  haptics.confirm();
                  toast.showToast("Link revoked", { variant: "success" });
                  track(AnalyticsEvents.shared_link_revoked, { surface: ANALYTICS_SURFACE });
                } else {
                  toast.showToast("Couldn't revoke this link. Try again.", { variant: "error" });
                }
              } finally {
                setRevokingId(null);
              }
            },
          },
        ],
      );
    },
    [haptics, toast],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={accent.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PushScreenHeader title="Shared meals" onBack={goBack} />
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <NutritionDetailEmptyState
            testID="my-shared-meals-error"
            icon={CircleAlert}
            title="Couldn't load your shared meals"
            subtitle="Check your connection and try again."
            ctaLabel="Try again"
            onPress={() => void loadShares()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        icon={toast.icon}
        position="bottom"
        inset={insets.bottom + Spacing.lg}
        testID="my-shared-meals-toast"
      />
      <PushScreenHeader title="Shared meals" onBack={goBack} />
      <ScrollView
        testID="screen-my-shared-meals"
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.dense }}
      >
        {rows.length === 0 ? (
          <NutritionDetailEmptyState
            testID="my-shared-meals-empty"
            icon={Users}
            title="No shared meals yet."
            subtitle="Meals you share from Today will show up here."
          />
        ) : (
          rows.map((row) => {
            const state = deriveMealShareRowState(row, new Date());
            const isRevoking = revokingId === row.id;
            return (
              <View
                key={row.id}
                testID={`my-shared-meals-row-${row.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: Spacing.dense,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.lg,
                  padding: Spacing.dense,
                  backgroundColor: colors.card,
                }}
              >
                <View style={{ flex: 1, gap: Spacing.xs }}>
                  <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]} numberOfLines={2}>
                    {row.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                    <SlotChip label={row.mealSlot} />
                    <StateBadge state={state} />
                  </View>
                  <Text style={[Type.captionSmall, { color: colors.textSecondary }]}>
                    Created {formatShareDate(row.createdAt)}
                  </Text>
                  <Text style={[Type.captionSmall, { color: colors.textSecondary }]}>
                    {state === "revoked" && row.revokedAt
                      ? `Revoked ${formatShareDate(row.revokedAt)}`
                      : `Expires ${formatShareDate(row.expiresAt)}`}
                  </Text>
                </View>
                {state === "active" ? (
                  <PressableScale
                    haptic="warn"
                    testID={`my-shared-meals-revoke-${row.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke ${row.title}`}
                    disabled={isRevoking}
                    onPress={() => handleRevoke(row)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: Spacing.sm,
                      paddingVertical: Spacing.xs,
                      borderRadius: Radius.full,
                      borderWidth: 1,
                      borderColor: Accent.destructive,
                      opacity: isRevoking ? 0.4 : 1,
                    }}
                  >
                    {isRevoking ? (
                      <ActivityIndicator size="small" color={Accent.destructive} />
                    ) : (
                      <Text style={[Type.captionStrong, { color: Accent.destructive }]}>Revoke</Text>
                    )}
                  </PressableScale>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
