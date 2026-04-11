import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
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

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { recipes, loading, refresh } = useDiscoverRecipes();
  const { savedIds, toggleSave } = useSavedRecipes(userId);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => {
      const saved = savedIds.has(item.id);
      return (
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/recipe/${item.id}`)}
        >
          <Image source={{ uri: item.image }} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.macroChip, { color: colors.textSecondary }]}>
                {item.calories} kcal
              </Text>
              <Text style={[styles.macroChip, { color: colors.textSecondary }]}>
                P: {item.protein}g
              </Text>
              <Text style={[styles.macroChip, { color: colors.textSecondary }]}>
                C: {item.carbs}g
              </Text>
              <Text style={[styles.macroChip, { color: colors.textSecondary }]}>
                F: {item.fat}g
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <View style={styles.creatorRow}>
                <Image source={{ uri: item.creatorImage }} style={styles.avatar} />
                <Text style={[styles.creatorName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.creatorName}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleSave(item.id)}
                hitSlop={12}
                style={[
                  styles.saveBtn,
                  saved && { backgroundColor: Brand.violet + "18" },
                ]}
              >
                <Text style={{ color: saved ? Brand.violet : colors.textTertiary, fontSize: 18 }}>
                  {saved ? "★" : "☆"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [savedIds, colors, router, toggleSave],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes..."
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text, backgroundColor: colors.backgroundSecondary }]}
        />
      </View>

      {/* Recipe list */}
      {loading && recipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Brand.violet} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading recipes...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Brand.violet} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No recipes yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Pull down to refresh, or check your connection.
              </Text>
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  searchRow: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchInput: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  cardMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  macroChip: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  creatorName: {
    fontSize: 13,
    flex: 1,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
  },
});
