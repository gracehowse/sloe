import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Alert,
  Platform,
  ToastAndroid,
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
// PR3 (Honeydew parity, 2026-04-30 competitor audit gap #8): live
// shared shopping list. Subscribes to a Supabase Realtime channel
// scoped to the active household and surfaces "Sam added 'milk'" /
// "Alex checked off 'eggs'" toasts when other household members
// change the list.
import {
  formatShoppingChangeToast,
  subscribeShoppingItemsChannel,
  type ShoppingChangeEvent,
} from "../../../src/lib/household/shoppingRealtime";
import { shoppingScopeFor } from "../../../src/lib/household/shoppingScope";
import { getMyHousehold } from "../../../src/lib/household/householdClient";
import {
  fetchShoppingListJsonItems,
  upsertShoppingListJsonItems,
} from "../../../src/lib/supabase/shoppingJsonFallback";
import {
  dedupeShoppingLabel,
  shoppingItemsTiedToCurrentPlan,
} from "../../../src/lib/planning/shoppingListLifecycle";
import {
  formatMixedShoppingAmounts,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "../../../src/lib/planning/shoppingDisplayGroups";
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
};

export default function ShoppingListScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/planner");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  // PR3: realtime subscription. `householdId` is null until the
  // membership query resolves (or the user is solo). The members map
  // resolves member-id → display-name so the toast reads "Sam added
  // milk" rather than "Member ab12 added milk" when names exist.
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // Try relational table first
      const { data: rows, error: relErr } = await supabase
        .from("shopping_items")
        .select("id, name, amount, unit, category, checked, source")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!cancelled && rows && rows.length > 0 && !relErr) {
        // G-2 reconciliation: drop rows whose `source` recipe is no
        // longer in the live plan. Covers historical drift from
        // pre-G-2 builds where regenerate didn't purge. Two small
        // queries (plan_day ids, then meals) — cheaper than a
        // cross-table join RLS-wise and easier to reason about.
        const { data: dayRows } = await supabase
          .from("meal_plan_days")
          .select("id")
          .eq("user_id", userId)
          .eq("slot_id", "default");
        const dayIds = Array.isArray(dayRows)
          ? (dayRows as Array<{ id: string }>).map((d) => d.id)
          : [];
        let liveTitles: string[] = [];
        if (dayIds.length > 0) {
          const { data: planMeals } = await supabase
            .from("meal_plan_meals")
            .select("recipe_title")
            .in("plan_day_id", dayIds);
          if (Array.isArray(planMeals)) {
            liveTitles = (planMeals as Array<{ recipe_title: string | null }>)
              .map((m) => m.recipe_title ?? "")
              .filter(Boolean);
          }
        }

        const kept = liveTitles.length > 0
          ? shoppingItemsTiedToCurrentPlan({
              items: rows as Array<{ source: string | null } & Record<string, unknown>>,
              currentPlanRecipeTitles: liveTitles,
            })
          : (rows as Array<Record<string, unknown>>);

        const staleIds = (rows as Array<{ id: string }>)
          .filter((r) => !kept.some((k) => (k as { id: string }).id === r.id))
          .map((r) => r.id);
        if (staleIds.length > 0) {
          void supabase.from("shopping_items").delete().in("id", staleIds);
        }

        if (!cancelled) {
          setItems(kept.map((r) => ({
            id: (r as { id: string }).id,
            name: ((r as { name?: string }).name) ?? "",
            amount: ((r as { amount?: string }).amount) ?? "",
            unit: ((r as { unit?: string }).unit) ?? "",
            category: ((r as { category?: string }).category) ?? "Other",
            checked: ((r as { checked?: boolean }).checked) ?? false,
            from: ((r as { source?: string }).source) ?? "",
          })));
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        const { items: legacyItems } = await fetchShoppingListJsonItems(supabase, userId);
        if (!cancelled) {
          if (Array.isArray(legacyItems)) {
            setItems(legacyItems as ShoppingItem[]);
          }
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // PR3 (Honeydew parity, 2026-04-30): resolve the user's active
  // household + member display-names for the realtime toast. Solo
  // users skip household entirely; the realtime channel still
  // subscribes (per-user filter) so a future device sync hook drops
  // in without re-wiring.
  useEffect(() => {
    if (!userId) {
      setHouseholdId(null);
      setHouseholdMembers(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyHousehold(supabase as any, userId);
        if (cancelled) return;
        if (result.error || !result.data) {
          setHouseholdId(null);
          setHouseholdMembers(new Map());
          return;
        }
        const hh = result.data.household ?? null;
        if (!hh) {
          setHouseholdId(null);
          setHouseholdMembers(new Map());
          return;
        }
        setHouseholdId(hh.id);
        const map = new Map<string, string>();
        for (const m of result.data.members ?? []) {
          if (m.userId && m.displayName) {
            map.set(m.userId, m.displayName);
          }
        }
        setHouseholdMembers(map);
      } catch {
        // Best-effort: if the household lookup fails we degrade to
        // solo mode (the per-user realtime filter still runs).
        setHouseholdId(null);
        setHouseholdMembers(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // PR3: subscribe to realtime change events. INSERT / UPDATE /
  // DELETE from any household member appears in <1s, both as a
  // toast and as a state mutation so the list reflects the new
  // shape without a manual refresh.
  const householdMembersRef = useRef(householdMembers);
  useEffect(() => {
    householdMembersRef.current = householdMembers;
  }, [householdMembers]);
  useEffect(() => {
    if (!userId) return;
    const scope = shoppingScopeFor({ userId, householdId });
    const handle = (event: ShoppingChangeEvent) => {
      const message = formatShoppingChangeToast({
        event,
        members: householdMembersRef.current,
        ownUserId: userId,
      });
      if (message) {
        if (Platform.OS === "android") {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
          // iOS has no native toast — surface non-blocking via
          // Alert with no buttons (auto-dismiss patterns require a
          // 3rd-party lib we're not pulling in just for this).
          // The pattern matches how `apps/mobile/lib/notifications.ts`
          // surfaces realtime cues today.
          Alert.alert(message);
        }
      }
      // Reconcile local state so the list reflects the change
      // without waiting for a re-fetch.
      if (event.kind === "insert") {
        const r = event.row;
        setItems((prev) => {
          if (prev.some((p) => p.id === r.id)) return prev;
          return [
            ...prev,
            {
              id: r.id,
              name: r.name,
              amount: r.amount ?? "",
              unit: r.unit ?? "",
              category: r.category ?? "Other",
              checked: r.checked,
              from: r.source ?? "",
            },
          ];
        });
      } else if (event.kind === "update") {
        const r = event.row;
        setItems((prev) =>
          prev.map((p) =>
            p.id === r.id
              ? {
                  ...p,
                  name: r.name,
                  amount: r.amount ?? "",
                  unit: r.unit ?? "",
                  category: r.category ?? p.category,
                  checked: r.checked,
                }
              : p,
          ),
        );
      } else if (event.kind === "delete") {
        const id = event.row.id;
        setItems((prev) => prev.filter((p) => p.id !== id));
      }
    };
    const unsub = subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: handle,
    });
    return unsub;
  }, [userId, householdId]);

  const toggleItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === itemId ? { ...i, checked: !i.checked } : i,
      );
      if (userId) {
        const target = next.find((x) => x.id === itemId);
        if (target) {
          void supabase.from("shopping_items").update({ checked: target.checked }).eq("id", itemId)
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
    Alert.alert("Clear shopping list", "Remove all items?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          setItems([]);
          if (userId) {
            void supabase.from("shopping_items").delete().eq("user_id", userId)
              .then(({ error }) => {
                if (error) {
                  void supabase
                    .from("shopping_lists")
                    .upsert({ user_id: userId, items: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
                }
              });
          }
        },
      },
    ]);
  }, [userId]);

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
        // G-2: share the same dedupe path as the on-screen render,
        // so exported text doesn't leak "60 g 60 g protein powder".
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
    // 2026-04-26 polish (round 2): match the canonical top-level screen
    // title — large, bold, foreground-coloured, normal letter-spacing. The
    // previous treatment (uppercase blue with 3px tracking) made Shopping
    // list look like a different app from the rest of the tabs.
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
    // Circular checkbox — matches Claude Design prototype + web
    // ShoppingList parity (2026-04-20). Square 6-radius box was a
    // divergence from the web port's 22px circle; keeping mobile
    // aligned so category rows read identically across platforms.
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
    checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
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
  }), [colors]);

  // 2026-04-30 (#2): badge + progress now reflect *grouped* rows so
  // the displayed count matches what the user sees on screen. Web has
  // always counted groups; mobile counted raw items, so a list with
  // two recipes contributing 50 ingredient rows each could show
  // "99+" while only ~70 actual products needed buying.
  const groupedSections = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))];
    return cats.map((category) => ({
      name: category,
      groups: groupShoppingItemsByIngredientName(
        items.filter((i) => i.category === category),
      ),
    }));
  }, [items]);
  const categories = useMemo(
    () => groupedSections.map((s) => s.name),
    [groupedSections],
  );
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Phase 2 / B1.1 — Plan sub-tab pill bar (Plan default,
          Shopping list as a sub-view). Tapping "This week" routes
          back to /(tabs)/planner. */}
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
          {/* 2026-04-26 polish (round 2): every other top-level screen
              title is Sentence Case (Discover / Library / Plan / Progress
              / More); SHOPPING LIST was the lone uppercase outlier. */}
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

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Accent.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛒</Text>
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
            {/* Progress */}
            <View style={styles.card}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressCount}>{checkedCount}/{items.length}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            {/* Clear checked button */}
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

            {/* Items by category — grouped by ingredient name to match
                web (issue #2, 2026-04-30). Pre-fix two recipes adding
                "Instant Oats" produced two separate rows like
                "875 g Instant Oats" and "175 g Instant Oats"; with the
                shape of `name` sometimes carrying a duplicate prefix,
                this rendered as "875 g 175 g Instant Oats". The web
                ShoppingList in src/app/components/ShoppingList.tsx has
                always used `groupShoppingItemsByIngredientName` +
                `formatMixedShoppingAmounts` to merge rows; mobile now
                does the same so quantities like "Instant Oats (875 g
                + 175 g)" show on a single line. */}
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
                    return (
                      <Pressable
                        key={group.key}
                        style={styles.itemRow}
                        onPress={() => {
                          // Toggle the whole group as one — same behaviour
                          // as web's `toggleGroupChecked`.
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
                          {allChecked && <Text style={styles.checkmark}>✓</Text>}
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
                        </View>
                      </Pressable>
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
