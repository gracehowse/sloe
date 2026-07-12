import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text } from "react-native";
import { RefreshCw } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import {
  regenerateShoppingListFromPlan,
  type RegenShoppingClient,
} from "@suppr/shared/planning/regenerateShoppingListFromPlan";
import {
  SHOPPING_LIST_FINGERPRINT_STORAGE_KEY,
  SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY,
  SHOPPING_LIST_PLAN_START_STORAGE_KEY,
} from "@suppr/shared/planning/shoppingListMeta";
import type { ShoppingScope } from "@suppr/shared/household/shoppingScope";
import { readActiveCloudMealPlanSlotId } from "@/lib/activeMealPlanSlot";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { PressableScale } from "@/components/ui/PressableScale";

/**
 * ENG-1527 — the in-place "Update from plan" affordance. Shown under the
 * shopping-list subtitle when the list is out of sync with the meal plan (the
 * `· plan changed since` caption). Re-runs the shared shopping-list generator
 * NON-destructively via {@link regenerateShoppingListFromPlan} — checked-off
 * rows and household/manual additions are preserved; only the delta is written.
 * The live-sync subscription on the parent screen repaints the list; on success
 * we persist the fresh fingerprint + clear the stale flag so the caption clears.
 */
export interface ShoppingUpdateFromPlanBannerProps {
  scope: ShoppingScope;
  pantryStaples: readonly string[];
  /** Parent clears its local out-of-sync state so the affordance hides at once. */
  onSynced: () => void;
}

function friendlyError(error: string): string {
  if (/no (active plan|recipes)/i.test(error)) {
    return "There's no active plan to build the list from. Generate a plan first.";
  }
  return "Something went wrong updating your list. Please try again.";
}

export function ShoppingUpdateFromPlanBanner({
  scope,
  pantryStaples,
  onSynced,
}: ShoppingUpdateFromPlanBannerProps) {
  const accent = useAccent();
  const haptics = useHaptics();
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const planSlotId = await readActiveCloudMealPlanSlotId();
      const res = await regenerateShoppingListFromPlan({
        client: supabase as unknown as RegenShoppingClient,
        scope,
        planSlotId,
        pantryStaples,
      });
      if (!res.ok) {
        haptics.warn();
        Alert.alert("Couldn't update list", friendlyError(res.error));
        return;
      }
      // Persist the fresh fingerprint + anchor and clear the stale flag so the
      // subtitle stops saying "plan changed since".
      const pairs: [string, string][] = [
        [SHOPPING_LIST_FINGERPRINT_STORAGE_KEY, res.planFingerprint],
      ];
      if (res.planStartDate) {
        pairs.push([SHOPPING_LIST_PLAN_START_STORAGE_KEY, res.planStartDate]);
      }
      await AsyncStorage.multiSet(pairs);
      await AsyncStorage.removeItem(SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY);
      haptics.success();
      onSynced();

      const changes: string[] = [];
      if (res.addedCount > 0) changes.push(`added ${res.addedCount}`);
      if (res.updatedCount > 0) changes.push(`updated ${res.updatedCount}`);
      if (res.removedCount > 0) changes.push(`removed ${res.removedCount}`);
      const summary =
        changes.length > 0
          ? `${changes.join(", ")}.`.replace(/^./, (c) => c.toUpperCase())
          : "Your list already matched the plan.";
      const kept =
        res.keptCheckedCount > 0
          ? ` Your ${res.keptCheckedCount} checked item${res.keptCheckedCount === 1 ? "" : "s"} stayed put.`
          : "";
      Alert.alert("Shopping list updated", `${summary}${kept}`);
    } catch {
      haptics.warn();
      Alert.alert("Couldn't update list", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, scope, pantryStaples, haptics, onSynced]);

  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      accessibilityLabel="Update shopping list from the current plan"
      testID="shopping-update-from-plan"
      style={[
        styles.button,
        { borderColor: accent.primarySolid, opacity: busy ? 0.6 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={accent.primarySolid} />
      ) : (
        <RefreshCw size={14} color={accent.primarySolid} strokeWidth={2.25} />
      )}
      <Text style={[styles.label, { color: accent.primarySolid }]}>
        {busy ? "Updating…" : "Update from plan"}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  label: { ...Type.caption, fontWeight: "700" },
});

export default ShoppingUpdateFromPlanBanner;
