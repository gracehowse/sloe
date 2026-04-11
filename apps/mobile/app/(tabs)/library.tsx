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
import { useDiscoverRecipes, useSavedRecipes } from "@/lib/recipes";
import { Brand, Colors, Spacing, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { RecipeCard } from "@/lib/types";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { recipes, loading, refresh } = useDiscoverRecipes();
  const { savedIds, toggleSave, loading: savesLoading } = useSavedRecipes(userId);

  const savedRecipes = recipes.filter((r) => savedIds.has(r.id));

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/recipe/${item.id}`)}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.macros, { color: colors.textSecondary }]}>
            {item.calories} kcal · P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g
          </Text>
        </View>
        <Pressable
          onPress={() => toggleSave(item.id)}
          hitSlop={12}
          style={styles.removeBtn}
        >
          <Text style={{ color: Brand.violet, fontSize: 14, fontWeight: "600" }}>Remove</Text>
        </Pressable>
      </Pressable>
    ),
    [savedIds, colors, router, toggleSave],
  );

  const isLoading = loading || savesLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
          {savedRecipes.length} saved
        </Text>
      </View>

      {isLoading && savedRecipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Brand.violet} />
        </View>
      ) : (
        <FlatList
          data={savedRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Brand.violet} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved recipes</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Save recipes from Discover to build your library and generate meal plans.
              </Text>
              <Pressable
                style={styles.ctaBtn}
                onPress={() => router.push("/(tabs)")}
              >
                <Text style={styles.ctaBtnText}>Browse Recipes</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  headerCount: { fontSize: 14 },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardImage: {
    width: 80,
    height: 80,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  macros: { fontSize: 12, fontVariant: ["tabular-nums"] },
  removeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtext: { fontSize: 14, textAlign: "center", maxWidth: 280 },
  ctaBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Brand.violet,
    borderRadius: Radius.md,
  },
  ctaBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
