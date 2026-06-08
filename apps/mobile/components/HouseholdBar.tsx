/**
 * Mobile HouseholdBar — compact pill bar.
 *
 * 2026-04-20 Claude Design prototype port — mirror of
 * `src/app/components/HouseholdBar.tsx` (web). Rendered at the top
 * of Plan + Progress for household users. Hidden for solo users
 * so it never steals vertical space.
 *
 * Parity note: every visible string / accent lookup / index→colour
 * assignment is shared with web via
 * `src/lib/household/memberAccents.ts`. The parity test
 * `tests/unit/householdBarParity.test.ts` pins the assignment so
 * a web change can't silently skew mobile.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import {
  getMyHousehold,
  type HouseholdData,
} from "@suppr/shared/household/householdClient";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "@suppr/shared/household/memberAccents";

export type HouseholdBarProps = {
  selected?: string;
  onSelect?: (memberIdOrAll: string) => void;
  /** Override default navigation to /household-settings. */
  onManage?: () => void;
};

export function HouseholdBar({ selected, onSelect, onManage }: HouseholdBarProps) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active household
  // chip + the manage link.
  const accent = useAccent();
  const router = useRouter();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSelected, setLocalSelected] = useState<string>(selected ?? "all");

  useEffect(() => {
    if (selected != null) setLocalSelected(selected);
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: result } = await getMyHousehold(supabase as any, userId);
        if (!cancelled && result) setData(result);
      } catch {
        // Silently hide the bar on load error; HouseholdCard below
        // owns surfacing the "couldn't load" alert.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const members = useMemo(() => data?.members ?? [], [data]);

  const handlePick = useCallback(
    (id: string) => {
      setLocalSelected(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  const handleManage = useCallback(() => {
    if (onManage) {
      onManage();
      return;
    }
    router.push("/household-settings" as any);
  }, [onManage, router]);

  if (!userId || loading) return null;
  if (!data?.household || members.length === 0) return null;
  // 2026-05-22 evening (Grace): hide for solo households — "All 1" +
  // "Member" pills next to "Manage" link with no other members read
  // as visual clutter, not a useful affordance. Multi-member
  // households still get the switcher.
  if (members.length <= 1) return null;

  const currentSel = selected ?? localSelected;
  const chipColors = (active: boolean) => ({
    bg: active ? accent.primary + "26" : colors.inputBg,
    fg: active ? accent.primary : colors.textSecondary,
  });
  const allChip = chipColors(currentSel === "all");

  return (
    <View
      testID="household-bar"
      style={{
        marginBottom: 14,
        padding: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: Radius.lg,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1.4,
            color: colors.textTertiary,
            textTransform: "uppercase",
          }}
        >
          Household
        </Text>
        <Pressable
          onPress={handleManage}
          accessibilityRole="button"
          accessibilityLabel="Manage household"
          testID="household-bar-manage"
          hitSlop={8}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: accent.primary }}>
            Manage
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingBottom: 2 }}
        style={{ marginHorizontal: -2 }}
      >
        <Pressable
          onPress={() => handlePick("all")}
          testID="household-bar-pill-all"
          accessibilityRole="tab"
          accessibilityState={{ selected: currentSel === "all" }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
            backgroundColor: allChip.bg,
            borderRadius: 999,
          }}
        >
          <Ionicons name="people-outline" size={12} color={allChip.fg} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: allChip.fg }}>
            All {members.length}
          </Text>
        </Pressable>
        {members.map((m, idx) => {
          const color = householdMemberAccent(idx);
          const initials = householdMemberInitials(m.displayName);
          const first = householdMemberFirstName(m.displayName);
          const active = currentSel === m.userId;
          const chip = chipColors(active);
          return (
            <Pressable
              key={m.userId}
              onPress={() => handlePick(m.userId)}
              testID={`household-bar-pill-${m.userId}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 4,
                paddingRight: 10,
                paddingLeft: 4,
                backgroundColor: chip.bg,
                borderRadius: 999,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                  {initials}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: chip.fg }}>{first}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
