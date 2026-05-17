import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Check, ShoppingCart, Trash2, Users } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import {
  fetchShoppingListJsonItems,
  upsertShoppingListJsonItems,
} from "@suppr/shared/supabase/shoppingJsonFallback";
import {
  dedupeShoppingLabel,
  shoppingItemsTiedToCurrentPlan,
} from "@suppr/shared/planning/shoppingListLifecycle";
import {
  formatMixedShoppingAmounts,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "@suppr/shared/planning/shoppingDisplayGroups";
import { getMyHousehold, type HouseholdData } from "@suppr/shared/household/householdClient";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "@suppr/shared/household/memberAccents";
import {
  shoppingScopeFor,
  shoppingScopeRealtimeFilter,
  type ShoppingScope,
} from "@suppr/shared/household/shoppingScope";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { PlanSubTabHeader } from "@/components/tabs/PlanSubTabHeader";

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/planner");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const householdRef = useRef<HouseholdData | null>(null);
  householdRef.current = household;

  const scope: ShoppingScope | null = useMemo(() => {
    if (!userId) return null;
    return shoppingScopeFor({
      userId,
      householdId: household?.household?.id ?? null,
    });
  }, [userId, household?.household?.id]);

  // Step 1 — resolve household once on mount so we know the scope before
  // we read (avoids a flicker where solo items load and then the
  // household items replace them).
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
      const dayPack = await raceShoppingQuery(
        (async () =>
          await supabase
            .from("meal_plan_days")
            .select("id")
            .eq("user_id", s.userId)
            .eq("slot_id", "default"))(),
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

    return rows.map((r) => ({
      id: (r as { id: string }).id,
      name: ((r as { name?: string }).name) ?? "",
      amount: ((r as { amount?: string }).amount) ?? "",
      unit: ((r as { unit?: string }).unit) ?? "",
      category: ((r as { category?: string }).category) ?? "Other",
      checked: ((r as { checked?: boolean }).checked) ?? false,
      from: ((r as { source?: string }).source) ?? "",
      checkedBy: ((r as { checked_by?: string | null }).checked_by) ?? null,
    })) as ShoppingItem[];
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

  // Real-time subscription. Step 4 — items added/checked/removed by
  // another household member propagate within ~1s. Solo users still
  // benefit from cross-device sync (e.g. iPhone + iPad).
  useEffect(() => {
    if (!scope) return;
    const filter = shoppingScopeRealtimeFilter(scope);
    const channelName =
      scope.kind === "household"
        ? `mobile:shopping:hh:${scope.householdId}`
        : `mobile:shopping:user:${scope.userId}`;
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

  const clearAll = useCallback(() => {
    Alert.alert(
      "Clear shopping list",
      household?.household
        ? `Remove all items? This affects everyone in ${household.household.name}.`
        : "Remove all items?",
      [
        { text: "Cancel", style: "cancel" },
        {
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
        },
      ],
    );
  }, [userId, scope, household?.household]);

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
    scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: Spacing.lg },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
    },
    backBtn: { color: colors.text, fontSize: 28, fontWeight: "600" },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.4,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },

    progressRow: { flexDirection: "row", justifyContent: "space-between" },
    progressLabel: { color: colors.text, fontWeight: "600", fontSize: 14 },
    progressCount: { color: Accent.primary, fontWeight: "700", fontSize: 14, fontVariant: ["tabular-nums"] },
    progressTrack: { height: 6, backgroundColor: colors.inputBg, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: 6, backgroundColor: Accent.primary, borderRadius: 3 },

    categoryTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.tabIconDefault,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: { backgroundColor: Accent.primary, borderColor: Accent.primary },
    itemName: { fontSize: 14, color: colors.text },
    itemChecked: { textDecorationLine: "line-through", color: colors.tabIconDefault },
    itemFrom: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xxxl,
      alignItems: "center",
      gap: Spacing.md,
    },
    emptyIcon: { fontSize: 40 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    ctaBtn: {
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxxl,
      marginTop: Spacing.sm,
    },
    ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    // Honeydew parity (2026-04-30) — household sync banner.
    syncBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: Accent.primary + "12",
      borderRadius: Radius.md,
    },
    syncBannerText: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    syncBannerSub: {
      color: colors.textSecondary,
      fontSize: 11,
    },
    attributionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      marginTop: 2,
    },
    attributionInitials: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    attributionText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },
    attributionLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  }), [colors]);

  // 2026-04-30 (#2): badge + progress reflect *grouped* rows so counts
  // match on-screen groups (web parity).
  // 2026-05-12 (premium-bar audit J2 — aisle ordering): sort sections
  // in the order a real shopper walks through a supermarket so the
  // user can scan top-down without backtracking. Categories not in
  // the canonical order land at the end alphabetically. Mirrors the
  // pattern used by AnyList / OurGroceries.
  const AISLE_ORDER = useMemo<readonly string[]>(
    () => [
      "Produce",
      "Bakery",
      "Meat",
      "Seafood",
      "Deli",
      "Dairy",
      "Eggs",
      "Frozen",
      "Pantry",
      "Grains",
      "Pasta",
      "Canned",
      "Condiments",
      "Spices",
      "Baking",
      "Snacks",
      "Drinks",
      "Alcohol",
      "Household",
      "Other",
    ],
    [],
  );
  const groupedSections = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))];
    const orderedCats = cats.slice().sort((a, b) => {
      const ai = AISLE_ORDER.indexOf(a);
      const bi = AISLE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return orderedCats.map((category) => ({
      name: category,
      groups: groupShoppingItemsByIngredientName(
        items.filter((i) => i.category === category),
      ),
    }));
  }, [items, AISLE_ORDER]);
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

  // Honeydew parity copy: "Shared with Sarah & Tom" — joined first
  // names of every member that isn't the caller. Falls back to "your
  // household" if name resolution turns up empty.
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

  return (
    <View
      testID="screen-shopping"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <PlanSubTabHeader
        value="shopping"
        shoppingUncheckedCount={uncheckedCount}
        onChange={(next) => {
          if (next === "plan") {
            router.replace("/(tabs)/planner" as never);
          }
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Shopping list</Text>
          {items.length > 0 ? (
            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              <Pressable hitSlop={12} onPress={exportList}>
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable hitSlop={12} onPress={clearAll}>
                <Ionicons name="trash-outline" size={22} color={Accent.destructive} />
              </Pressable>
            </View>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        {/* Honeydew parity banner — visible only when in a household.
            Shows "Shared with Sarah & Tom" + a Users icon. Tapping it
            jumps to household settings so the user can confirm who's
            seeing their list. Hidden for solo users — never steals
            real estate from the per-user surface. */}
        {sharedWithLabel ? (
          <Pressable
            testID="shopping-household-banner"
            accessibilityRole="button"
            accessibilityLabel={`${sharedWithLabel}. Tap to manage household.`}
            onPress={() => router.push("/household-settings" as never)}
            style={styles.syncBanner}
          >
            <Users size={14} color={Accent.primary} aria-hidden />
            <View style={{ flex: 1 }}>
              <Text style={styles.syncBannerText}>{sharedWithLabel}</Text>
              <Text style={styles.syncBannerSub}>Synced live across your household</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        {loading ? (
          // E4 (2026-05-11 visual sweep): the bare spinner gave no
          // context — looked like a frozen screen. Add a "Loading…"
          // caption so the user knows something's happening, matching
          // the Discover + Library load-state pattern.
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Accent.primary} />
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
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            {/* 2026-05-06 audit (F-107): swap 🛒 emoji for lucide
                ShoppingCart per project icon-registry rule (Pattern
                #7 in TestFlight tracker). Emojis render
                inconsistently across iOS / Android / web fonts. */}
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <ShoppingCart size={48} color={Accent.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No shopping list yet</Text>
            <Text style={styles.emptyDesc}>
              Generate a meal plan first — your shopping list is created automatically.
            </Text>
            <Pressable style={styles.ctaBtn} onPress={() => router.push("/(tabs)/planner")}>
              <Text style={styles.ctaBtnText}>Open Planner</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressCount}>{checkedCount}/{items.length}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            {checkedCount > 0 && (
              <Pressable
                onPress={clearChecked}
                style={{ alignSelf: "center", paddingVertical: 8, paddingHorizontal: Spacing.xl }}
              >
                <Text style={{ color: Accent.primary, fontWeight: "600", fontSize: 14 }}>
                  Remove {checkedCount} checked item{checkedCount !== 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}

            {groupedSections.map((section) => {
              // 2026-04-30 audit visual-qa P1 #8: section-level
              // progress so the user feels each category complete
              // as they shop. Counts items in this section's groups
              // checked vs total. A group is "checked" when all its
              // items are checked (matches the row-level toggle).
              const sectionTotal = section.groups.length;
              const sectionChecked = section.groups.filter((g) =>
                isShoppingGroupFullyChecked(g),
              ).length;
              return (
                <View key={section.name} style={styles.card}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={styles.categoryTitle}>{section.name}</Text>
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
                  </View>
                  {section.groups.map((group: ShoppingDisplayGroup) => {
                    const allChecked = isShoppingGroupFullyChecked(group);
                    const dedupedSingle =
                      group.items.length === 1
                        ? dedupeShoppingLabel({
                            amount: group.items[0]!.amount,
                            unit: group.items[0]!.unit,
                            name: group.displayName,
                          })
                        : null;
                    const qtyLine = dedupedSingle
                      ? `${dedupedSingle.amount} ${dedupedSingle.unit}`.trim()
                      : formatMixedShoppingAmounts(group.items);
                    const displayName = dedupedSingle
                      ? dedupedSingle.name
                      : group.displayName;
                    const rowLabel = qtyLine
                      ? `${displayName} (${qtyLine})`
                      : displayName;
                    const fromLabel = [
                      ...new Set(
                        group.items
                          .flatMap((i) =>
                            i.from.split(",").map((s) => s.trim()),
                          )
                          .filter(Boolean),
                      ),
                    ].join(", ");

                    // Honeydew parity (2026-04-30): per-row check
                    // attribution. When the group is checked AND we
                    // have a household, surface the member that
                    // toggled it last. Single household member only
                    // — solo lists don't benefit from attribution
                    // (always "you").
                    const checkedByEntries = group.items
                      .map((i) =>
                        (i as ShoppingItem).checkedBy ?? null,
                      )
                      .filter((id): id is string => Boolean(id));
                    const uniqueCheckedBy = [...new Set(checkedByEntries)];
                    const showAttribution =
                      household?.household != null &&
                      allChecked &&
                      uniqueCheckedBy.length === 1;
                    const attributedMember = showAttribution
                      ? memberById.get(uniqueCheckedBy[0]!)
                      : null;

                    return (
                      // Premium-bar audit Group J line 436 — swipe-to-delete.
                      // Right-swipe reveals a destructive zone that removes
                      // every row in this display group (single + merged
                      // duplicates). Mirrors the pattern used by Today
                      // meals (`TodayMealsSection.tsx:Swipeable`). Haptic
                      // medium-impact on swipe-trigger matches the meal
                      // delete affordance so the gesture vocabulary is
                      // consistent across the app.
                      <Swipeable
                        key={group.key}
                        overshootRight={false}
                        friction={2}
                        renderRightActions={() => (
                          <View style={{ flexDirection: "row", alignItems: "stretch" }}>
                            <Pressable
                              onPress={() => {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                for (const item of group.items) removeItem(item.id);
                              }}
                              style={{
                                width: 88,
                                backgroundColor: Accent.destructive,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${displayName} from shopping list`}
                              testID={`shopping-swipe-delete-${group.key}`}
                            >
                              <Trash2 size={22} color="#fff" />
                              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>
                                Delete
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      >
                      <Pressable
                        style={styles.itemRow}
                        onPress={() => {
                          for (const item of group.items) {
                            if (allChecked) {
                              if (item.checked) toggleItem(item.id);
                            } else if (!item.checked) {
                              toggleItem(item.id);
                            }
                          }
                        }}
                        onLongPress={() => {
                          Alert.alert(
                            group.items.length > 1 ? "Remove items" : "Remove item",
                            group.items.length > 1
                              ? `Delete ${group.items.length} rows for "${displayName}"?`
                              : `Delete "${displayName}"?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => {
                                  for (const item of group.items) removeItem(item.id);
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            allChecked && styles.checkboxChecked,
                          ]}
                        >
                          {allChecked && <Check size={14} color="#fff" strokeWidth={3} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemName,
                              allChecked && styles.itemChecked,
                            ]}
                          >
                            {rowLabel}
                          </Text>
                          {fromLabel ? (
                            <Text style={styles.itemFrom}>{fromLabel}</Text>
                          ) : null}
                          {attributedMember ? (
                            <View
                              testID={`shopping-attribution-${group.key}`}
                              style={[
                                styles.attributionChip,
                                { alignSelf: "flex-start" },
                              ]}
                            >
                              <View
                                style={[
                                  styles.attributionInitials,
                                  {
                                    backgroundColor: householdMemberAccent(
                                      attributedMember.index,
                                    ),
                                  },
                                ]}
                              >
                                <Text style={styles.attributionText}>
                                  {householdMemberInitials(
                                    attributedMember.displayName,
                                  )}
                                </Text>
                              </View>
                              <Text style={styles.attributionLabel}>
                                {householdMemberFirstName(
                                  attributedMember.displayName,
                                )}{" "}
                                checked
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                      </Swipeable>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
