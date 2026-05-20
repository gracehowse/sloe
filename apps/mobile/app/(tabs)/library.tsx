import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  View,
  Text,
  FlatList,
  Platform,
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
import { useLibrarySearchStore } from "@/hooks/useLibrarySearchStore";
import { useSavedLibraryRecipes, useSavedRecipes } from "@/lib/recipes";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";
import {
  LIBRARY_FILTER_PILLS,
  matchesNutritionPill,
  type LibraryFilterPillId,
} from "@suppr/shared/recipes/libraryFilters";
import { classifyLibraryEntry } from "@suppr/shared/recipes/libraryEntryKind";
import { RecipesTabChrome } from "@/components/tabs/RecipesTabChrome";
import { CreateRecipeActionSheet } from "@/components/recipe/CreateRecipeActionSheet";
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

  // ENG-100 (2026-05-16, Grace decision = "default to Discover only"):
  // Library is empty for new users — the first impression on tapping
  // the Recipes tab is a blank slate that doesn't tell the user what
  // the product can do. Redirect to /discover until they have ≥1
  // saved recipe. After the first save they get the normal Library
  // landing. The redirect intentionally fires on every focus while
  // `savedRecipes.length === 0` so the rule is uniform regardless of
  // entry path (tab tap, deep link, app cold-open) — there's no
  // useful Library state at savedCount=0 to preserve. Gated on
  // `!loading` to avoid bouncing during the initial fetch.
  useFocusEffect(
    useCallback(() => {
      if (!loading && savedRecipes.length === 0) {
        router.replace("/(tabs)/discover");
      }
    }, [loading, savedRecipes.length]),
  );

  // Shared with Discover via `useLibrarySearchStore` so the query
  // survives tab switches (ENG-53, 2026-05-16). Variable names kept
  // (search / setSearch) to leave all 100+ downstream usages alone.
  const { query: search, setQuery: setSearch } = useLibrarySearchStore();
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  // Web parity (Pass 6, 2026-04-18) + prototype port (2026-04-20):
  // single filter pill row covering entry-kind (All / Saved / Created
  // / Imported) and nutrition / time / diet (High-Protein / Quick /
  // Vegetarian). See `src/lib/recipes/libraryFilters.ts` for the
  // canonical ordering + predicate shape.
  const [pill, setPill] = useState<LibraryFilterPillId>("all");
  // 2026-05-12 (premium-bar audit #8): tapping "+ Create" opens a
  // multi-source action sheet instead of hard-routing to manual entry.
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

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

  /**
   * 2026-05-06 (Grace) — the `…` overflow icon used to open the
   * `confirmRemove` Alert directly, which violated the convention
   * that `…` means "more options" not "delete". Now opens an
   * iOS-native action sheet (or RN Alert on Android) with three
   * choices: View recipe (primary), Remove from library
   * (destructive), Cancel. The destructive path still chains into
   * `confirmRemove` so the user gets the existing two-step delete
   * confirmation — no silent one-tap delete.
   */
  const openCardActions = useCallback(
    (item: RecipeCard) => {
      const labels = ["View recipe", "Remove from library", "Cancel"] as const;
      const viewRecipe = () => router.push(`/recipe/${item.id}`);
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: item.title,
            options: [...labels],
            destructiveButtonIndex: 1,
            cancelButtonIndex: 2,
          },
          (idx) => {
            if (idx === 0) viewRecipe();
            else if (idx === 1) confirmRemove(item);
          },
        );
        return;
      }
      // Android (and any non-iOS platform) — RN Alert serves as a
      // simple action-sheet equivalent. Order intentionally matches
      // the iOS sheet so muscle memory carries.
      Alert.alert(item.title, undefined, [
        { text: "View recipe", onPress: viewRecipe },
        { text: "Remove from library", style: "destructive", onPress: () => confirmRemove(item) },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [router, confirmRemove],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // 2026-05-06 (Grace) — header geometry now mirrors Discover:
    // small uppercase overline + 28pt bold title in a vertical
    // block, with sort/create controls + count moved to a
    // secondary row below.
    headerActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: 14,
    },
    // Legacy topBar / backHit / titleBlock kept for any other
    // surface that imports library.tsx's styles indirectly. Marked
    // unused by the new header layout.
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
    headerSub: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
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
      // 2026-05-06 (Grace) — canonical pill geometry shared with
      // `apps/mobile/app/(tabs)/discover.tsx`. Both surfaces show
      // a horizontal-scrolling filter row; Library used to render
      // chunkier pills (Type.body/14pt + paddingHorizontal:14) which
      // clipped "Quick" against the trailing edge AND gave a
      // visually heavier row than Discover. Now identical.
      //
      // Geometry: paddingHorizontal:13 + paddingVertical:8 + minHeight:36
      // + lineHeight:18 — gives descenders ("g" in High-Protein, "Q"
      // in Quick) the headroom RN/iOS needs without the tails clipping
      // at the bottom border. `borderRadius:20` matches Discover's
      // softer corner; the pill is shorter than the 999 fully-round
      // shape but reads as a proper pill.
      paddingHorizontal: 13,
      paddingVertical: 8,
      minHeight: 36,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    filterPillActive: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.text,
    },
    filterPillText: {
      // 12/18 — matches Discover's text scale (fontSize 12) but
      // with a bumped lineHeight 16 → 18 so descenders sit fully
      // inside the pill body instead of clipping at the border.
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.text,
    },
    filterPillTextActive: {
      color: colors.text,
      fontWeight: "700",
    },
    // 2026-05-06 (Grace) — search-input wrapper that holds the
    // magnifying-glass icon next to the TextInput. Mirrors the
    // Discover treatment (icon-prefixed bigger search bar).
    searchInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
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
              recipeId={item.id}
              recipeTitle={item.title}
            />
            <View style={styles.cardGradient} pointerEvents="none" />
            {item.isSaved ? (
              <View style={styles.bookmarkDot} accessibilityLabel="Saved">
                <Bookmark size={14} color={Accent.primary} fill={Accent.primary} />
              </View>
            ) : null}
            {/* 2026-05-06 (Grace) — `…` is "more options", not
                "delete one-tap". Tapping now opens an action sheet
                (iOS) or RN Alert menu (Android) with View / Remove /
                Cancel. The Remove path still chains into the existing
                `confirmRemove` two-step prompt so destructive actions
                stay confirmed. */}
            <Pressable
              style={styles.cardOverflowBtn}
              onPress={() => openCardActions(item)}
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
    <View
      testID="screen-library"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <RecipesTabChrome />

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
          ListHeaderComponent={
            <>
              <View style={styles.headerActionsRow}>
                <Text style={styles.headerSub}>
                  {loading && savedRecipes.length === 0
                    ? "Loading…"
                    : `${savedRecipes.length} ${savedRecipes.length === 1 ? "recipe" : "recipes"} · ${savedCount} saved`}
                </Text>
                <Pressable
                  style={styles.sortBtn}
                  onPress={cycleSort}
                  accessibilityLabel={`Sort by ${SORT_LABELS[sortKey]}`}
                >
                  <ArrowUpDown size={14} color={colors.textSecondary} />
                  <Text style={styles.sortText}>{SORT_LABELS[sortKey]}</Text>
                </Pressable>
                <Pressable
                  style={styles.createBtn}
                  onPress={() => setCreateSheetOpen(true)}
                  accessibilityLabel="Create a new recipe"
                  accessibilityHint="Opens a sheet with paste-link, photo, or manual entry options"
                >
                  <Plus size={14} color="#fff" />
                  <Text style={styles.createBtnText}>Create</Text>
                </Pressable>
              </View>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrap}>
                  <SearchIcon size={16} color={colors.textTertiary} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search your recipes"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.searchInput}
                    accessibilityLabel="Search saved recipes"
                  />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollStyle}
                contentContainerStyle={styles.filterScroll}
              >
                {LIBRARY_FILTER_PILLS.map((f) => {
                  const active = pill === f.id;
                  const isInitialLoad = loading && savedRecipes.length === 0;
                  const count =
                    isInitialLoad
                      ? null
                      : f.id === "all"
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
            </>
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

      {/* 2026-05-12 (premium-bar audit #8): multi-source action sheet
          for "+ Create". Opens on the header pill; clipboard
          auto-detect surfaces a paste shortcut when a recipe URL is
          already copied. */}
      <CreateRecipeActionSheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
      />
    </View>
  );
}
