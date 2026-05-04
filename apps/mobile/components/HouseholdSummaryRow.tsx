import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  getMyHousehold,
  type HouseholdData,
} from "../../../src/lib/household/householdClient";

const HOUSEHOLD_SUMMARY_FETCH_TIMEOUT_MS = 18_000;
const householdFetchTimedOut = Symbol("household_summary_timeout");

/**
 * P1-12 / P1-13 (TestFlight `ALQQyjCHjzbtxaCSPW18glk`,
 * `ALpppRnGzIx9Avg_bntZZfs`, `AK91aaRcQ6ILWgQIvCatZXI`,
 * `AJKHqJeCi83sCHF3_7CZMhY`, `AKQGhg8wc6FZdFl5PVl77Mc`, 2026-04-22):
 *
 * The full `HouseholdCard` (sharing grid + invite UI + leave button)
 * was eating ~50% of the Plan tab's above-the-fold space and
 * confused testers about which screen owned which job. The
 * prototype puts the full management screen behind a nav (More →
 * Household — `screens-mobile.jsx:717-769`, SimplePage at
 * `flows.jsx:673-996`).
 *
 * This row is the Plan-tab replacement: a 1-line summary that
 * reads "Howse · 2 members · sharing dinners" and tap-routes into
 * the existing `/household-settings` screen. When the user isn't
 * in a household, renders nothing (the More tab still surfaces a
 * "Set up household" entry).
 *
 * Web parity: `src/app/components/HouseholdPanel.tsx` continues to
 * render inline on the planner page until the same simplification
 * lands there in a follow-up commit.
 */
export function HouseholdSummaryRow() {
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const pack = await Promise.race([
          getMyHousehold(supabase as any, userId),
          new Promise<typeof householdFetchTimedOut>((resolve) => {
            setTimeout(() => resolve(householdFetchTimedOut), HOUSEHOLD_SUMMARY_FETCH_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (pack === householdFetchTimedOut) {
          console.warn(
            `[HouseholdSummaryRow] getMyHousehold timed out (${HOUSEHOLD_SUMMARY_FETCH_TIMEOUT_MS}ms)`,
          );
          setData(null);
          return;
        }
        const { data: result } = pack;
        setData(result ?? null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <View
        style={{
          marginHorizontal: Spacing.xl,
          marginTop: Spacing.sm,
          paddingVertical: Spacing.sm,
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="small" color={Accent.primary} />
      </View>
    );
  }

  if (!data || !data.household) return null;

  const memberCount = data.members?.length ?? 1;
  const memberWord = memberCount === 1 ? "member" : "members";
  const sharingPreset = (data.household as { share_lunch?: boolean }).share_lunch
    ? "sharing dinners + lunches"
    : "sharing dinners";
  const summary = `${(data.household as { name?: string }).name ?? "Household"} · ${memberCount} ${memberWord} · ${sharingPreset}`;

  return (
    <Pressable
      onPress={() => router.push("/household-settings")}
      style={{
        marginHorizontal: Spacing.xl,
        marginTop: Spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: Spacing.sm,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open household settings — ${summary}`}
    >
      <Ionicons name="people-outline" size={16} color={Accent.primary} />
      <Text
        style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: "500" }}
        numberOfLines={1}
      >
        {summary}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}
