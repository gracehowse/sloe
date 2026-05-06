import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Beef,
  Wheat,
  Droplets,
  Leaf,
  Flame,
  Clock,
  Bookmark,
  ChevronLeft,
  ArrowUpDown,
  Plus,
  Search as SearchIcon,
  BookOpen,
  MoreHorizontal,
} from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { useSavedLibraryRecipes, useSavedRecipes } from "@/lib/recipes";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { Accent, MacroColors, Spacing, Radius, Type } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";
import {
  LIBRARY_FILTER_PILLS,
  matchesNutritionPill,
  type LibraryFilterPillId,
} from "../../../../src/lib/recipes/libraryFilters";
import { classifyLibraryEntry } from "../../../../src/lib/recipes/libraryEntryKind";
import { RecipesSubTabHeader } from "@/components/tabs/RecipesSubTabHeader";
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` imports
// dropped — Library cards no longer render the chip; see the comment
// by each card body for the rationale.

type SortKey = "recent" | "calories" | "protein";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recent",
  calories: "Calories",
  protein: "Protein",
};

/** GW-01 fix (audit 2026-04-28): predicate moved to the shared
 *  module `src/lib/recipes/libraryEntryKind.ts` so web + mobile
 *  cannot drift. Saves now win over authorship — a recipe that's in
 *  the saves set is "saved" regardless of author_id, which fixes
 *  the seed-poisoned case where every save pointed at a row whose
 *  author_id had been written as Grace's UUID by the URL-seed
 *  script. */
function entryKindForCard(
  card: RecipeCard,
  userId: string | null,
): "saved" | "created" | "imported" {
  return classifyLibraryEntry(
    {
      isSaved: card.isSaved,
      authorId: card.authorId ?? null,
      sourceUrl: card.sourceUrl ?? null,
    },
    userId,
  );
}

/** Human-readable total time for the card metadata row. */
function formatTotalTime(card: RecipeCard): string | null {
  const prep = typeof card.prepTimeMin === "number" ? card.prepTimeMin : 0;
  const cook = typeof card.cookTimeMin === "number" ? card.cookTimeMin : 0;
  const total = prep + cook;
  return total > 0 ? `${total} min` : null;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();
  // Library is a tab root — `useSafeBack` falls back to Today when the
  // stack is cold (e.g. hitting Library first from a deep link). The
  // back chevron in the prototype is presentational parity with the
  // push-Library surface used when we navigate there from a recipe
  // detail; when there's no history we send the user home rather than
  // stranding them.
  const goBack = useSafeBack("/(tabs)");

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
  // Web parity (Pass 6, 2026-04-18) + prototype port (2026-04-20):
  // single filter pill row covering entry-kind (All / Saved / Created
  // / Imported) and nutrition / time / diet (High-Protein / Quick /
  // Vegetarian). See `src/lib/recipes/libraryFilters.ts` for the
  // canonical ordering + predicate shape.
  const [pill, setPill] = useState<LibraryFilterPillId>("all");

  const cycleSort = useCallback(() => {
    setSortKey((prev) => {
      const keys: SortKey[] = ["recent", "calories", "protein"];
      return keys[(keys.indexOf(prev) + 1) % keys.length];
    });
  }, []);

  const savedCount = useMemo(
    () => savedRecipes.filter((r) => r.isSaved).length,
    [savedRecipes],
  );

  const filtered = useMemo(() => {
    let list = savedRecipes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (pill === "saved" || pill === "created" || pill === "imported") {
      list = list.filter((r) => entryKindForCard(r, userId) === pill);
    } else if (pill !== "all") {
      list = list.filter((r) => matchesNutritionPill(pill, r));
    }
    if (sortKey === "calories") {
      list = [...list].sort((a, b) => b.calories - a.calories);
    } else if (sortKey === "protein") {
      list = [...list].sort((a, b) => b.protein - a.protein);
    }
    return list;
  }, [savedRecipes, search, sortKey, pill, userId]);

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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    backHit: { padding: 6, marginLeft: -6 },
    titleBlock: { flex: 1 },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.4,
    },
    headerSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      fontVariant: ["tabular-nums"],
    },
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
    // 2026-04-30 audit (customer-lens): Library was the obvious spot
    // for "+ Create" but had no entry — the only way to reach the
    // create flow was More → Settings → Create Recipe. Pill placed
    // next to Sort so the two header controls feel like peers (Sort
    // affects what's shown, Create adds a new row to the list).
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: Accent.primary,
      borderWidth: 1,
      borderColor: Accent.primary,
    },
    createBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    searchRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
    filterScroll: {
      // 2026-05-06 (Grace) — "Quick" pill was clipping at the right
      // edge: a single `paddingHorizontal: Spacing.xl` left the
      // rightmost pill flush against the trailing padding so its
      // border/text touched the screen edge with no breathing room.
      // Splitting into explicit `paddingLeft` (preserve original
      // edge alignment with the section header) + a generous
      // `paddingRight: Spacing.xl * 2` so the trailing pill always
      // has visible scroll-headroom and doesn't sit on the screen
      // edge.
      paddingLeft: Spacing.xl,
      paddingRight: Spacing.xl * 2,
      // F-63b (2026-04-22): tester AAUNt / ALvjyW flagged the Library
      // filter pills as "scrunched" / "format layout still terrible"
      // — on iOS the horizontal ScrollView was rendering at just
      // enough height to clip the top and bottom of the pill text.
      // Explicit top padding + alignItems centres the pills against
      // a known row height (see filterScrollStyle below).
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
      alignItems: "center",
      gap: 8,
    },
    filterScrollStyle: {
      // Explicit row height so the horizontal ScrollView doesn't
      // collapse around a partial render frame. 44pt = iOS min tap
      // target; F-36 Dynamic Type clamp (maxFontSizeMultiplier=1.2)
      // keeps the text itself under the row.
      flexGrow: 0,
      minHeight: 44,
    },
    // 2026-05-02 (build-12): tester reported pill text was visually
     // squished against the borders ("All · 21", "Saved · 13",
     // "High-Protein", "Quick"). The previous `paddingVertical: 7`
     // with no `minHeight` left a ~30pt-tall pill where the descenders
     // touched the bottom border on iOS. Bumped vertical padding to 8
     // and added an explicit `minHeight: 32` (iOS HIG hit-target floor
     // for inline pills) plus `justifyContent: "center"` so the
     // `Type.body` text sits in the optical centre. Horizontal
     // padding stays at 14 (== Spacing.sm + Spacing.xs) which already
     // satisfies the brief floor; the squish was vertical.
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    filterPillActive: {
      backgroundColor: Accent.primary + "1A",
      borderColor: Accent.primary,
    },
    filterPillText: {
      // Type.body (14/20) — brief said use `Type.caption` or
      // `Type.body`; body wins for readability of count suffixes
      // ("All · 21" needs to stay legible at thumb-glance distance).
      fontSize: Type.body.fontSize,
      lineHeight: Type.body.lineHeight,
      fontWeight: "600",
      color: colors.text,
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
      gap: Spacing.md,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    // Prototype: "big recipe cards (120-ish tall image gradient)".
    cardImageWrap: {
      width: "100%",
      height: 128,
      backgroundColor: colors.border,
      position: "relative",
    },
    cardImage: { width: "100%", height: "100%" },
    // F-33 (2026-04-21): TestFlight AH96GSgB4pjq ("why are the grey half").
    // The old 64px dark overlay existed to lift any title/macros rendered on
    // the image — but we render title + macros in `cardBody` below the image,
    // so the overlay was decorative at best and actively muddied socially-
    // imported photos that already have baked-in text at worst. Kept as a
    // transparent passthrough so the position:absolute siblings (bookmark,
    // trash) still have their layout context.
    cardGradient: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 0,
    },
    // P3 dark-mode fix (2026-04-28): was hard-coded white pill that
    // ignored the active scheme. Now uses `colors.card` so the
    // bookmark sits in the same surface tier as other elevated chips.
    bookmarkDot: {
      position: "absolute",
      top: Spacing.sm,
      right: Spacing.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    // Audit 2026-04-30: reinstate a discoverable delete affordance.
    // P2-32 hid trash behind long-press, but customer-lens flagged this
    // as undiscoverable on iOS where long-press is not a learned
    // gesture for "delete". `MoreHorizontal` is the universal neutral
    // overflow glyph; tap opens an Alert sheet with Remove + Cancel
    // (which is what `confirmRemove` already does).
    cardOverflowBtn: {
      position: "absolute",
      top: Spacing.sm,
      // Sit immediately to the LEFT of the bookmarkDot (which lives at
      // `right: Spacing.sm` and is 30wide). 30 + Spacing.sm gap.
      right: Spacing.sm + 30 + 6,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: 4,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text, letterSpacing: -0.1 },
    cardSource: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginTop: 8,
      flexWrap: "wrap",
    },
    metaChunk: {
      fontSize: 11,
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    // P2-32 (2026-04-25): the visible remove-from-library trash icon
    // was replaced by a long-press confirm flow on the card itself.
    // The dead `removeBtn` style was removed in P3 dark-mode sweep
    // (2026-04-28) — keeping the comment so a future contributor
    // doesn't try to re-add the visible delete affordance without
    // reading P2-32 first.
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
    ({ item }: { item: RecipeCard }) => {
      const totalTime = formatTotalTime(item);
      return (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/recipe/${item.id}`)}
          // P2-32 (2026-04-25): long-press → confirm-remove flow now
          // owns deletion (replacing the always-visible trash button).
          // Audit 2026-04-30: long-press kept as a power-user shortcut
          // but is no longer the only path — see overflow button below.
          onLongPress={() => confirmRemove(item)}
          accessibilityLabel={`${item.title}, ${Math.round(item.calories)} calories.`}
        >
          <View style={styles.cardImageWrap}>
            {/* Audit 2026-05-04 #28: when a recipe has no image (e.g.
                user-imported recipe with no thumbnail captured) OR the
                fetched image fails to load (network blip, expired
                Unsplash URL), the blank white area reads as a broken
                card next to siblings that did have photos. Render a
                neutral placeholder surface (soft grey + utensils glyph)
                so cards stay visually consistent in both cases.

                NOTE: `useSavedLibraryRecipes` resolves `item.image` to a
                stock URL via `pickDefaultImage` when `image_url` is
                missing, so the empty-string branch only fires for
                pathological data; the on-error branch is the actually-
                live fallback path. */}
            <RecipeCardImage
              uri={item.image}
              cardImageStyle={styles.cardImage}
              fallbackBg={colors.cardBorder}
              fallbackTint={colors.textTertiary}
            />
            <View style={styles.cardGradient} pointerEvents="none" />
            {item.isSaved ? (
              <View style={styles.bookmarkDot} accessibilityLabel="Saved">
                <Bookmark size={14} color={Accent.primary} fill={Accent.primary} />
              </View>
            ) : null}
            {/* Audit 2026-04-30: discoverable overflow menu for delete.
                Sits to the left of the bookmark dot. Tapping opens the
                same Alert sheet long-press already triggers, so we
                preserve P2-32's "delete is confirmed, never one-tap"
                rule while making it visible to first-time users. */}
            <Pressable
              style={styles.cardOverflowBtn}
              onPress={() => confirmRemove(item)}
              accessibilityRole="button"
              accessibilityLabel={`More options for ${item.title}`}
              hitSlop={8}
            >
              <MoreHorizontal size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.creatorName ? (
              <Text style={styles.cardSource} numberOfLines={1}>{item.creatorName}</Text>
            ) : null}
            {/* 2026-04-26 polish (round 3): bring Library cards to
                Discover-card parity. Pre-fix this row showed only
                "kcal · P" — Discover shows kcal + protein + carbs +
                fat + (fibre when present) each with its own coloured
                icon. Tester: "library tiles look different to
                discovery screen tiles - they only show P not the
                full macros with icons etc". */}
            <View style={[styles.metaRow, { flexWrap: "wrap", gap: 10 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Flame size={11} color={MacroColors.calories} />
                <Text style={[styles.metaChunk, { fontVariant: ["tabular-nums"] }]}>{Math.round(item.calories)} kcal</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Beef size={11} color={MacroColors.protein} />
                <Text style={[styles.metaChunk, { fontVariant: ["tabular-nums"] }]}>{Math.round(item.protein)}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Wheat size={11} color={MacroColors.carbs} />
                <Text style={[styles.metaChunk, { fontVariant: ["tabular-nums"] }]}>{Math.round(item.carbs)}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Droplets size={11} color={MacroColors.fat} />
                <Text style={[styles.metaChunk, { fontVariant: ["tabular-nums"] }]}>{Math.round(item.fat)}g</Text>
              </View>
              {Number.isFinite(item.fiberG) && (item.fiberG ?? 0) > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Leaf size={11} color={MacroColors.fiber} />
                  <Text style={[styles.metaChunk, { fontVariant: ["tabular-nums"] }]}>
                    {Math.round((item.fiberG ?? 0) * 10) / 10}g
                  </Text>
                </View>
              ) : null}
              {totalTime ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Clock size={11} color={Accent.primary} />
                  <Text style={styles.metaChunk}>{totalTime}</Text>
                </View>
              ) : null}
            </View>
            {/* GW-08 (audit 2026-04-28): TrustChip removed for the same
                reason as Discover hero — the source label was fabricated
                from `item.isVerified` (which is itself written by the
                importer as `(m?.calories ?? 0) > 0`). Restoring it
                requires real per-recipe match-source data, P1/P2 work. */}
          </View>
        </Pressable>
      );
    },
    [router, confirmRemove, styles],
  );

  const isLoading = loading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Phase 2 / B1.1 — Recipes sub-tab pill bar (Library default,
          Discover sibling). Lives at the top of every Recipes-group
          screen so the user can flip without leaving the group. */}
      <RecipesSubTabHeader />
      {/* Prototype: back chevron + "Library" title → "{n} recipes ·
          {m} saved" subtitle. The sort cycle button moves to the
          trailing slot so the control surface stays discoverable
          without crowding the title. */}
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backHit} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle}>Library</Text>
          <Text style={styles.headerSub}>
            {savedRecipes.length} {savedRecipes.length === 1 ? "recipe" : "recipes"} · {savedCount} saved
          </Text>
        </View>
        <Pressable style={styles.sortBtn} onPress={cycleSort} accessibilityLabel={`Sort by ${SORT_LABELS[sortKey]}`}>
          <ArrowUpDown size={14} color={colors.textSecondary} />
          <Text style={styles.sortText}>{SORT_LABELS[sortKey]}</Text>
        </Pressable>
        {/* 2026-04-30 audit (customer-lens): first-class "+ Create"
            entry. Routes to the wizard at `/recipe/create` (5-step
            guided flow). Surfaces the create-from-scratch path that
            was previously buried under More → Settings. */}
        <Pressable
          style={styles.createBtn}
          onPress={() => router.push("/recipe/create")}
          accessibilityLabel="Create a new recipe"
          accessibilityHint="Opens the new recipe wizard"
        >
          <Plus size={14} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
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

      {/* Filter pill row — horizontal scroll per prototype. Combines
          entry-kind (All / Saved / Created / Imported) + nutrition /
          time / diet (High-Protein / Quick / Vegetarian). Single row so
          there's no ambiguity about which filter is active. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollStyle}
        contentContainerStyle={styles.filterScroll}
      >
        {LIBRARY_FILTER_PILLS.map((f) => {
          const active = pill === f.id;
          // 2026-04-30 audit visual-qa P1 #7: show counts on the
          // entry-kind pills (All / Saved) so the user knows the
          // size of each bucket at a glance. Other pills are
          // filters (High-Protein / Quick / Vegetarian) and don't
          // need counts — the filtered list itself shows what's left.
          const count =
            f.id === "all"
              ? savedRecipes.length
              : f.id === "saved"
                ? savedCount
                : null;
          const label = count != null ? `${f.label} · ${count}` : f.label;
          return (
            <Pressable
              key={f.id}
              onPress={() => setPill(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${f.label}${count != null ? `, ${count} recipes` : ""}`}
            >
              <Text
                style={[styles.filterPillText, active && styles.filterPillTextActive]}
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
                <SearchIcon size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>No results for &ldquo;{search.trim()}&rdquo;</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <BookOpen size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>No saved recipes</Text>
                <Text style={styles.emptySubtext}>
                  Save recipes from Discover, import one you found, or write your own from scratch — everything shows up here for meal plans.
                </Text>
                <View style={styles.emptyActions}>
                  <Pressable style={styles.ctaBtn} onPress={() => router.push("/recipe/create")}>
                    <Text style={styles.ctaBtnText}>Create a recipe</Text>
                  </Pressable>
                  <Pressable style={styles.ctaBtnSecondary} onPress={() => router.push("/(tabs)/discover")}>
                    <Text style={styles.ctaBtnSecondaryText}>Go to Discover</Text>
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
