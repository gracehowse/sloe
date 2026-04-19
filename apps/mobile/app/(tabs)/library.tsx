import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { useSavedLibraryRecipes, useSavedRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";

type SortKey = "recent" | "calories" | "protein";
type KindFilter = "all" | "saved" | "created" | "imported";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recent",
  calories: "Calories",
  protein: "Protein",
};

const KIND_FILTERS: ReadonlyArray<{ key: KindFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "saved", label: "Saved" },
  { key: "created", label: "Created" },
  { key: "imported", label: "Imported" },
];

/** Derive entry-kind for a mobile library row.
 *
 *  Web uses an explicit `libraryEntryKindByRecipeId` map populated by
 *  AppDataContext when the user creates / imports a recipe. Mobile
 *  doesn't have that map, so we derive locally from `authorId` and
 *  `sourceUrl`:
 *    - own author + has source URL → imported (came in via the
 *      import-shared flow)
 *    - own author + no source URL  → created (built in the app)
 *    - someone else's author       → saved (came from Discover)
 */
function entryKindForCard(
  card: RecipeCard,
  userId: string | null,
): Exclude<KindFilter, "all"> {
  if (userId && card.authorId && card.authorId === userId) {
    return card.sourceUrl ? "imported" : "created";
  }
  return "saved";
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();

  const { recipes: savedRecipes, loading, refresh } = useSavedLibraryRecipes(userId);
  const { toggleSave: persistSaveToggle } = useSavedRecipes(userId);

  /** Reload rows after yield/macros edits on recipe detail (list state is otherwise stale). */
  useFocusEffect(
    useCallback(() => {
      if (userId) void refresh();
    }, [userId, refresh]),
  );

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  // Web parity (Pass 6, 2026-04-18): kindFilter pills below the
  // search row. Web Library has had this since launch; mobile was
  // sort-only.
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const cycleSort = useCallback(() => {
    setSortKey((prev) => {
      const keys: SortKey[] = ["recent", "calories", "protein"];
      return keys[(keys.indexOf(prev) + 1) % keys.length];
    });
  }, []);

  const filtered = useMemo(() => {
    let list = savedRecipes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (kindFilter !== "all") {
      list = list.filter((r) => entryKindForCard(r, userId) === kindFilter);
    }
    if (sortKey === "calories") {
      list = [...list].sort((a, b) => b.calories - a.calories);
    } else if (sortKey === "protein") {
      list = [...list].sort((a, b) => b.protein - a.protein);
    }
    return list;
  }, [savedRecipes, search, sortKey, kindFilter, userId]);

  const confirmRemove = useCallback(
    (item: RecipeCard) => {
      Alert.alert(
        "Remove from library?",
        `"${item.title}" will be removed from your saved recipes.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await persistSaveToggle(item.id);
              await refresh();
            },
          },
        ],
      );
    },
    [persistSaveToggle, refresh],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    countBadge: {
      backgroundColor: Accent.primary + "15",
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.sm,
    },
    countText: { color: Accent.primary, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sortText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    searchRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.sm,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterPillActive: {
      backgroundColor: Accent.primary + "1A",
      borderColor: Accent.primary,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: Accent.primary,
      fontWeight: "600",
    },
    searchInput: {
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    list: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: 100,
      gap: Spacing.sm,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    cardImage: {
      width: 96,
      height: 96,
      backgroundColor: colors.border,
    },
    cardBody: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: 4,
    },
    cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    macroRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
    macroChip: {
      borderWidth: 1,
      borderRadius: Radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    macroChipText: { fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
    removeBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    logBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.md,
      justifyContent: "center",
    },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: {
      paddingTop: 80,
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
    emptySubtext: { fontSize: 14, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
    emptyActions: { marginTop: Spacing.lg, gap: Spacing.sm, width: "100%", maxWidth: 280 },
    ctaBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      alignItems: "center",
    },
    ctaBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    ctaBtnSecondary: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Accent.primary + "80",
      alignItems: "center",
    },
    ctaBtnSecondaryText: { color: Accent.primary, fontWeight: "600", fontSize: 15 },
  }), [colors]);

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => (
      <View style={styles.card}>
        <Pressable
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
          onPress={() => router.push(`/recipe/${item.id}`)}
          accessibilityLabel={`${item.title}, ${Math.round(item.calories)} calories`}
        >
          <Image source={{ uri: item.image }} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
              <Text style={{ color: MacroColors.calories, fontWeight: "600" }}>{Math.round(item.calories)}</Text>
              <Text> kcal  </Text>
              <Text style={{ color: MacroColors.protein, fontWeight: "600" }}>P {Math.round(item.protein)}g</Text>
              <Text>  </Text>
              <Text style={{ color: MacroColors.carbs, fontWeight: "600" }}>C {Math.round(item.carbs)}g</Text>
              <Text>  </Text>
              <Text style={{ color: MacroColors.fat, fontWeight: "600" }}>F {Math.round(item.fat)}g</Text>
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/recipe/${item.id}`)}
          style={styles.logBtn}
          hitSlop={8}
          accessibilityLabel={`Log ${item.title} to journal`}
        >
          <Ionicons name="nutrition-outline" size={18} color={Accent.primary} />
        </Pressable>
        <Pressable
          onPress={() => confirmRemove(item)}
          hitSlop={12}
          style={styles.removeBtn}
          accessibilityLabel={`Remove ${item.title} from library`}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    ),
    [router, confirmRemove, styles, colors],
  );

  const isLoading = loading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Library</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{savedRecipes.length}</Text>
          </View>
        </View>
        <Pressable style={styles.sortBtn} onPress={cycleSort} accessibilityLabel={`Sort by ${SORT_LABELS[sortKey]}`}>
          <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
          <Text style={styles.sortText}>{SORT_LABELS[sortKey]}</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search your recipes…"
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
          accessibilityLabel="Search saved recipes"
        />
      </View>

      {/* Kind filter pills — web parity (Pass 6, 2026-04-18). Filter
          by entry kind (Saved / Created / Imported), derived locally
          from authorId + sourceUrl. */}
      <View style={styles.filterRow}>
        {KIND_FILTERS.map((f) => {
          const active = kindFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setKindFilter(f.key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${f.label}`}
            >
              <Text
                style={[styles.filterPillText, active && styles.filterPillTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && savedRecipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Accent.primary} />
          }
          ListEmptyComponent={
            search.trim() ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>No results for &ldquo;{search.trim()}&rdquo;</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="book-outline" size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>No saved recipes</Text>
                <Text style={styles.emptySubtext}>
                  Save recipes from Discover or paste a recipe URL — everything you save shows up here for meal plans.
                </Text>
                <View style={styles.emptyActions}>
                  <Pressable style={styles.ctaBtn} onPress={() => router.push("/(tabs)/discover")}>
                    <Text style={styles.ctaBtnText}>Go to Discover</Text>
                  </Pressable>
                  <Pressable style={styles.ctaBtnSecondary} onPress={() => router.push("/import-shared")}>
                    <Text style={styles.ctaBtnSecondaryText}>Import a recipe</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
        />
      )}
    </View>
  );
}
