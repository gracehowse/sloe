import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("shopping_lists")
        .select("items")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled) {
        if (data?.items && Array.isArray(data.items)) {
          setItems(data.items as ShoppingItem[]);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const toggleItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === itemId ? { ...i, checked: !i.checked } : i,
      );
      // Persist
      if (userId) {
        void supabase
          .from("shopping_lists")
          .upsert({ user_id: userId, items: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      }
      return next;
    });
  }, [userId]);

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
      color: Neon.purple,
      letterSpacing: 3,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Neon.pink + "30",
      padding: Spacing.xl,
      gap: Spacing.md,
    },

    progressRow: { flexDirection: "row", justifyContent: "space-between" },
    progressLabel: { color: colors.text, fontWeight: "600", fontSize: 14 },
    progressCount: { color: Neon.purple, fontWeight: "700", fontSize: 14, fontVariant: ["tabular-nums"] },
    progressTrack: { height: 6, backgroundColor: colors.inputBg, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: 6, backgroundColor: Neon.purple, borderRadius: 3 },

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
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.tabIconDefault,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: { backgroundColor: Neon.purple, borderColor: Neon.purple },
    checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
    itemName: { fontSize: 14, color: colors.text },
    itemChecked: { textDecorationLine: "line-through", color: colors.tabIconDefault },
    itemFrom: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Neon.pink + "30",
      padding: Spacing.xxxl,
      alignItems: "center",
      gap: Spacing.md,
    },
    emptyIcon: { fontSize: 40 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    ctaBtn: {
      backgroundColor: Neon.purple,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxxl,
      marginTop: Spacing.sm,
    },
    ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  }), [colors]);

  // Group by category
  const categories = [...new Set(items.map((i) => i.category))];
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? checkedCount / items.length : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>SHOPPING LIST</Text>
          <View style={{ width: 28 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Neon.purple} />
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

            {/* Items by category */}
            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              return (
                <View key={cat} style={styles.card}>
                  <Text style={styles.categoryTitle}>{cat}</Text>
                  {catItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.itemRow}
                      onPress={() => toggleItem(item.id)}
                    >
                      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                        {item.checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                          {item.amount} {item.unit} {item.name}
                        </Text>
                        <Text style={styles.itemFrom}>{item.from}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
