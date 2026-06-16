import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  ArrowUpDown,
  Clock,
  Plus,
  Search as SearchIcon,
  Star,
} from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { useLibrarySearchStore } from "@/hooks/useLibrarySearchStore";
import { useSavedLibraryRecipes, useSavedRecipes } from "@/lib/recipes";
import { setRecipePublishedWithPrompt } from "@/lib/goPublicRecipe";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useSafeBack } from "@/hooks/use-safe-back";
import { FontFamily, Spacing, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import type { RecipeCard } from "@/lib/types";
import {
  LIBRARY_CATEGORY_PILLS,
  matchesRecipeCategory,
  type RecipeCategoryId,
} from "@suppr/shared/recipes/recipeCategoryFilters";
import {
  matchesPlanImportPill,
  planImportFilterLabels,
  planImportPillId,
} from "@suppr/shared/planning/planImport/libraryFilters";
import { classifyLibraryEntry } from "@suppr/shared/recipes/libraryEntryKind";
import { recipeSearchMatch } from "@suppr/shared/recipes/recipeSearchMatch";
import { RecipesTabChrome } from "@/components/tabs/RecipesTabChrome";
import { CreateRecipeActionSheet } from "@/components/recipe/CreateRecipeActionSheet";
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` imports
// dropped — Library cards no longer render the chip; see the comment
// by each card body for the rationale.

type SortKey = "recent" | "calories" | "protein";

/**
 * Sloe seamless recipe-card corner. The Figma recipe cards (`527:2`
 * Cookbook / `528:2` Discover) sit at 20–24px; we use 24 to match the
 * canonical Sloe warm-slab corner already shared by the Today tiles
 * (`var(--radius-card-lg)` on web, `CARD_RADIUS`/`TILE_RADIUS = 24` on
 * mobile) so every cream slab in the app reads with one corner language.
 * The DS `Radius` ladder tops out at 12 (`xl`), hence this local const.
 * Web parity: `radius="lg"` (24px) on the `SupprCard` in `Library.tsx` /
 * `DiscoverFeed.tsx`.
 */
const RECIPE_CARD_RADIUS = CARD_RADIUS;

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
  const { keep } = useLocalSearchParams<{ keep?: string }>();
  const keepLibraryTab = keep === "1";
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the category-pill
  // active fill, create FAB, Go-Public + empty-state CTAs, the saved-bookmark
  // glyph, rating star, list spinner, and pull-to-refresh tint. Threaded into
  // the memoised StyleSheet via the dep array below.
  const accent = useAccent();
  // Discover/Library recipe cards are the Sloe Figma `527:2`/`528:2`
  // "seamless slab" cards: a `#F6F5F2` cream card lifted off the `#FFFFFF`
  // page by a SOFT drop shadow (NOT the flat Today slab, which blends),
  // 24px radius (RECIPE_CARD_RADIUS), image full-bleed to the top corners.
  // The `soft` variant supplies the lift; the radius + cream slab unify
  // image + body into one piece (kills the "floating photo box /
  // double-frame" — Grace 2026-06-07).
  const cardElevation = useCardElevation({ variant: "soft" });
  // Library is a tab root — `useSafeBack` falls back to Today when the
  // stack is cold (e.g. hitting Library first from a deep link). The
  // back chevron in the prototype is presentational parity with the
  // push-Library surface used when we navigate there from a recipe
  // detail; when there's no history we send the user home rather than
  // stranding them.
  const goBack = useSafeBack("/(tabs)");

  const { recipes: savedRecipes, loading, refreshing, refresh } = useSavedLibraryRecipes(userId);
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
  //
  // Consequence: the `emptySlab` (Figma S7 `529:2`) is a FALLBACK-ONLY
  // state — it only renders on a deep-link/cold-open edge where the
  // redirect fires after the list renders briefly empty. It is NOT a
  // "first-time user" entry point in the normal flow (which goes through
  // Discover). The polish on the slab is intentional and preserved; it
  // is not dead code. intentionally fallback-only per ENG-100 decision.
  useFocusEffect(
    useCallback(() => {
      if (keepLibraryTab) return;
      if (!loading && savedRecipes.length === 0) {
        router.replace("/(tabs)/discover");
      }
    }, [loading, savedRecipes.length, keepLibraryTab, router]),
  );

  // Shared with Discover via `useLibrarySearchStore` so the query
  // survives tab switches (ENG-53, 2026-05-16). Variable names kept
  // (search / setSearch) to leave all 100+ downstream usages alone.
  const { query: search, setQuery: setSearch } = useLibrarySearchStore();
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  // ENG-921 (2026-06-07, Grace) — CATEGORY filters per Figma `527:2`
  // (All · Breakfast · Lunch · Dinner · Dessert · Quick 30 · Under 500
  // cal · High protein · Soup · Pasta · Chicken · Salad), shared with
  // web via `recipeCategoryFilters.ts`. The entry-kind buckets
  // (Saved / Imported) are preserved — ENG-921 polish (2026-06-07) folds
  // them into a single quiet segmented control in the header (above the
  // category row) instead of a competing second pill row. Plan-import
  // sources reveal contextually under the category row only when the
  // Imported segment is active, so the default surface is one filter row.
  const [category, setCategory] = useState<RecipeCategoryId>("all");
  // Secondary filter — entry-kind ("saved"/"imported") or a plan-import
  // id ("plan-import:<source>"); null = no secondary narrowing.
  const [secondary, setSecondary] = useState<string | null>(null);
  // 2026-05-12 (premium-bar audit #8): tapping "+ Create" opens a
  // multi-source action sheet instead of hard-routing to manual entry.
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // §3.1 (recipes.md): sort opens an action sheet instead of cycling
  // blindly so users can reach any sort order in one tap, not guess the
  // cycle order. Options match recipes.md: Recent / Most calories / Most
  // protein. The chip shows the current label so the surface-level
  // feedback (what is currently sorted) is unchanged.
  const openSortSheet = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Sort recipes",
        options: ["Cancel", "Recent", "Most calories", "Most protein"],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) setSortKey("recent");
        else if (buttonIndex === 2) setSortKey("calories");
        else if (buttonIndex === 3) setSortKey("protein");
      },
    );
  }, []);

  // Entry-kind narrowing (preserved per ENG-921): the quiet control on the
  // count line cycles All → Saved → Imported → All. It writes the same
  // `secondary` state the old segmented control did, so the filter logic in
  // `filtered` is unchanged — just re-presented as a calm control instead
  // of a competing second pill row. Plan-import sub-filters still resolve
  // through `secondary` (they're a refinement of Imported).
  const cycleEntryKind = useCallback(() => {
    setSecondary((prev) => {
      // Any plan-import refinement counts as "Imported" for the cycle.
      const atImported = prev === "imported" || prev?.startsWith("plan-import:") === true;
      if (prev === null) return "saved";
      if (prev === "saved") return "imported";
      if (atImported) return null;
      return null;
    });
  }, []);
  const entryFilterIsSaved = secondary === "saved";
  const entryKindLabel =
    secondary === "saved"
      ? "Saved"
      : secondary === "imported" || secondary?.startsWith("plan-import:")
        ? "Imported"
        : "All";

  const importPlanPills = useMemo(
    () => planImportFilterLabels(savedRecipes.map((r) => r.sourceName)),
    [savedRecipes],
  );

  const filtered = useMemo(() => {
    let list = savedRecipes;
    if (search.trim()) {
      list = list.filter((r) =>
        recipeSearchMatch(
          {
            title: r.title,
            creatorName: r.creatorName,
            tags: r.mealSlots ?? null,
          },
          search,
        ),
      );
    }
    // Primary: category (Figma `527:2`). Shared predicate → web parity.
    if (category !== "all") {
      list = list.filter((r) => matchesRecipeCategory(category, r));
    }
    // Secondary: entry-kind (Saved/Imported) or plan-import source —
    // preserved per ENG-921.
    if (secondary) {
      if (secondary.startsWith("plan-import:")) {
        list = list.filter((r) => matchesPlanImportPill(secondary, r.sourceName));
      } else if (secondary === "saved" || secondary === "created" || secondary === "imported") {
        list = list.filter((r) => entryKindForCard(r, userId) === secondary);
      }
    }
    if (sortKey === "calories") {
      list = [...list].sort((a, b) => b.calories - a.calories);
    } else if (sortKey === "protein") {
      list = [...list].sort((a, b) => b.protein - a.protein);
    }
    return list;
  }, [savedRecipes, search, sortKey, category, secondary, userId]);

  const handleGoPublic = useCallback(
    async (item: RecipeCard) => {
      if (!userId || item.authorId !== userId) return;
      const result = await setRecipePublishedWithPrompt({
        recipeId: item.id,
        authorId: userId,
        published: true,
      });
      if (!result.ok) {
        if (result.cancelled) return;
        Alert.alert("Could not publish", result.message);
        return;
      }
      await refresh();
      Alert.alert("Recipe published", "Your recipe is now visible in Discover.");
    },
    [userId, refresh],
  );

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
   * Bookmark-overlay tap (Figma `527:2`). Removing a saved card is
   * destructive (it leaves your library), so SAVED → not-saved routes
   * through the existing two-step `confirmRemove` prompt — never a silent
   * one-tap removal. not-saved → saved is additive, so it persists
   * directly. The bookmark fill updates from the refreshed list, keeping
   * the icon honest (`composeLibraryEntries` F-7). Card long-press still
   * opens `confirmRemove` for power users.
   */
  const toggleCardSave = useCallback(
    (item: RecipeCard) => {
      if (item.isSaved) {
        confirmRemove(item);
        return;
      }
      void (async () => {
        await persistSaveToggle(item.id);
        await refresh();
      })();
    },
    [confirmRemove, persistSaveToggle, refresh],
  );

  // Aubergine-on-surface tokens (Sloe treatment system) — light uses the deep
  // `primarySolid` for outline borders / labels + the `primarySoft` tint for
  // selected pills; dark lifts both so the accent clears AA on the dark card.
  // ENG-1013 (2026-06-10): useAccent() already scheme-resolves these (light
  // primarySolid #3B2A4D / primarySoft tint → dark lifted aubergine), so read
  // them directly. The old `colors.background === "#FFFFFF"` probe silently
  // broke when the light ground moved off pure white to cream #FBF8F3 — it
  // returned the dark values in LIGHT mode. Dropping the probe fixes it.
  const accentInk = accent.primarySolid;
  const accentSoft = accent.primarySoft;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
      // Geometry: paddingHorizontal:12 (Spacing.sm+xs) + paddingVertical:8 +
      // minHeight:36 + lineHeight:18 — gives descenders ("g" in High-Protein,
      // "Q" in Quick) the headroom RN/iOS needs without the tails clipping at
      // the bottom border. `borderRadius:Radius.full` is the canonical fully-
      // round pill shape (matches Discover, search bar, and the DS §4 pill rule).
      // Previously 13 and 20 — both were off the canonical Spacing/Radius
      // ladders; snapped to on-scale values (2026-06-09 library spacing audit).
      // Chips census (2026-06-10): chips are NOT cards — the card-lift
      // shadow/liftBg spread is gone (a drop-shadowed filter pill read as
      // a floating button). §7 grammar: quiet off-white slab, hairline in
      // dark only, soft-tint when selected.
      paddingHorizontal: Spacing.dense,
      paddingVertical: Spacing.sm,
      minHeight: 36,
      borderRadius: Radius.full,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    // Category pill SELECTED — Sloe treatment §7: aubergine SOFT-TINT fill +
    // aubergine `primarySolid` label (not a solid accent slab). The selected
    // pill carries a faint tint of the accent; the rest stay quiet off-white.
    categoryPillActive: {
      backgroundColor: accentSoft,
      borderColor: accentSoft,
    },
    categoryPillTextActive: {
      color: accentInk,
      fontWeight: "700",
    },
    filterPillText: {
      // 12/18 — matches Discover's text scale (fontSize 12) but
      // with a bumped lineHeight 16 → 18 so descenders sit fully
      // inside the pill body instead of clipping at the border.
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    // ENG-921 polish (2026-06-07) / Figma `527:2` — the entry-kind buckets
    // (All / Saved / Imported) no longer occupy a second filter row. They
    // ride as a quiet text control on the count line, alongside sort +
    // create, so the surface reads as the calm Figma count ("N saved
    // recipes") with light trailing controls — never a competing pill row.
    countRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    countText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    countControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    quietControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,          // 4 — unchanged
      paddingHorizontal: Spacing.sm,  // 8 — was 10 (off-scale); snapped to sm
      paddingVertical: Spacing.xs,    // 4 — was 5 (off-scale); snapped to xs
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quietControlText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    // Quiet "+" create entry on the count line — aubergine OUTLINE (Sloe
    // treatment §1). This is a secondary create affordance, NOT the global FAB
    // (which keeps the one filled aubergine moment in the tab bar), so it reads
    // as an outline glyph button, not a filled slab.
    quietCreate: {
      width: 30,
      height: 30,
      borderRadius: Radius.full,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: accentInk,
      alignItems: "center",
      justifyContent: "center",
    },
    // Contextual plan-import source pills — revealed only when the
    // "Imported" segment is active (most users never import a plan, so
    // hiding them by default keeps the surface to ONE filter row). When
    // shown, they sit as a quiet tonal row directly under the category
    // row. Preserved per ENG-921 ("keep plan-import filtering reachable").
    planImportRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: Spacing.xl,
      paddingRight: Spacing.xl * 2,
      paddingBottom: Spacing.sm,
    },
    planImportPill: {
      // Chips census (2026-06-10): the sub-filter row joins the §7 chip
      // grammar — quiet card fill at rest, soft tint + solid label when
      // selected (was transparent + a text-colour ring).
      paddingHorizontal: Spacing.dense,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    planImportPillActive: {
      borderColor: accentSoft,
      backgroundColor: accentSoft,
    },
    planImportPillText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    planImportPillTextActive: {
      color: accentInk,
      fontWeight: "700",
    },
    // 2026-05-06 (Grace) — search-input wrapper that holds the
    // magnifying-glass icon next to the TextInput. Mirrors the
    // Discover treatment (icon-prefixed bigger search bar).
    searchInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,          // 8 — was 10 (off-scale); snapped to sm
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: Radius.xl,  // 12 — was 12 (correct value, now using token)
      borderWidth: cardElevation.useBorder ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md, // 16 — was 14 (off-scale); snapped to md
      paddingVertical: Spacing.md,   // 16 — was 14 (off-scale); snapped to md
      ...(cardElevation.shadowStyle ?? {}),
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
    // 2-column row gap (Figma `527:2`). `numColumns={2}` lays the cards
    // in rows; this spaces the two columns apart. Vertical gap between
    // rows comes from `list.gap`.
    columnWrap: {
      gap: Spacing.md,
    },
    // Soft elevation rides on `cardShadowWrap` (outer) because the card
    // clips its top image (`overflow: 'hidden'`), which would clip an iOS
    // shadow. Border/lift react to the flag via `useCardElevation()`.
    cardShadowWrap: {
      borderRadius: RECIPE_CARD_RADIUS,
      ...(cardElevation.shadowStyle ?? {}),
    },
    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: RECIPE_CARD_RADIUS,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.border,
      overflow: "hidden",
    },
    // 2-column grid (Figma `527:2`): each card fills half the row. The
    // FlatList sets `numColumns={2}` + a `columnWrapperStyle` gap; the
    // wrapper takes `flex: 1` so the two columns split evenly with the
    // gap between them.
    cardColumn: {
      flex: 1,
      borderRadius: RECIPE_CARD_RADIUS,
      ...(cardElevation.shadowStyle ?? {}),
    },
    // Figma `527:2`: full-bleed square-ish photo to the card's top corners.
    // Base fill is the warm card cream (`#F6F5F2`), NOT the lilac hairline
    // (`colors.border` = #E8E2EC) — the old lilac base was the "empty
    // pale-lilac box" that read as broken when an image was loading or
    // when the warm RecipeHeroFallback (sage→cream) settled over it.
    // §11.4: the fallback ground is sage→cream, never a lilac/grey block.
    cardImageWrap: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: colors.card,
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
    // Bookmark overlay (Figma `527:2`) — circular translucent-white pill
    // top-right of the photo, NOT the card-surface tier. White-on-photo
    // so it reads over any image; the only card overlay now (the `…`
    // overflow was removed).
    bookmarkDot: {
      position: "absolute",
      top: Spacing.sm,
      right: Spacing.sm,
      width: 32,
      height: 32,
      borderRadius: Radius.full,
      backgroundColor: "rgba(255,255,255,0.9)",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    cardBody: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: 4,
    },
    // Macro row beneath the title (recipes.md §3.1): kcal · protein ·
    // carbs · fat using the immutable MacroColors. Protein is emphasised
    // (slightly heavier digits) so the card reads as a tracker, not just
    // a recipe app. Tabular-nums for alignment across the 2-column grid.
    // No marginTop — cardBody gap: Spacing.xs (4) provides the rhythm
    // uniformly for title→macro→meta.
    macroRow: {},
    // Caption-scale value text passed into MacroIconRow.Chunk. Uses 12pt
    // (the caption ramp token per DS §2.2) instead of the legacy 11.5 /
    // inline-hardcoded 12 so all three macro rows (Library, Discover, Plan)
    // route through one canonical size. lineHeight 16 keeps the row
    // compact at card width.
    macroValue: {
      fontSize: 12,
      lineHeight: 16,
    },
    // Title — Newsreader serif (Figma `527:2`), parity with web
    // `var(--font-headline)`. Bumped Medium/15→SemiBold/16 (recipes.md §3.1
    // "editorial moment"; Julienne parity — the card title is the primary
    // hierarchy signal on the card and needs editorial weight at 16pt).
    cardTitle: {
      fontFamily: FontFamily.serifSemibold,
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: -0.1,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      // Removed marginTop:4 — cardBody gap:Spacing.xs carries all
      // title→macro→meta spacing uniformly on the 4pt grid.
      flexWrap: "wrap",
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    metaChunk: {
      fontSize: 12,
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    // Draft badge sits top-left of the photo. The old `+ 52` offset
    // cleared the kind badge that used to share the corner; that badge is
    // gone (Figma `527:2`), so the draft chip returns to the normal inset.
    draftBadge: {
      position: "absolute",
      top: Spacing.sm,
      left: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full, // tags census 2026-06-10 — tag family is round
      backgroundColor: colors.text + "CC",
    },
    draftBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.background,
    },
    // Inline "Go public" — LAYOUT-ONLY override for the ghost SupprButton
    // (2026-06-12 button system). The CTA colour/label come from the ghost
    // variant; this trims the CTA's default padding + left-aligns it so it reads
    // as an inline card chip, not a full-width CTA. The retired aubergine-
    // OUTLINE treatment (transparent ground + 1.5px accentInk border + label
    // colour) was removed — that grammar now lives in SupprButton variant="ghost".
    goPublicBtn: {
      marginTop: Spacing.sm,
      alignSelf: "flex-start",
      paddingHorizontal: Spacing.dense,
      paddingVertical: 8,
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
    // Figma S7 (`529:2`) — dashed cream slab.
    emptySlab: {
      marginTop: Spacing.lg,
      marginHorizontal: Spacing.lg,
      paddingVertical: 48,
      paddingHorizontal: 32,
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      alignItems: "center",
    },
    emptyBadge: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      backgroundColor: colors.ringTrack, // frost-mist #EDEAF1
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      fontFamily: "Newsreader_500Medium",
      fontSize: 20,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      maxWidth: 260,
      marginTop: 8,
      lineHeight: 21,
    },
    emptyActions: { marginTop: 24, gap: Spacing.dense, width: "100%", maxWidth: 280 },
    // Empty-state primary "Import a recipe" now renders via SupprButton
    // variant="primary" (2026-06-12 button system) — the old aubergine-OUTLINE
    // `ctaBtn`/`ctaBtnText` styles were removed. The grey-outline "Explore
    // Discover" (ctaBtnSecondary) sits below it as the quieter secondary,
    // keeping a clear emphasis ladder.
    ctaBtnSecondary: {
      paddingHorizontal: 24,
      paddingVertical: Spacing.dense,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    ctaBtnSecondaryText: { color: colors.text, fontWeight: "600", fontSize: 14 },
    // `accent` itself is no longer read inside this StyleSheet — the derived
    // `accentInk` / `accentSoft` (which depend on it) carry the aubergine
    // treatment, so they are the deps. JSX-level `accent.primary` uses (list
    // spinner, refresh tint, saved bookmark, star) live outside this memo.
  }), [colors, cardElevation, accentInk, accentSoft]);

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => {
      const totalTime = formatTotalTime(item);
      const savesCount = typeof item.savedCount === "number" ? item.savedCount : 0;
      const kind = entryKindForCard(item, userId);
      const showDraft = kind !== "saved" && item.isPublished === false;
      const showGoPublic = kind === "created" && item.isPublished === false;
      return (
        <View style={styles.cardColumn}>
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/recipe/${item.id}`)}
          // Long-press → confirm-remove flow (power-user shortcut). The
          // bookmark overlay is the primary save/remove affordance now
          // (the `…` overflow was removed per Figma `527:2`).
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
              fallbackBg={colors.card}
              fallbackTint={colors.textTertiary}
              recipeId={item.id}
              recipeTitle={item.title}
            />
            <View style={styles.cardGradient} pointerEvents="none" />
            {showDraft ? (
              <View style={styles.draftBadge} pointerEvents="none">
                <Text style={styles.draftBadgeText}>Draft</Text>
              </View>
            ) : null}
            {/* Bookmark overlay — Figma `527:2`: the ONLY card overlay
                (the `…` overflow was removed; long-press still opens the
                remove/actions sheet for power users). Tapping toggles the
                save without opening the recipe; filled clay when saved,
                outline when not (e.g. an imported recipe you authored but
                un-saved — bookmark stays honest per composeLibraryEntries). */}
            <Pressable
              style={styles.bookmarkDot}
              onPress={() => toggleCardSave(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.isSaved }}
              accessibilityLabel={item.isSaved ? `Saved: ${item.title}. Tap to remove` : `Save ${item.title}`}
              hitSlop={8}
            >
              <Bookmark
                size={15}
                color={item.isSaved ? accent.primary : colors.textSecondary}
                fill={item.isSaved ? accent.primary : "transparent"}
              />
            </Pressable>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {/* Macro row (recipes.md §3.1) — kcal · protein · carbs · fat
                in the immutable MacroColors, protein emphasised. Values come
                straight off the RecipeCard the list already loaded (real
                macros for seed + saved rows). kcal is suppressed at ≤0 so a
                recipe whose nutrition hasn't computed never shows a
                confident "0 kcal" (trust posture / F4). Letters are off here
                because the 2-column card is narrow; the macro hue + icon
                carry the meaning, and protein leads visually. Shared with
                Discover + web Library via MacroIconRow. */}
            <MacroIconRow
              kcal={item.calories > 0 ? item.calories : null}
              protein={item.protein}
              carbs={item.carbs}
              fat={item.fat}
              textColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
              showMacroLetters={false}
              emphasiseProtein
              proteinTextColor={colors.text}
              iconSize={11}
              style={styles.macroRow}
              textStyle={styles.macroValue}
            />
            {/* Meta row — Figma `527:2` shape `★ N · M min`. Every chip is
                REAL + degrades gracefully: `★` uses the honest saves count
                (savedCount — there is NO rating field, so we never
                fabricate a 4.8-style score); time uses prep+cook minutes;
                if neither exists, fall back to the serving count so the row
                never reads empty. */}
            <View style={[styles.metaRow, { gap: Spacing.sm }]}>
              {savesCount > 0 ? (
                <View style={styles.metaChip}>
                  <Star size={13} color={accent.primary} fill={accent.primary} />
                  <Text style={styles.metaChunk}>{savesCount}</Text>
                </View>
              ) : null}
              {savesCount > 0 && totalTime ? <Text style={styles.metaChunk}>·</Text> : null}
              {totalTime ? (
                <View style={styles.metaChip}>
                  <Clock size={12} color={colors.textSecondary} />
                  <Text style={styles.metaChunk}>{totalTime}</Text>
                </View>
              ) : null}
              {savesCount === 0 && !totalTime ? (
                <Text style={styles.metaChunk}>
                  {item.servings} {item.servings === 1 ? "serving" : "servings"}
                </Text>
              ) : null}
            </View>
            {showGoPublic ? (
              // Button system (2026-06-12): "Go public" is a secondary per-card
              // action → SupprButton variant="ghost" (transparent, no border,
              // plum label). Supersedes the old aubergine-OUTLINE goPublicBtn.
              // Web parity: src/app/components/Library.tsx "Go public" chip.
              // `goPublicBtn` layout style trims the CTA padding so it reads as
              // an inline card chip (left-aligned), not a full-width CTA.
              <SupprButton
                variant="ghost"
                label="Go public"
                style={styles.goPublicBtn}
                onPress={() => {
                  void handleGoPublic(item);
                }}
                accessibilityLabel={`Publish ${item.title} to Discover`}
              />
            ) : null}
            {/* GW-08 (audit 2026-04-28): TrustChip removed for the same
                reason as Discover hero — the source label was fabricated
                from `item.isVerified` (which is itself written by the
                importer as `(m?.calories ?? 0) > 0`). Restoring it
                requires real per-recipe match-source data, P1/P2 work. */}
          </View>
        </Pressable>
        </View>
      );
    },
    [router, confirmRemove, toggleCardSave, handleGoPublic, userId, colors, styles, accent],
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
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          // 2-column photo grid — Figma `527:2`. `key` is required so RN
          // re-mounts the list when numColumns is constant (defensive).
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accent.primary} />
          }
          ListHeaderComponent={
            <>
              {/* Search row — Figma `527:2` order: search sits above the
                  category pills. Create lives on the count row (the `+`) and
                  in the empty-state CTA (ENG-1197); the tab-bar FAB opens the
                  food Log sheet, NOT recipe creation. */}
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
              {/* Category filter pills — ENG-921 / Figma `527:2`.
                  Clay-fill active, line-border inactive. Web parity:
                  `src/app/components/Library.tsx`. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollStyle}
                contentContainerStyle={styles.filterScroll}
              >
                {LIBRARY_CATEGORY_PILLS.map((f) => {
                  const active = category === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      testID={`library-category-${f.id}`}
                      onPress={() => setCategory(f.id)}
                      style={[styles.filterPill, active && styles.categoryPillActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Category: ${f.label}`}
                    >
                      <Text
                        style={[styles.filterPillText, active && styles.categoryPillTextActive]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {/* Contextual plan-import source pills — ENG-921 polish
                  (2026-06-07). Plan imports are a refinement of
                  "Imported", so they only reveal when the Imported
                  segment is active AND the user actually has plan
                  imports. This keeps the default Library at a single
                  filter row (categories) while preserving plan-import
                  filtering reachability. */}
              {importPlanPills.length > 0 &&
              (secondary === "imported" || secondary?.startsWith("plan-import:")) ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScrollStyle}
                  contentContainerStyle={styles.planImportRow}
                >
                  {importPlanPills.map((label) => {
                    const id = planImportPillId(label);
                    const active = secondary === id;
                    const short = label.replace(/^Imported · /, "");
                    return (
                      <Pressable
                        key={id}
                        onPress={() => setSecondary(active ? "imported" : id)}
                        style={[styles.planImportPill, active && styles.planImportPillActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Filter imported plan: ${short}`}
                      >
                        <Text
                          style={[styles.planImportPillText, active && styles.planImportPillTextActive]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {short}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              {/* Count line + quiet controls — Figma `527:2` ("24 saved
                  recipes"). The calm count sits left; the saved-vs-imported
                  narrowing (entry-kind cycle), sort cycle, and Create ride
                  as quiet trailing controls so the distinction stays
                  reachable WITHOUT a second pill row. Web parity:
                  `src/app/components/Library.tsx`. */}
              {!(loading && savedRecipes.length === 0) ? (
                <View style={styles.countRow}>
                  <Text style={styles.countText}>
                    {entryFilterIsSaved
                      ? `${filtered.length} saved ${filtered.length === 1 ? "recipe" : "recipes"}`
                      : `${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"}`}
                  </Text>
                  <View style={styles.countControls}>
                    <Pressable
                      testID="library-entrykind-cycle"
                      onPress={cycleEntryKind}
                      style={styles.quietControl}
                      accessibilityRole="button"
                      accessibilityLabel={`Showing ${entryKindLabel.toLowerCase()} recipes, tap to change`}
                    >
                      <Text style={styles.quietControlText} maxFontSizeMultiplier={1.2}>
                        {entryKindLabel}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={openSortSheet}
                      style={styles.quietControl}
                      accessibilityRole="button"
                      accessibilityLabel={`Sort by ${SORT_LABELS[sortKey]}, tap to pick`}
                    >
                      <ArrowUpDown size={13} color={colors.textSecondary} />
                      <Text style={styles.quietControlText} maxFontSizeMultiplier={1.2}>
                        {SORT_LABELS[sortKey]}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="createBtn"
                      onPress={() => setCreateSheetOpen(true)}
                      style={styles.quietCreate}
                      accessibilityRole="button"
                      accessibilityLabel="Create a new recipe"
                      accessibilityHint="Opens a sheet with paste-link, photo, or manual entry options"
                    >
                      <Plus size={14} color={accentInk} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            search.trim() ? (
              <View style={styles.emptyContainer}>
                <SearchIcon size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>No results for &ldquo;{search.trim()}&rdquo;</Text>
              </View>
            ) : (
              // Figma S7 (`529:2`) — dashed cream slab, frost-mist icon
              // badge with plum bookmark, serif heading, stacked clay +
              // outline pill CTAs. Web parity: Library.tsx empty state.
              <View style={styles.emptySlab}>
                <View style={styles.emptyBadge}>
                  <Bookmark size={24} color={accent.primary} />
                </View>
                <Text style={styles.emptyTitle}>No saved recipes yet</Text>
                <Text style={styles.emptySubtext}>
                  Import from a Reel or TikTok, create your own, or browse Discover to start your collection.
                </Text>
                <View style={styles.emptyActions}>
                  {/* Button system (2026-06-12): the empty-library slab's ONE
                      primary action → SupprButton variant="primary" (solid
                      aubergine fill, white label, pill, no border/shadow).
                      Supersedes the old aubergine-OUTLINE ctaBtn. Web parity:
                      src/app/components/Library.tsx empty state. "Explore
                      Discover" stays the quieter grey-outline secondary below. */}
                  <SupprButton
                    variant="primary"
                    label="Import a recipe"
                    onPress={() => router.push("/import-shared")}
                  />
                  {/* ENG-1197 — restore the orphaned "create your own" entry:
                      the empty state must offer manual/photo create, not only
                      import. Routes straight to the /create-recipe form (text +
                      photo + barcode inline) — the same destination the count-
                      row + sheet reaches, one tap shorter. */}
                  <Pressable style={styles.ctaBtnSecondary} onPress={() => router.push("/create-recipe")}>
                    <Text style={styles.ctaBtnSecondaryText}>Create your own</Text>
                  </Pressable>
                  <Pressable style={styles.ctaBtnSecondary} onPress={() => router.push("/(tabs)/discover")}>
                    <Text style={styles.ctaBtnSecondaryText}>Explore Discover</Text>
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
