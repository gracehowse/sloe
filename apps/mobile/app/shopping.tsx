import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ChevronRight, Share2, ShoppingCart, Trash2, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import {
  fetchShoppingListJsonItems,
  upsertShoppingListJsonItems,
} from "@suppr/shared/supabase/shoppingJsonFallback";
import {
  formatShoppingListSubtitle,
  SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY,
  SHOPPING_LIST_PLAN_START_STORAGE_KEY,
} from "@suppr/shared/planning/shoppingListMeta";
import {
  formatShoppingProgressSubtitle,
  formatShoppingWeekRange,
} from "@suppr/shared/planning/shoppingListDisplay";
import {
  appendPantryStaple,
  parsePantryStaples,
} from "@suppr/shared/planning/pantryStaples";
import {
  dedupeShoppingLabel,
  shoppingItemsTiedToCurrentPlan,
} from "@suppr/shared/planning/shoppingListLifecycle";
import {
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "@suppr/shared/planning/shoppingDisplayGroups";
import { sortShoppingCategories } from "@suppr/shared/planning/shoppingAisleOrder";
import {
  normalizeShoppingIngredientRow,
  withNormalizedShoppingFields,
} from "@suppr/shared/planning/normalizeShoppingIngredientRow";
import { getMyHousehold, type HouseholdData } from "@suppr/shared/household/householdClient";
import {
  householdMemberFirstName,
} from "@suppr/shared/household/memberAccents";
import {
  shoppingScopeFor,
  shoppingScopeRealtimeFilter,
  type ShoppingScope,
} from "@suppr/shared/household/shoppingScope";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { useHaptics } from "@/hooks/useHaptics";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation";
import ReAnimated from "react-native-reanimated";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { readActiveCloudMealPlanSlotId } from "@/lib/activeMealPlanSlot";
import { PlanTabChrome } from "@/components/tabs/PlanTabChrome";
import { ShoppingLoadingSkeleton } from "@/components/shopping/ShoppingLoadingSkeleton";
import { ShoppingUpdateFromPlanBanner } from "@/components/shopping/ShoppingUpdateFromPlanBanner";
import { ShoppingSmartSuggestions } from "@/components/shopping/ShoppingSmartSuggestions";
import { ShoppingProgressChrome } from "@/components/shopping/ShoppingProgressChrome";
import { ShoppingListGroupRow } from "@/components/shopping/ShoppingListGroupRow";
import { Layout } from "@/constants/layout";

type ShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  from: string;
  /** Honeydew parity: who toggled the check last (for member attribution chip). */
  checkedBy: string | null;
};

const SHOPPING_ITEMS_TIMEOUT_MS = 28_000;
const SHOPPING_PLAN_AUX_TIMEOUT_MS = 18_000;
const SHOPPING_LEGACY_JSON_TIMEOUT_MS = 18_000;
const shoppingQueryTimeout = Symbol("shopping_query_timeout");

// Unique realtime topic per effect run (ENG-794/ENG-1473) — static topics collide on remount.
let shoppingRealtimeSeq = 0;

async function raceShoppingQuery<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T | typeof shoppingQueryTimeout> {
  const out = await Promise.race([
    p,
    new Promise<typeof shoppingQueryTimeout>((resolve) => {
      setTimeout(() => resolve(shoppingQueryTimeout), ms);
    }),
  ]);
  if (out === shoppingQueryTimeout) {
    console.warn(`[shopping] ${label} timed out (${ms}ms)`);
  }
  return out;
}

