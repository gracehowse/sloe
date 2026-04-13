import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useMemo, useState } from "react";
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
import { useThemeColors } from "@/hooks/use-theme-colors";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes, useSavedRecipes } from "@/lib/recipes";
import { Ionicons } from "@expo/vector-icons";
import { decodeEntities } from "@/lib/decodeEntities";
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();

  const { recipes, loading, refresh } = useDiscoverRecipes();
  const { savedIds, toggleSave } = useSavedRecipes(userId);
  const [search, setSearch] = useState("");

  /**
   * Instagram → Copy link or share often leaves the URL on the pasteboard; read on Discover focus.
   * Runs even when signed out so we can open Import with ?url= and prompt sign-in there.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const t = setTimeout(async () => {
        if (cancelled) return;
        const text = await safeGetClipboardString();
        if (cancelled || !text) return;
        const url = consumeNewSocialRecipeUrlFromClipboard(text);
        if (!url || cancelled) return;
        router.replace({ pathname: "/import-shared", params: { url } });
      }, 900);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [router]),
  );

  const filtered = search.trim()
    ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { alignItems: "center", paddingVertical: Spacing.md },
        headerTitle: {
          fontSize: 22,
          fontWeight: "800",
          color: Neon.purple,
          letterSpacing: 3,
        },
        searchRow: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
        searchInput: {
          backgroundColor: colors.card,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          fontSize: 15,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        },
        list: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 100,
          gap: Spacing.lg,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Neon.pink + "30",
          overflow: "hidden",
        },
        cardImage: {
          width: "100%",
          height: 190,
          backgroundColor: colors.border,
        },
        calBadge: {
          position: "absolute",
          top: Spacing.md,
          right: Spacing.md,
          backgroundColor: "#000000bb",
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.sm,
        },
        calBadgeText: {
          color: "#ffffff",
          fontSize: 13,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        },
        cardBody: { padding: Spacing.lg, gap: Spacing.sm },
        cardTitle: {
          fontSize: 17,
          fontWeight: "600",
          color: colors.text,
        },
        macroRow: { flexDirection: "row", gap: Spacing.sm },
        macroChip: {
          borderWidth: 1,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 2,
        },
        macroChipText: {
          fontSize: 11,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        },
        cardFooter: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: Spacing.xs,
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
          backgroundColor: colors.border,
        },
        creatorName: { fontSize: 13, color: colors.textSecondary, flex: 1 },
        saveBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          justifyContent: "center",
          alignItems: "center",
        },
        saveBtnActive: {
          backgroundColor: Neon.pink + "18",
        },
        loadingContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: Spacing.md,
        },
        loadingText: { fontSize: 14, color: colors.textSecondary },
        emptyContainer: {
          paddingTop: 80,
          alignItems: "center",
          gap: Spacing.sm,
        },
        emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
        emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
        emptySubtext: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          maxWidth: 260,
        },
      }),
    [colors],
  );

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => {
      const saved = savedIds.has(item.id);
      return (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/recipe/${item.id}`)}
          android_ripple={{ color: "#ffffff10" }}
        >
          <Image source={{ uri: item.image }} style={styles.cardImage} />

          {/* Calorie badge */}
          <View style={styles.calBadge}>
            <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {decodeEntities(item.title)}
            </Text>

            {/* Macro chips */}
            <View style={styles.macroRow}>
              <View style={[styles.macroChip, { borderColor: MacroColors.protein + "60" }]}>
                <Text style={[styles.macroChipText, { color: MacroColors.protein }]}>P {item.protein}g</Text>
              </View>
              <View style={[styles.macroChip, { borderColor: MacroColors.carbs + "60" }]}>
                <Text style={[styles.macroChipText, { color: MacroColors.carbs }]}>C {item.carbs}g</Text>
              </View>
              <View style={[styles.macroChip, { borderColor: MacroColors.fat + "60" }]}>
                <Text style={[styles.macroChipText, { color: MacroColors.fat }]}>F {item.fat}g</Text>
              </View>
              {(item.fiberG ?? 0) > 0 && (
                <View style={[styles.macroChip, { borderColor: MacroColors.fiber + "60" }]}>
                  <Text style={[styles.macroChipText, { color: MacroColors.fiber }]}>Fb {item.fiberG}g</Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.creatorRow}>
                <Text style={styles.creatorName} numberOfLines={1}>
                  {item.creatorName}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleSave(item.id)}
                hitSlop={12}
                style={[styles.saveBtn, saved && styles.saveBtnActive]}
              >
                <Ionicons
                  name={saved ? "bookmark" : "bookmark-outline"}
                  size={20}
                  color={saved ? Neon.pink : colors.tabIconDefault}
                />
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [savedIds, router, toggleSave, styles, colors],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DISCOVER</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes..."
          placeholderTextColor={colors.tabIconDefault}
          style={styles.searchInput}
        />
      </View>

      {/* Recipe list */}
      {loading && recipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Neon.purple} />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Neon.purple} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{search.trim() ? "🔍" : "🍽️"}</Text>
              <Text style={styles.emptyTitle}>{search.trim() ? `No results for "${search.trim()}"` : "No recipes yet"}</Text>
              <Text style={styles.emptySubtext}>
                {search.trim() ? "Try a different search term." : "Pull down to refresh, or check your connection."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
