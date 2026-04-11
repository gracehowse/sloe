import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { useSavedLibraryRecipes, useSavedRecipes } from "@/lib/recipes";
import { Neon, Spacing, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { recipes: savedRecipes, loading, refresh } = useSavedLibraryRecipes(userId);
  const { toggleSave: persistSaveToggle } = useSavedRecipes(userId);

  const toggleSave = useCallback(
    async (recipeId: string) => {
      await persistSaveToggle(recipeId);
      await refresh();
    },
    [persistSaveToggle, refresh],
  );

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/recipe/${item.id}`)}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.macros}>
            {item.calories} kcal · P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g
          </Text>
        </View>
        <Pressable onPress={() => toggleSave(item.id)} hitSlop={12} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </Pressable>
    ),
    [router, toggleSave],
  );

  const isLoading = loading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LIBRARY</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{savedRecipes.length}</Text>
        </View>
      </View>

      {isLoading && savedRecipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Neon.purple} />
        </View>
      ) : (
        <FlatList
          data={savedRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Neon.purple} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No saved recipes</Text>
              <Text style={styles.emptySubtext}>
                Save recipes from Discover or import a link — everything you save shows up here for meal plans.
              </Text>
              <View style={styles.emptyActions}>
                <Pressable style={styles.ctaBtn} onPress={() => router.push("/(tabs)")}>
                  <Text style={styles.ctaBtnText}>Browse Discover</Text>
                </Pressable>
                <Pressable style={styles.ctaBtnSecondary} onPress={() => router.push("/import-shared")}>
                  <Text style={styles.ctaBtnSecondaryText}>Import a link</Text>
                </Pressable>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Neon.purple,
    letterSpacing: 3,
  },
  countBadge: {
    backgroundColor: Neon.pink + "30",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  countText: { color: Neon.pink, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: "#16161e",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Neon.pink + "20",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardImage: {
    width: 72,
    height: 72,
    backgroundColor: "#1e1e2a",
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#f8fafc", marginBottom: 2 },
  macros: { fontSize: 11, color: "#94a3b8", fontVariant: ["tabular-nums"] },
  removeBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  removeBtnText: { color: "#4a4a5a", fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    paddingTop: 80,
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#f8fafc" },
  emptySubtext: { fontSize: 14, color: "#94a3b8", textAlign: "center", maxWidth: 280 },
  emptyActions: { marginTop: Spacing.lg, gap: Spacing.sm, width: "100%", maxWidth: 280 },
  ctaBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Neon.purple,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  ctaBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  ctaBtnSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Neon.purple + "80",
    alignItems: "center",
  },
  ctaBtnSecondaryText: { color: Neon.purple, fontWeight: "600", fontSize: 15 },
});