export default function ShoppingListScreen() {
  const colors = useThemeColors();
  // Page-ground card grammar (ENG-1497 / ENG-1527): flat + hairline in light,
  // tonal lift + hairline in dark — shared with Plan / Progress / Today.
  const cardElevation = useCardElevation({ variant: "soft" });
  // Secondary accent (Frost → damson, else clay) for progress, checkboxes,
  // CTAs and the empty-state glyph. Destructive keeps `Accent.destructive`.
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const haptics = useHaptics();

  // ENG-1669 — in-store scan density (default ON; PostHog kill switch).
  const densityV1 = isFeatureEnabled("shopping_list_density_v1");
  // Design-consistency pass (2026-07-24) — unified header meta (web parity).
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  const progressEntrance = useEntranceAnimation({ delay: 0 });
  const listEntrance = useEntranceAnimation({ delay: 80 });

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);
  const [shoppingListOutOfSync, setShoppingListOutOfSync] = useState(false);
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [pantryStaples, setPantryStaples] = useState<readonly string[]>([]);
  const householdRef = useRef<HouseholdData | null>(null);
  householdRef.current = household;

  const scope: ShoppingScope | null = useMemo(() => {
    if (!userId) return null;
    return shoppingScopeFor({
      userId,
      householdId: household?.household?.id ?? null,
    });
  }, [userId, household?.household?.id]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const [[, start], [, stale]] = await AsyncStorage.multiGet([
            SHOPPING_LIST_PLAN_START_STORAGE_KEY,
            SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY,
          ]);
          setPlanStartDate(start && start.length >= 10 ? start.slice(0, 10) : null);
          setShoppingListOutOfSync(stale === "1");
        } catch {
          setPlanStartDate(null);
          setShoppingListOutOfSync(false);
        }
      })();
    }, []),
  );

  // Resolve household before the first read so solo items never flash and
  // then get replaced by household items.
  useEffect(() => {
    if (!userId) {
      setHousehold(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getMyHousehold(supabase as any, userId);
        if (!cancelled) setHousehold(data ?? null);
      } catch {
        if (!cancelled) setHousehold(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPantryStaples([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pantry_staples")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) {
        setPantryStaples(
          parsePantryStaples((data as { pantry_staples?: unknown } | null)?.pantry_staples),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Map a household member's userId → MemberSummary for attribution chips.
  const memberById = useMemo(() => {
    const m = new Map<string, { displayName: string; index: number }>();
    (household?.members ?? []).forEach((member, idx) => {
      m.set(member.userId, { displayName: member.displayName, index: idx });
    });
    return m;
  }, [household]);

  const loadItems = useCallback(async (s: ShoppingScope) => {
    // Build the query in scope-aware fashion. Solo: user_id + null
    // household; household: just household_id.
    let q = supabase
      .from("shopping_items")
      .select("id, name, amount, unit, category, checked, source, checked_by")
      .order("created_at", { ascending: true });

    if (s.kind === "household") {
      q = q.eq("household_id", s.householdId);
    } else {
      q = q.eq("user_id", s.userId).is("household_id", null);
    }

    const rowsPack = await raceShoppingQuery(
      (async () => await q)(),
      SHOPPING_ITEMS_TIMEOUT_MS,
      "shopping_items",
    );
    if (rowsPack === shoppingQueryTimeout) {
      return [];
    }
    const { data: rows, error } = rowsPack;
    if (error || !rows) return null;

    // G-2 reconciliation only applies to per-user (solo) items — a
    // household list is shared and it's NOT one user's job to prune
    // entries that fell off another user's plan.
    if (s.kind === "solo" && rows.length > 0) {
      const activePlanSlotId = await readActiveCloudMealPlanSlotId();
      const dayPack = await raceShoppingQuery(
        (async () =>
          await supabase
            .from("meal_plan_days")
            .select("id")
            .eq("user_id", s.userId)
            .eq("slot_id", activePlanSlotId))(),
        SHOPPING_PLAN_AUX_TIMEOUT_MS,
        "meal_plan_days (shopping reconcile)",
      );
      const dayRows =
        dayPack === shoppingQueryTimeout ? [] : ((dayPack.data ?? []) as { id: string }[]);
      const dayIds = Array.isArray(dayRows) ? dayRows.map((d) => d.id) : [];
      let liveTitles: string[] = [];
      if (dayIds.length > 0) {
        const mealsPack = await raceShoppingQuery(
          (async () =>
            await supabase
              .from("meal_plan_meals")
              .select("recipe_title")
              .in("plan_day_id", dayIds))(),
          SHOPPING_PLAN_AUX_TIMEOUT_MS,
          "meal_plan_meals (shopping reconcile)",
        );
        const planMeals =
          mealsPack === shoppingQueryTimeout ? null : mealsPack.data;
        if (Array.isArray(planMeals)) {
          liveTitles = (planMeals as { recipe_title: string | null }[])
            .map((m) => m.recipe_title ?? "")
            .filter(Boolean);
        }
      }

      const kept = liveTitles.length > 0
        ? shoppingItemsTiedToCurrentPlan({
            items: rows as ({ source: string | null } & Record<string, unknown>)[],
            currentPlanRecipeTitles: liveTitles,
          })
        : (rows as Record<string, unknown>[]);

      const staleIds = (rows as { id: string }[])
        .filter((r) => !kept.some((k) => (k as { id: string }).id === r.id))
        .map((r) => r.id);
      if (staleIds.length > 0) {
        void supabase.from("shopping_items").delete().in("id", staleIds);
      }

      return kept.map((r) => ({
        id: (r as { id: string }).id,
        name: ((r as { name?: string }).name) ?? "",
        amount: ((r as { amount?: string }).amount) ?? "",
        unit: ((r as { unit?: string }).unit) ?? "",
        category: ((r as { category?: string }).category) ?? "Other",
        checked: ((r as { checked?: boolean }).checked) ?? false,
        from: ((r as { source?: string }).source) ?? "",
        checkedBy: ((r as { checked_by?: string | null }).checked_by) ?? null,
      })) as ShoppingItem[];
    }

    return rows.map((r) => {
      const normalized = normalizeShoppingIngredientRow({
        name: ((r as { name?: string }).name) ?? "",
        amount: ((r as { amount?: string }).amount) ?? "",
        unit: ((r as { unit?: string }).unit) ?? "",
      });
      return {
        id: (r as { id: string }).id,
        name: normalized.name,
        amount: normalized.amount,
        unit: normalized.unit,
        category: ((r as { category?: string }).category) ?? "Other",
        checked: ((r as { checked?: boolean }).checked) ?? false,
        from: ((r as { source?: string }).source) ?? "",
        checkedBy: ((r as { checked_by?: string | null }).checked_by) ?? null,
      };
    }) as ShoppingItem[];
  }, []);

  // Initial load.
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (scope == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadItems(scope);
        if (cancelled) return;
        if (loaded == null) {
          // Relational table missing → JSON fallback (solo only — household
          // mode requires the relational schema, fallback would silently
          // break sync so we leave the list empty there).
          if (scope.kind === "solo") {
            const legacyPack = await raceShoppingQuery(
              fetchShoppingListJsonItems(supabase, scope.userId),
              SHOPPING_LEGACY_JSON_TIMEOUT_MS,
              "shopping_list JSON fallback",
            );
            if (cancelled) return;
            if (legacyPack !== shoppingQueryTimeout && Array.isArray(legacyPack.items)) {
              setItems(legacyPack.items as ShoppingItem[]);
            }
          }
        } else {
          setItems(loaded);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, scope, loadItems]);

  // Real-time subscription — household edits propagate within ~1s; solo
  // users get cross-device sync.
  useEffect(() => {
    if (!scope) return;
    const filter = shoppingScopeRealtimeFilter(scope);
    const channelName =
      (scope.kind === "household"
        ? `mobile:shopping:hh:${scope.householdId}`
        : `mobile:shopping:user:${scope.userId}`) + `:${(shoppingRealtimeSeq += 1)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter },
        () => {
          // Cheap reload — 50-row payload is fine, and this avoids the
          // need to merge optimistic state with three event variants.
          void (async () => {
            const reloaded = await loadItems(scope);
            if (reloaded != null) setItems(reloaded);
          })();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, loadItems]);

  const toggleItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === itemId
          ? { ...i, checked: !i.checked, checkedBy: !i.checked ? userId : null }
          : i,
      );
      if (userId) {
        const target = next.find((x) => x.id === itemId);
        if (target) {
          void supabase
            .from("shopping_items")
            .update({
              checked: target.checked,
              checked_by: target.checked ? userId : null,
              checked_at: target.checked ? new Date().toISOString() : null,
            })
            .eq("id", itemId)
            .then(({ error }) => {
              if (error) {
                void upsertShoppingListJsonItems(supabase, userId, next);
              }
            });
        }
      }
      return next;
    });
  }, [userId]);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== itemId);
      if (userId) {
        void supabase.from("shopping_items").delete().eq("id", itemId)
          .then(({ error }) => {
            if (error) {
              void upsertShoppingListJsonItems(supabase, userId, next);
            }
          });
      }
      return next;
    });
  }, [userId]);

  const savePantryStaples = useCallback(
    async (next: readonly string[]) => {
      const normalized = parsePantryStaples(next);
      const previous = pantryStaples;
      setPantryStaples(normalized);
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ pantry_staples: normalized })
        .eq("id", userId);
      if (error) {
        setPantryStaples(previous);
        Alert.alert(
          "Couldn't save pantry staples",
          "Please try again in Settings.",
        );
      }
    },
    [pantryStaples, userId],
  );

  const markGroupAsStaple = useCallback(
    async (group: ShoppingDisplayGroup) => {
      const name = group.displayName.trim();
      if (!name) return;
      await savePantryStaples(appendPantryStaple(pantryStaples, name));
      for (const item of group.items) removeItem(item.id);
      haptics.success();
    },
    [pantryStaples, removeItem, savePantryStaples, haptics],
  );

  const clearChecked = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((i) => !i.checked);
      const removedIds = prev.filter((i) => i.checked).map((i) => i.id);
      if (userId && removedIds.length > 0) {
        void supabase.from("shopping_items").delete().in("id", removedIds)
          .then(({ error }) => {
            if (error) {
              void upsertShoppingListJsonItems(supabase, userId, next);
            }
          });
      }
      return next;
    });
  }, [userId]);

  const clearAll = useCallback(() => {
    // ENG-1669 density: tuck "Remove checked" into the trash sheet (no floating link).
    const buttons: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[] = [{ text: "Cancel", style: "cancel" }];
    if (densityV1 && items.some((i) => i.checked)) {
      buttons.push({
        text: "Remove checked",
        onPress: () => clearChecked(),
      });
    }
    buttons.push({
      text: "Clear All",
      style: "destructive",
      onPress: () => {
        setItems([]);
        if (userId && scope) {
          const del = scope.kind === "household"
            ? supabase.from("shopping_items").delete().eq("household_id", scope.householdId)
            : supabase.from("shopping_items").delete().eq("user_id", scope.userId).is("household_id", null);
          void del.then(({ error }) => {
            if (error) {
              void supabase
                .from("shopping_lists")
                .upsert({ user_id: userId, items: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
            }
          });
        }
      },
    });
    Alert.alert(
      "Clear shopping list",
      household?.household
        ? `Remove items? This affects everyone in ${household.household.name}.`
        : "Remove items?",
      buttons,
    );
  }, [userId, scope, household?.household, densityV1, items, clearChecked]);

  const buildListText = useCallback(() => {
    const grouped = new Map<string, ShoppingItem[]>();
    for (const item of items.filter((i) => !i.checked)) {
      const cat = item.category || "Other";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(item);
    }
    const lines: string[] = ["🛒 Shopping List\n"];
    for (const [cat, catItems] of grouped) {
      lines.push(`📌 ${cat}`);
      for (const i of catItems) {
        const d = dedupeShoppingLabel({ amount: i.amount, unit: i.unit, name: i.name });
        lines.push(`  ☐ ${d.amount} ${d.unit} ${d.name}`.replace(/\s+/g, " ").trim());
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }, [items]);

  const exportList = useCallback(() => {
    const text = buildListText();
    Alert.alert("Export shopping list", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Copy to clipboard",
        onPress: () => {
          void import("expo-clipboard").then(({ setStringAsync }) =>
            setStringAsync(text),
          );
        },
      },
      {
        text: "Share",
        onPress: () => {
          void Share.share({ message: text, title: "Shopping List" });
        },
      },
    ]);
  }, [buildListText]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: Layout.screenPaddingX,
      paddingTop: Spacing.md,
      paddingBottom: Layout.screenPaddingBottom,
      gap: Layout.screenGap,
    },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
    },
    backBtn: { color: colors.text, fontSize: 28, fontWeight: "600" },
    // headers census 2026-06-10: drop the fontSize 22 override — 22 isn't a ramp
    // size; Type.title is 24.
    headerTitle: {
      ...Type.title,
      color: colors.text,
    },

    // Page-ground card — ONE card grammar (ENG-1497 / ENG-1527, 2026-07-11):
    // 24px `Radius.card` + flat-plus-hairline, shared with Plan/Progress/Today.
    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: Radius.card,
      overflow: "hidden" as const,
      padding: Spacing.xl,
      gap: Spacing.md,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.border,
    },

    progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressLabel: { ...Type.body, fontWeight: "600", color: colors.text },
    // Gap 11: hero serif numeral for the progress count (DS §2.3.3).
    progressCount: { ...Type.heroValue, fontSize: 22, color: accent.primarySolid, fontVariant: ["tabular-nums"] },
    progressTrack: { height: 6, backgroundColor: colors.inputBg, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: 6, backgroundColor: accent.primary, borderRadius: 3 },
    // ENG-1669 — thin strip replaces the Progress card when density is on.
    progressStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    progressStripTrack: {
      flex: 1,
      height: 4,
      backgroundColor: colors.inputBg,
      borderRadius: Radius.full,
      overflow: "hidden" as const,
    },
    progressStripFill: {
      height: 4,
      backgroundColor: accent.primary,
      borderRadius: Radius.full,
    },
    progressStripCount: {
      ...Type.caption,
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"] as const,
      fontWeight: "700" as const,
    },

    categoryTitle: {
      ...Type.headline,
      color: colors.textSecondary,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      // Gap 4: raise to 52pt min touch target (DS §10.1 44pt floor + DS §3.9 52pt spec).
      paddingVertical: Spacing.md,
      minHeight: 52,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      // Gap 6: border token — a calm hairline, not a cold ring (DS §3.9).
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: { backgroundColor: accent.primary, borderColor: accent.primary },
    itemName: { ...Type.body, color: colors.text },
    itemChecked: { ...Type.bodyMuted, textDecorationLine: "line-through", color: colors.tabIconDefault },
    // Gap 12: Type.caption + textSecondary — provenance legible, not a whisper.
    itemFrom: { ...Type.caption, color: colors.textSecondary, marginTop: 2 },

    // Honeydew parity (2026-04-30) — household sync banner.
    syncBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: accent.primarySoft,
      borderRadius: Radius.md,
    },
    syncBannerText: {
      flex: 1,
      color: colors.text,
      fontFamily: Type.captionSmall.fontFamily,
      fontSize: Type.captionSmall.fontSize,
      lineHeight: Type.captionSmall.lineHeight,
      fontWeight: "600",
    },
    syncBannerSub: {
      color: colors.textSecondary,
      fontSize: 11,
    },
    attributionChip: {
      flexDirection: "row",
      alignItems: "center",
      // Gap 14: normalise to spacing scale (xs=4, sm=8).
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full,
      marginTop: Spacing.xs,
    },
    attributionInitials: {
      // Gap 14: on-scale avatar size 16 with full radius.
      width: 16,
      height: 16,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    attributionText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    attributionLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  }), [colors, accent, cardElevation.useBorder, cardElevation.liftBg]);

  // 2026-04-30 (#2): counts reflect *grouped* rows (web parity).
  // 2026-05-12 (premium-bar audit J2): aisle order = supermarket walk order;
  // unknown categories land at the end alphabetically (AnyList / OurGroceries).
  const groupedSections = useMemo(() => {
    const orderedCats = sortShoppingCategories(items.map((i) => i.category));
    return orderedCats.map((category) => ({
      name: category,
      groups: groupShoppingItemsByIngredientName(
        items.filter((i) => i.category === category).map(withNormalizedShoppingFields),
      ),
    }));
  }, [items]);
  const totalGroupCount = useMemo(
    () => groupedSections.reduce((n, s) => n + s.groups.length, 0),
    [groupedSections],
  );
  const checkedGroupCount = useMemo(
    () =>
      groupedSections.reduce(
        (n, s) => n + s.groups.filter(isShoppingGroupFullyChecked).length,
        0,
      ),
    [groupedSections],
  );
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = totalGroupCount > 0 ? checkedGroupCount / totalGroupCount : 0;
  const uncheckedCount = totalGroupCount - checkedGroupCount;

  // Honeydew parity copy: "Shared with Sarah & Tom" (joined first names).
  const sharedWithLabel = useMemo(() => {
    if (!household?.household || !userId) return null;
    const others = (household.members ?? [])
      .filter((m) => m.userId !== userId)
      .map((m) => householdMemberFirstName(m.displayName));
    if (others.length === 0) return null;
    if (others.length === 1) return `Shared with ${others[0]}`;
    if (others.length === 2) return `Shared with ${others[0]} & ${others[1]}`;
    return `Shared with ${others.slice(0, -1).join(", ")} & ${others[others.length - 1]}`;
  }, [household, userId]);

  const listSubtitle = useMemo(
    () =>
      formatShoppingListSubtitle({
        itemCount: densityV1 ? totalGroupCount : items.length,
        planStartDate,
        outOfSync: shoppingListOutOfSync,
        omitItemCount: densityV1,
      }),
    [items.length, totalGroupCount, planStartDate, shoppingListOutOfSync, densityV1],
  );

  // Web renders the plan week as the canonical eyebrow above the title. On the
  // Plan tab the overline slot is pinned null by ruling (`PlanTabChrome`,
  // 2026-05-22 — "no redundant PLAN overline"), so the week range rides in the
  // subtitle instead: the same information, one composition step apart, and the
  // correct shape while that ruling stands.
  const chromeSubtitle = useMemo(() => {
    const progressLine = formatShoppingProgressSubtitle({
      checkedCount: checkedGroupCount,
      totalCount: totalGroupCount,
      outOfSync: shoppingListOutOfSync,
    });
    if (!progressLine) return null;
    return `${formatShoppingWeekRange(planStartDate)} · ${progressLine}`;
  }, [checkedGroupCount, totalGroupCount, shoppingListOutOfSync, planStartDate]);

  const chromeTrailing =
    items.length > 0 ? (
      <View style={{ flexDirection: "row", gap: Spacing.md }}>
        <PressableScale
          haptic="selection"
          hitSlop={12}
          onPress={exportList}
          accessibilityLabel="Share shopping list"
          accessibilityRole="button"
        >
          <Share2 size={22} color={colors.text} strokeWidth={1.75} />
        </PressableScale>
        <PressableScale
          haptic="destructive"
          hitSlop={12}
          onPress={clearAll}
          accessibilityLabel="Clear shopping list"
          accessibilityRole="button"
        >
          <Trash2 size={22} color={Accent.destructive} strokeWidth={1.75} />
        </PressableScale>
      </View>
    ) : null;

  return (
    <View
      testID="screen-shopping"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <PlanTabChrome
        value="shopping"
        // ENG-1669 Mob-flat: title carried the list count. Under the unified
        // header that count moves into the subtitle as checked/total — the
        // number a shopper actually reads mid-aisle.
        title={
          !unifiedChrome && densityV1 && items.length > 0
            ? `Shopping list (${totalGroupCount})`
            : "Shopping list"
        }
        subtitle={
          unifiedChrome
            ? (chromeSubtitle ?? undefined)
            : densityV1 && items.length > 0
              ? listSubtitle
              : undefined
        }
        shoppingUncheckedCount={uncheckedCount}
        trailing={densityV1 ? chromeTrailing : undefined}
        onChange={(next) => {
          if (next === "plan") {
            router.replace("/(tabs)/planner" as never);
          }
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!densityV1 && items.length > 0 ? (
          <Text
            testID="shopping-list-subtitle"
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: Spacing.sm,
              paddingHorizontal: Spacing.xl,
            }}
          >
            {listSubtitle}
          </Text>
        ) : null}
        {/* ENG-1527 — non-destructive "Update from plan" when the list is stale. */}
        {items.length > 0 && shoppingListOutOfSync && scope && isFeatureEnabled("shopping_update_from_plan_v1") ? (
          <ShoppingUpdateFromPlanBanner
            scope={scope}
            pantryStaples={pantryStaples}
            onSynced={() => setShoppingListOutOfSync(false)}
          />
        ) : null}
        {!densityV1 ? (
          <View style={[styles.headerRow, { justifyContent: "flex-end" }]}>
            {items.length > 0 ? (
              <View style={{ flexDirection: "row", gap: Spacing.md }}>
                <Pressable hitSlop={12} onPress={exportList} accessibilityLabel="Share shopping list" accessibilityRole="button">
                  <Share2 size={22} color={colors.text} strokeWidth={1.75} />
                </Pressable>
                <Pressable hitSlop={12} onPress={clearAll} accessibilityLabel="Clear shopping list" accessibilityRole="button">
                  <Trash2 size={22} color={Accent.destructive} strokeWidth={1.75} />
                </Pressable>
              </View>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>
        ) : null}

        {/* Household shared-list banner — solo users never see this. */}
        {sharedWithLabel ? (
          <Pressable
            testID="shopping-household-banner"
            accessibilityRole="button"
            accessibilityLabel={`${sharedWithLabel}. Tap to manage household.`}
            onPress={() => router.push("/household-settings" as never)}
            style={styles.syncBanner}
          >
            <Users size={14} color={accent.primary} aria-hidden />
            <View style={{ flex: 1 }}>
              <Text style={styles.syncBannerText}>{sharedWithLabel}</Text>
              <Text style={styles.syncBannerSub}>Synced live across your household</Text>
            </View>
            <ChevronRight size={14} color={colors.textTertiary} strokeWidth={1.75} />
          </Pressable>
        ) : null}

        {loading ? (
          // ENG-768 — deeplink cold-open state: flag ON → list skeleton;
          // OFF → the legacy centred spinner. Ramp via `deeplink_skeletons`.
          isFeatureEnabled("deeplink_skeletons") ? (
            <ShoppingLoadingSkeleton />
          ) : (
            // E4 (2026-05-11 visual sweep): caption the spinner so it does
            // not read as a frozen screen (Discover + Library pattern).
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={accent.primary} />
              <Text
                style={{
                  marginTop: Spacing.md,
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                Loading your shopping list…
              </Text>
            </View>
          )
        ) : items.length === 0 ? (
          // 2026-05-23 — empty state: calm centred column, no card surface.
          <View style={{ alignItems: "center", paddingTop: Spacing.lg, paddingHorizontal: Spacing.xl }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: Radius.xl,
              backgroundColor: accent.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: Spacing.md,
            }}>
              <ShoppingCart size={22} color={accent.primary} strokeWidth={1.75} />
            </View>
            {/* Gap 9: headline synced to web's (ShoppingList.tsx) — one voice. */}
            <Text style={{ ...Type.headline, color: colors.text, textAlign: "center" }}>
              Your shopping list builds itself
            </Text>
            <Text
              style={{
                ...Type.body,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 20,
                marginTop: Spacing.xs,
                maxWidth: 280,
              }}
            >
              Plan your meals for the week and we&apos;ll gather every ingredient into one list, grouped by aisle.
            </Text>
            {/* Ghost CTA — press feedback + haptic, and web's ghost-button label. */}
            <PressableScale
              haptic="selection"
              onPress={() => router.push("/(tabs)/planner")}
              accessibilityRole="button"
              accessibilityLabel={unifiedChrome ? "Start planning" : "Go to planning"}
              hitSlop={8}
              style={{ marginTop: Spacing.md, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}
            >
              <Text style={{ ...Type.body, fontWeight: "600", color: accent.primarySolid }}>
                {unifiedChrome ? "Start planning" : "Go to plan →"}
              </Text>
            </PressableScale>
          </View>
        ) : (
          <>
            <ReAnimated.View style={progressEntrance.style}>
              <ShoppingProgressChrome
                densityV1={densityV1}
                checkedGroupCount={checkedGroupCount}
                totalGroupCount={totalGroupCount}
                checkedCount={checkedCount}
                progress={progress}
                onClearChecked={clearChecked}
                styles={styles}
                accentPrimarySolid={accent.primarySolid}
              />
            </ReAnimated.View>

            {/* ENG-1634 — Smart suggestions (flag-gated; web parity). */}
            <ShoppingSmartSuggestions
              userId={userId}
              scope={scope}
              shoppingItemNames={items.map((i) => i.name)}
            />

            <ReAnimated.View style={listEntrance.style}>
            {groupedSections.map((section) => {
              // 2026-04-30 audit visual-qa P1 #8: section-level progress
              // (a group counts as checked when all its items are).
              // ENG-1669 Mob-flat density drops the per-section X/Y.
              const sectionTotal = section.groups.length;
              const sectionChecked = section.groups.filter((g) =>
                isShoppingGroupFullyChecked(g),
              ).length;
              return (
                <View
                  key={section.name}
                  style={
                    densityV1
                      ? {
                          paddingHorizontal: Spacing.xl,
                          marginBottom: Spacing.lg,
                        }
                      : styles.card
                  }
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: densityV1 ? Spacing.sm : Spacing.md,
                    }}
                  >
                    <Text
                      style={
                        densityV1
                          ? {
                              ...Type.bodyLarge,
                              fontWeight: "700",
                              color: colors.text,
                            }
                          : styles.categoryTitle
                      }
                    >
                      {section.name}
                    </Text>
                    {!densityV1 ? (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.textSecondary,
                          letterSpacing: 0.5,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {sectionChecked}/{sectionTotal}
                      </Text>
                    ) : null}
                  </View>
                  {section.groups.map((group: ShoppingDisplayGroup) => (
                    <ShoppingListGroupRow
                      key={group.key}
                      group={group}
                      densityV1={densityV1}
                      householdActive={household?.household != null}
                      memberById={memberById}
                      accent={accent}
                      colors={colors}
                      styles={styles}
                      onToggle={(g, allChecked) => {
                        for (const item of g.items) {
                          if (allChecked) {
                            if (item.checked) toggleItem(item.id);
                          } else if (!item.checked) {
                            toggleItem(item.id);
                          }
                        }
                      }}
                      onRemove={(g) => {
                        for (const item of g.items) removeItem(item.id);
                      }}
                      onMarkStaple={(g) => {
                        void markGroupAsStaple(g);
                      }}
                    />
                  ))}
                </View>
              );
            })}
            </ReAnimated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
