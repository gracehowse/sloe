import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ImageStyle, type StyleProp } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes } from "@/lib/recipes";
import { isFeatureEnabled } from "@/lib/analytics";
import { searchEdamam, type EdamamSearchResult } from "@/lib/verifyRecipe";
import { Search, Utensils, Bookmark, Link as LinkIcon, ChevronRight } from "lucide-react-native";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
import type { RecipeCard } from "@/lib/types";
import { useAuth } from "@/context/auth";
import { useLibrarySearchStore } from "@/hooks/useLibrarySearchStore";
import { supabase } from "@/lib/supabase";
import { computeRecipeFitPercent } from "@suppr/shared/nutrition/recipeFitPercent";
import { DISCOVER_POPULAR_MIN_SAVES } from "@suppr/shared/recipes/fetchPublicRecipeSaveCounts";
import {
  DISCOVER_CATEGORY_PILLS,
  matchesRecipeCategory,
  type RecipeCategoryId,
} from "@suppr/shared/recipes/recipeCategoryFilters";
import { recipeSearchMatch } from "@suppr/shared/recipes/recipeSearchMatch";
import { displayAttribution } from "@suppr/shared/recipes/displayAttribution";
import { recipeCardAccessibilityLabel } from "@suppr/shared/recipes/recipeCardAccessibilityLabel";
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` imports
// dropped — the Discover hero card no longer renders the chip because
// the underlying source signal is fabricated (see the comment by the
// hero card body for the full rationale).
import { RecipesTabChrome } from "@/components/tabs/RecipesTabChrome";
import { DiscoverLoadingSkeleton } from "@/components/discover/DiscoverLoadingSkeleton";

// ENG-921 (2026-06-07) — CATEGORY filter row per Figma `528:2`. The
// "Following" pill (B5 Phase 2c follow-graph feature) is preserved as a
// secondary feed-scope toggle that LEADS the row, then the shared
// category set follows. Web parity: `src/app/components/DiscoverFeed.tsx`.

/**
 * Sloe seamless recipe-card corner. The Figma recipe cards (`528:2`
 * Discover) sit at 20–24px; we use 24 to match the canonical Sloe
 * warm-slab corner already shared by the Today tiles (`CARD_RADIUS`/
 * `TILE_RADIUS = 24` on mobile, `var(--radius-card-lg)` on web) so every
 * cream slab reads with one corner language. The DS `Radius` ladder tops
 * out at 12 (`xl`), hence this local const. Web parity: `radius="lg"`
 * (24px) on the `SupprCard` in `DiscoverFeed.tsx` / `Library.tsx`.
 */
const RECIPE_CARD_RADIUS = CARD_RADIUS;

/* ── Icon Box (local helper matching prototype) ── */
function IconBox({ color, size = 28, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

// Fit-percent badge history:
//   - F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19) removed
//     the per-card `FitBadge` because `item.fit` was never populated
//     (always showed "Good"). Tester feedback: "score seems irrelevant".
//   - 2026-04-20 Grace design prototype port: re-added as a
//     primary-tinted `{N}%` pill top-right of the hero card body.
//     Value comes from the shared `computeRecipeFitPercent` helper so
//     web + mobile can't drift. Pinned by
//     `tests/unit/recipeCardFitBadge.test.ts`.

/* ── Source Badge ── */
function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <View style={{ position: "absolute", top: 8, left: 8, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: MODAL_OVERLAY_SCRIM }}>
      <Text style={{ ...Type.caption, color: Accent.primaryForeground }}>{source}</Text>
    </View>
  );
}

/** Row thumbnail: if `uri` 404s, show the same glyph box as missing image. */
function DiscoverCoverImage({
  uri,
  style,
  fallback,
}: {
  uri: string | null | undefined;
  style: StyleProp<ImageStyle>;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const trimmed = (uri ?? "").trim();
  if (!trimmed || broken) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: trimmed }}
      style={style}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={() => setBroken(true)}
    />
  );
}

/** Hero top: aspect ratio follows whether a remote image actually renders. */
function DiscoverHeroMedia({ item }: { item: RecipeCard }) {
  const [broken, setBroken] = useState(false);
  const trimmed = (item.image ?? "").trim();
  const showPhoto = trimmed.length > 0 && !broken;
  return (
    <View
      style={{
        aspectRatio: showPhoto ? 16 / 10 : 8,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showPhoto ? (
        <Image
          source={{ uri: trimmed }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setBroken(true)}
        />
      ) : (
        <RecipeHeroFallback id={item.id} title={item.title} />
      )}
      <SourceBadge source={item.source} />
    </View>
  );
}

export default function DiscoverScreen() {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  // Seamless recipe slab: soft plum lift off the page in light, tonal lift +
  // hairline in dark (RN renders shadows poorly on dark). Mirrors the Library
  // card so the two recipe surfaces stay in lockstep across schemes.
  const cardElevation = useCardElevation({ variant: "soft" });
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { recipes, loading, refresh } = useDiscoverRecipes();

  // ENG-700 — after publishing from Library / recipe detail, Discover
  // must refetch `published=true` rows when the user switches sub-tabs.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Shared with Library via `useLibrarySearchStore` so the query
  // survives tab switches (ENG-53, 2026-05-16). Variable names kept
  // so all downstream filter/search-debounce logic stays untouched.
  const { query: search, setQuery: setSearch } = useLibrarySearchStore();
  // ENG-921 — category (Figma `528:2`) + Following feed-scope toggle.
  const [category, setCategory] = useState<RecipeCategoryId | "trending" | "from-reels">("all");
  const [following, setFollowing] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // V10 (2026-05-11 visual sweep): the cold-load spinner could spin
  // for up to 35s (the hook's `DISCOVER_QUERY_TIMEOUT_MS`) before the
  // user saw any feedback. Show a "Taking longer than expected" hint
  // after 5s so the user knows something's actually happening and has
  // a tap-to-retry escape. Mirrors the F-114 stuck-spinner pattern.
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlowLoad(false);
      return;
    }
    const t = setTimeout(() => setSlowLoad(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  // B5 Phase 2c (2026-04-27) — set of creator_ids the current user
  // follows. Used by the "Following" filter pill to hide recipes that
  // aren't from a followed creator. Refreshes whenever the user signs
  // in / out, and on every tab focus so a follow performed on a recipe
  // detail screen (which doesn't unmount Discover) is reflected the
  // moment the user returns to the Discover tab.
  //
  // Journey-architect 2026-04-27 Top Broken Journey #4 — pre-fix this
  // was `useEffect([userId])` which ran once per mount; following a
  // creator from the recipe detail screen left the Following filter
  // empty until app restart. Pinned by `discoverFollowsFocusRefresh.test.ts`.
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(new Set());
  const [followedAuthorIds, setFollowedAuthorIds] = useState<Set<string>>(new Set());
  // D1 fix (audit 2026-04-28): mobile previously only loaded
  // `follows.creator_id`. Web's Following filter also matches
  // `author_follows.author_id`. Same UI on both platforms returned
  // different result sets — silent data divergence. Mobile now loads
  // both tables and matches on either ID, mirroring web `DiscoverFeed`.
  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setFollowedCreatorIds(new Set());
        setFollowedAuthorIds(new Set());
        return;
      }
      let cancelled = false;
      (async () => {
        const [cf, af] = await Promise.all([
          supabase.from("follows").select("creator_id").eq("user_id", userId),
          supabase.from("author_follows").select("author_id").eq("follower_id", userId),
        ]);
        if (cancelled) return;
        const creators = new Set<string>();
        if (Array.isArray(cf.data)) {
          for (const row of cf.data) {
            const id = (row as { creator_id?: string | null }).creator_id;
            if (typeof id === "string") creators.add(id);
          }
        }
        const authors = new Set<string>();
        if (Array.isArray(af.data)) {
          for (const row of af.data) {
            const id = (row as { author_id?: string | null }).author_id;
            if (typeof id === "string") authors.add(id);
          }
        }
        setFollowedCreatorIds(creators);
        setFollowedAuthorIds(authors);
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  // 2026-04-20 prototype port — per-card fit-percent pill needs the
  // user's daily macro targets. We pull once per mount; failure or
  // signed-out state leaves `targets` null and the shared helper falls
  // back to its neutral anchor so every card still renders a pill.
  const [targets, setTargets] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setTargets(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const tc = Number((data as any).target_calories);
      const tp = Number((data as any).target_protein);
      const tcb = Number((data as any).target_carbs);
      const tf = Number((data as any).target_fat);
      if ([tc, tp, tcb, tf].every((n) => Number.isFinite(n) && n > 0)) {
        setTargets({ calories: tc, protein: tp, carbs: tcb, fat: tf });
      } else {
        setTargets(null);
      }
    })().catch(() => {
      if (!cancelled) setTargets(null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Eating-out row — Edamam restaurant + branded results, surfaced when
  // the user has typed a search query. TestFlight `AOI9xgY88Dx-uphiXI8IzEk`
  // (2026-04-18). Debounced 350ms so each keystroke doesn't burn quota.
  const [eatingOut, setEatingOut] = useState<EdamamSearchResult[]>([]);
  const [eatingOutLoading, setEatingOutLoading] = useState(false);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) {
      setEatingOut([]);
      setEatingOutLoading(false);
      return;
    }
    let cancelled = false;
    setEatingOutLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchEdamam(q, { mode: "meals" });
      if (!cancelled) {
        setEatingOut(hits.slice(0, 12));
        setEatingOutLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setEatingOutLoading(false);
    };
  }, [search]);

  /**
   * Instagram → Copy link or share often leaves the URL on the pasteboard; read on Discover focus.
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
        Alert.alert(
          "Import recipe?",
          "We noticed a recipe link on your clipboard. Would you like to import it?",
          [
            { text: "No thanks", style: "cancel" },
            { text: "Import", onPress: () => router.push({ pathname: "/import-shared", params: { url } }) },
          ],
        );
      }, 900);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [router]),
  );

  const filtered = recipes.filter((r) => {
    // Search filter — tokenized AND match across title + description +
    // creator + source. Pre-fix this was `title.includes(search)`, which
    // required the exact substring; "wasabi katsu curry" failed when the
    // title was "Katsu Curry by Wasabi" (tokens not contiguous).
    if (
      search.trim() &&
      !recipeSearchMatch(
        {
          title: r.title,
          description: (r as { description?: string | null }).description ?? null,
          creatorName: r.creatorName ?? null,
          source: r.source ?? null,
        },
        search,
      )
    ) {
      return false;
    }
    // Following feed scope (B5 Phase 2c follow-graph) — match creatorId
    // OR authorId against the user's follow set. Mirrors web.
    if (following) {
      const cid = r.creatorId ?? null;
      const aid = (r as { authorId?: string | null }).authorId ?? null;
      if (cid && followedCreatorIds.has(cid)) return true;
      if (aid && followedAuthorIds.has(aid)) return true;
      return false;
    }
    // Category filter (Figma `528:2`). Trending / From Reels are
    // Discover-only signals; everything else routes through the shared
    // predicate (web ↔ mobile parity).
    if (category === "all") return true;
    if (category === "trending") return (r.saves ?? r.savedCount ?? 0) >= DISCOVER_POPULAR_MIN_SAVES;
    if (category === "from-reels") {
      const sp = (r as { sourcePlatform?: string | null; source?: string | null }).sourcePlatform
        ?? (r as { source?: string | null }).source ?? null;
      const s = String(sp ?? "").toLowerCase();
      return s.includes("instagram") || s.includes("tiktok") || s.includes("youtube");
    }
    return matchesRecipeCategory(category, r);
  });

  const t = {
    accent: accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

  // Aubergine-on-surface tokens (Sloe treatment system) — selected filter
  // pills get a SOFT TINT fill + aubergine `primarySolid` label, NOT a solid
  // accent slab (treatment §7). Light/dark aware so the accent clears AA on the
  // dark card.
  // ENG-1013 (2026-06-10): useAccent() already scheme-resolves these (light
  // primarySolid #3B2A4D / primarySoft tint → dark lifted aubergine), so read
  // them directly. The old `colors.background === "#FFFFFF"` probe silently
  // broke when the light ground moved off pure white to cream #FBF8F3 — it
  // returned the dark values in LIGHT mode. Dropping the probe fixes it.
  const accentInk = accent.primarySolid;
  const accentSoft = accent.primarySoft;

  // ENG-1087 — the import-from-Reel card is the viral-hook acquisition surface;
  // promote it from a settings-row slab to a hero affordance (stronger tint,
  // solid plum icon, "Paste link" pill). Flag-gated; the legacy nav row stays
  // in the `else` as the kill switch.
  const importHero = isFeatureEnabled("discover_import_hero_v1");

  // F-11: fit badge removed. Hero gradient now uses a single neutral
  // accent — the previous per-recipe colour came from the dropped
  // fit score and read as decorative noise.
  const heroColor = t.accent;

  // ── Hero card — "Matches your day" section. Full-width, 16:10 image
  // on top (rounded only at card corners via parent overflow:hidden),
  // title / source / kcal·protein·time metadata row underneath, with a
  // primary-tinted fit-percent pill top-right of the card body
  // (2026-04-20 Grace design prototype port). */
  const renderHeroCard = useCallback(
    (item: RecipeCard) => {
      const kcal = Math.round(item.calories);
      const protein = Math.round(item.protein);
      const carbs = Math.round(item.carbs);
      const fat = Math.round(item.fat);
      // F-45: fitPct no longer rendered, but keep the computation
      // shape intact for future ranking.
      void computeRecipeFitPercent;
      void targets;
      return (
        // Sloe Figma `528:2` seamless recipe slab: a `#F6F5F2` cream card
        // lifted off the `#FFFFFF` page by a SOFT plum drop shadow (NOT a
        // 1pt border — that read as the "double-frame" box; Grace 2026-06-07),
        // 24px radius, image full-bleed to the top corners. The shadow rides
        // an OUTER wrapper because the inner Pressable clips the image with
        // `overflow: 'hidden'`, and RN clips iOS shadows on clipping views.
        // Light → soft shadow, no border; dark → tonal lift + hairline (via
        // `cardElevation`) so the card never blends in either scheme.
        <View key={item.id} style={{ borderRadius: RECIPE_CARD_RADIUS, ...(cardElevation.shadowStyle ?? {}) }}>
        <PressableScale
          haptic="confirm"
          onPress={() => router.push(`/recipe/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={recipeCardAccessibilityLabel({
            title: decodeEntities(item.title),
            calories: kcal,
            protein,
            carbs,
            fat,
            cookTime: item.cookTime ?? null,
          })}
          style={{
            borderRadius: RECIPE_CARD_RADIUS,
            backgroundColor: cardElevation.liftBg ?? colors.card,
            borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
            borderColor: colors.cardBorder,
            overflow: "hidden",
          }}
        >
          {/* P1-19 (2026-04-25 ui-critic): when image is missing, the
              16:10 gradient+glyph fallback dominated the card and made
              every image-less recipe look broken. Image-bearing rows
              keep the full hero; image-less rows collapse to a thin
              category band (8:1) that signals bucket without taking
              over the card. Title + macros below carry the visual
              weight in the no-image case.
              2026-05-03 — failed remote URLs use the same fallback and
              collapse aspect ratio via `DiscoverHeroMedia`. */}
          <DiscoverHeroMedia item={item} />
          {/* Gap-3 fix (2026-06-09): card body padding 14 → Spacing.md (16) — on-scale. */}
          <View style={{ padding: Spacing.md }}>
            {/* Fit-percent pill — primary-tinted, top-right of the
                card body. Matches prototype treatment. */}
            {/* F-45 (2026-04-22): fit-percent pill removed per repeated
                tester feedback ("Score means nothing — remove"). The
                value was being computed (see `fitPct`) but was not
                anchored to a target the user had chosen or surfaced
                otherwise, so it read as decorative noise. Keeping the
                computation available via `computeRecipeFitPercent` in
                case a future ranking pass wants it. */}
            {/* Gap-1 fix (2026-06-09): recipe titles ALWAYS Newsreader serif per
                design-system §2.3 rule 2. Was `{ ...Type.body, fontWeight: '700' }`
                (Inter 14pt bold). Now `Type.headline` (Newsreader_500Medium 17pt)
                + fontWeight '600' for card-scale legibility. */}
            <Text
              style={{ ...Type.headline, fontWeight: '600', color: colors.text, paddingRight: 48 }}
              numberOfLines={2}
            >
              {decodeEntities(item.title)}
            </Text>
            {/* B5-2a-followup (2026-04-27) — when the recipe has a curated
                creator_id, the byline becomes a tappable deeplink to the
                creator profile page. Native Pressable wraps the same
                Text so the visual treatment is unchanged; non-curated
                rows render as plain Text (no creatorId → no link). */}
            {item.creatorId ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push(`/creator/${item.creatorId}`);
                }}
                hitSlop={6}
                style={{ marginTop: 4 }}
              >
                <Text
                  style={{ ...Type.caption, color: colors.textSecondary, textDecorationLine: "underline" }}
                  numberOfLines={1}
                >
                  {displayAttribution({ creatorName: item.creatorName, source: item.source })}
                </Text>
              </Pressable>
            ) : (
              <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>
                {displayAttribution({ creatorName: item.creatorName, source: item.source })}
              </Text>
            )}
            {/* MacroIconRow — shared with Library + Today (2026-05-22
                consolidation per Grace: "everything in library and
                discover should display like this"). Was 60 lines of
                inline duplicate; component owns the icon/colour/letter
                grammar so any palette token shift cascades cleanly. */}
            {/* Gap-3 fix (2026-06-09): marginTop 10 → Spacing.sm (8) — on-scale.
                Gap-6 fix: iconSize bumped 11→13 + emphasiseProtein active so protein
                reads unmistakably heavier at card scale. `proteinTextColor` = full
                ink (`colors.text`) vs secondary for all other macros. */}
            <MacroIconRow
              kcal={kcal > 0 ? kcal : null}
              protein={protein}
              carbs={carbs}
              fat={fat}
              fiber={item.fiberG}
              cookTime={item.cookTime}
              textColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
              emphasiseProtein
              proteinTextColor={colors.text}
              iconSize={13}
              style={{ marginTop: Spacing.sm }}
            />
            {/* GW-08 (audit 2026-04-28): pre-fix this card rendered a
                TrustChip whose source was fabricated from `item.isVerified`
                via the recipe-trust helper. That bool is set by the
                importer at `apps/mobile/lib/saveImportedRecipe.ts:210`
                as `is_verified: m?.calories > 0` — true whenever the
                LLM extracted any non-zero calorie value. The chip
                therefore claimed "USDA verified" on recipes whose
                macros came from the LLM. Removed until per-recipe
                match quality is computed end-to-end from a real source
                column (P1/P2 work in the GW-08 audit). */}
          </View>
        </PressableScale>
        </View>
      );
    },
    [router, colors, heroColor, t.accent, targets, cardElevation],
  );

  // 2026-05-03 — mobile Discover uses one layout for every filter:
  // stacked hero cards ("Matches your day" + "More ideas"). Web still
  // shows cuisine cluster carousels on the default "For You" view
  // (`DiscoverFeed.tsx`); mobile dropped the carousel branch so
  // switching pills does not swap between two different IA patterns.

  // ── Compact list row — "More ideas" section. 40×40 icon-box on the
  // left, title + source·time in the middle, trailing kcal / P / C.
  // Each row after the first gets a top-border so the parent card
  // renders a divider sequence. */
  const renderMoreIdeaRow = useCallback(
    (item: RecipeCard, idx: number) => {
      const kcal = Math.round(item.calories);
      const protein = Math.round(item.protein);
      const carbs = Math.round(item.carbs);
      return (
        <Pressable
          key={item.id}
          onPress={() => router.push(`/recipe/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={recipeCardAccessibilityLabel({
            title: decodeEntities(item.title),
            calories: kcal,
            protein,
            carbs,
            cookTime: item.cookTime ?? null,
          })}
          style={{
            flexDirection: "row",
            alignItems: "center",
            // Gap-3 fix (2026-06-09): row gap 12 → Spacing.md (16) — on-scale.
            gap: Spacing.md,
            // Gap-3 fix: row padding 12 → Spacing.md (16) — on-scale.
            padding: Spacing.md,
            borderTopWidth: idx > 0 ? 1 : 0,
            borderTopColor: colors.cardBorder,
          }}
        >
          {/* F-55 (2026-04-22): use real thumbnail when the recipe has
              an image_url (social-feed parity — tester flagged "the
              more you might like is wrong - this is supposed to be
              like a social media feed").
              2026-06-08 (§11.4): image-less / broken rows now fall back
              to the warm sage→cream RecipeHeroFallback (same calm tile as
              the hero card + Library), not a flat inputBg chef-hat box —
              so the row never reads as an empty grey/lilac thumbnail. */}
          <DiscoverCoverImage
            uri={item.image}
            style={{ width: 56, height: 56, borderRadius: 10 }}
            fallback={
              <View style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: colors.card }}>
                <RecipeHeroFallback id={item.id} title={item.title} iconSize={20} />
              </View>
            }
          />
          <View style={{ flex: 1 }}>
            {/* Gap-1 fix (2026-06-09): recipe names ALWAYS Newsreader serif per
                design-system §2.3 rule 2. Was Type.body (Inter 14pt). */}
            <Text style={{ ...Type.headline, fontWeight: '600', color: colors.text }} numberOfLines={1}>
              {decodeEntities(item.title)}
            </Text>
            <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
              {displayAttribution({ creatorName: item.creatorName, source: item.source })}
              {item.cookTime ? ` · ${item.cookTime}` : ""}
            </Text>
          </View>
          <Text style={{ ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>{kcal}</Text>
            {` · ${protein}P · ${carbs}C`}
          </Text>
        </Pressable>
      );
    },
    [router, colors],
  );

  return (
    <View
      testID="screen-discover"
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
    >
      <RecipesTabChrome />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={accent.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Search bar — title + Library/Discover tabs live in RecipesTabChrome.
            Gap-3 fix (2026-06-09): paddingHorizontal/paddingVertical 14 → Spacing.md
            (16); marginBottom 14 → Spacing.md (16); borderRadius 12 → Radius.xl (12)
            — Radius.xl is the on-scale token for this size. gap 10 → Spacing.sm (8). */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderRadius: Radius.xl,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: Spacing.md,
        }}>
          <Search size={16} color={colors.textTertiary} />
          <TextInput
            ref={searchInputRef}
            value={search}
            onChangeText={setSearch}
            // GW-05 (audit 2026-04-28): pre-fix this read "Search
            // 48,000+ recipes & foods" — that's an aspirational catalog
            // size, not the real one. The community feed is a few
            // hundred rows; the Edamam "eating out" pool kicks in at 3+
            // characters and adds restaurant items, but it's not part
            // of the recipe count. Honest copy until we either ship a
            // real catalog count or explicitly pivot the placeholder
            // to talk about Edamam.
            placeholder="Search recipes"
            placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, fontSize: 14, color: colors.text, padding: 0 }}
          />
        </View>

        {/* Filter pills.
            Audit 2026-05-04 #27: previously the row's last pill ("High
            Protein") got clipped mid-word by the viewport edge with no
            scroll cue — read as a broken truncation rather than a
            scrollable row. `paddingRight` past the viewport gives the
            user explicit "more pills off the right" affordance, and
            `numberOfLines={1}` prevents any single pill text from
            wrapping to two lines on narrow devices. */}
        {/* 2026-05-06 (Grace) — canonical filter-pill geometry shared
            with Library: paddingHorizontal:13 + paddingVertical:8 +
            minHeight:36 + lineHeight:18 so descenders ("Q" in Quick,
            "g" in High-Protein) sit fully inside the pill body
            instead of clipping at the bottom border. paddingRight:32
            on the contentContainer keeps the trailing pill from
            sitting flush against the screen edge. */}
        {/* Category filter pills — ENG-921 / Figma `528:2`. Aubergine SOFT-TINT
            active (treatment §7), line-border inactive. "Following" leads as a
            secondary feed-scope toggle. Web parity: DiscoverFeed.tsx.
            Gap-3 fix (2026-06-09): pill ScrollView marginBottom 12 → Spacing.sm (8).
            paddingHorizontal: 13 is intentional for descender clearance ("Q" in
            Quick, "g" in High-Protein) — kept as a chip-specific carve-out, not
            drift. Documented here so it never reads as an untracked gap.
            Gap-5 fix: pill label upgraded from Type.caption (11pt) to Type.body
            (14pt Inter Medium) so filter pills read as deliberate controls. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: Spacing.sm }}
          contentContainerStyle={{ gap: Spacing.sm, paddingRight: 32, alignItems: "center" }}
        >
          <Pressable
            key="following"
            testID="discover-category-following"
            onPress={() => {
              setFollowing(true);
              setCategory("all");
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: following }}
            style={{
              paddingHorizontal: Spacing.dense,
              paddingVertical: 8,
              minHeight: 36,
              // Chips census (2026-06-13, ENG-1082): §7 grammar = the soft
              // tint IS the only selection signal — NO ring. Rest is a quiet
              // card slab on the cream ground; selected is `accentSoft` fill +
              // `accentInk` label. The pre-fix unconditional hairline put a
              // light-mode ring on Discover chips that the identical Library
              // row (`library.tsx` `filterPill`) does NOT carry — the drift
              // this pass converges. Border is now gated through
              // `cardElevation.useBorder` (dead → flat-card decision) so the
              // two rows render byte-identical: flat in light, fill-only in
              // dark. Selected border == fill so it never reads as a ring.
              borderRadius: Radius.full,
              borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
              borderColor: following ? accentSoft : colors.cardBorder,
              backgroundColor: following ? accentSoft : colors.card,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              numberOfLines={1}
              style={{ ...Type.body, fontWeight: "600", color: following ? accentInk : colors.textSecondary }}
            >
              Following
            </Text>
          </Pressable>
          {DISCOVER_CATEGORY_PILLS.map((f) => {
            const active = !following && category === f.id;
            return (
              <Pressable
                key={f.id}
                testID={`discover-category-${f.id}`}
                onPress={() => {
                  setFollowing(false);
                  setCategory(f.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Category: ${f.label}`}
                style={{
                  paddingHorizontal: Spacing.dense,
                  paddingVertical: 8,
                  minHeight: 36,
                  // Chips census (2026-06-13, ENG-1082): see the Following pill
                  // above — border gated through `cardElevation.useBorder` so
                  // the rest chip carries no light-mode ring (§7 "tint is the
                  // signal"), matching Library's identical row exactly.
                  borderRadius: Radius.full,
                  borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
                  borderColor: active ? accentSoft : colors.cardBorder,
                  backgroundColor: active ? accentSoft : colors.card,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ ...Type.body, fontWeight: "600", color: active ? accentInk : colors.textSecondary }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* DEFERRED — Figma-only builds (not built this pass, per the
            Recipes Figma-parity brief):
              · "Popular collections" carousel (Figma `528:61`) — ENG-907
              · "Recipes in action" Reels rail (Figma `528:105`) — ENG-908
            No wired data source yet (curated collections + short-form
            video); tracked as net-new builds. See
            `docs/ux/redesign/figma-migration-tracker.md`. */}

        {/* Eating out — Edamam restaurant + branded meals. Only renders
            when the user has typed at least 3 characters; collapsed
            when no hits so we don't waste vertical space. TestFlight
            `AOI9xgY88Dx-uphiXI8IzEk` (2026-04-18). */}
        {/* Gap-3 fix (2026-06-09): eating-out section marginBottom 14 → Spacing.md (16);
            header row marginBottom 6 → Spacing.xs (4) — nearest on-scale. */}
        {(eatingOutLoading || eatingOut.length > 0) && (
          <View style={{ marginBottom: Spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.xs }}>
              <Text style={{ ...Type.label, color: colors.textSecondary }}>
                Eating out
              </Text>
              {eatingOutLoading ? (
                <Text style={{ ...Type.caption, color: colors.textTertiary }}>Searching…</Text>
              ) : (
                <Text style={{ ...Type.caption, color: colors.textTertiary }}>
                  {eatingOut.length} restaurant {eatingOut.length === 1 ? "match" : "matches"}
                </Text>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {eatingOut.map((m) => (
                <Pressable
                  key={m.foodId}
                  // D3 fix (audit 2026-04-28): mobile previously
                  // pushed `?search=m.label` into the Today route
                  // params; web navigated to Today with no context.
                  // Mobile's params were never read by the Today
                  // screen — both platforms silently dropped the
                  // food context, but the divergent shapes implied
                  // different behaviour. Aligned both to a plain
                  // navigation; deep-link-with-prefilled-search is a
                  // future improvement that needs FoodSearchModal
                  // wiring on both sides.
                  onPress={() => router.push("/(tabs)" as any)}
                  style={{
                    width: 160,
                    // Gap-3 fix (2026-06-09): card padding 10 → Spacing.sm (8).
                    padding: Spacing.sm,
                    borderRadius: CARD_RADIUS,
                    backgroundColor: colors.card,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.cardBorder,
                  }}
                >
                  {m.brand ? (
                    <Text style={{ ...Type.label, color: t.accent, marginBottom: 2 }} numberOfLines={1}>
                      {m.brand.toUpperCase()}
                    </Text>
                  ) : null}
                  {/* Gap-3 fix (2026-06-09): marginBottom 6 → Spacing.xs (4). */}
                  <Text style={{ ...Type.caption, fontWeight: '600', color: colors.text, marginBottom: Spacing.xs }} numberOfLines={2}>
                    {m.label}
                  </Text>
                  <Text style={{ ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p
                  </Text>
                  <Text style={{ ...Type.caption, color: colors.textTertiary, marginTop: Spacing.xs }}>per 100 g</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 2026-05-12 (premium-bar audit, DC13 + refuse-to-pass #8):
            promote "Import from a link" to a permanent first card
            above the discovery feed so the import affordance is the
            first thing the user sees on Discover, not buried beneath
            recipe rows. Mirrors Recime's import-link pattern. testID
            preserved for the Maestro 25_import_shared flow. */}
        {importHero ? (
          // ENG-1087 — hero affordance. Keeps the tinted-slab grammar (flat-card
          // law) but raises the weight so the viral-hook import beats a settings
          // row: stronger ~20% tint, a SOLID plum icon circle (white glyph), a
          // serif headline title, and a filled "Paste link" pill in place of the
          // passive chevron (do-it-here, not navigate). The whole slab is the tap
          // target → the import/paste screen; the pill is the affordance, not a
          // nested pressable.
          <Pressable
            onPress={() => router.push("/import-shared" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Import from TikTok, Instagram, YouTube or a website"
            testID="discover-import-cta"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.md,
              padding: Spacing.md,
              borderRadius: CARD_RADIUS,
              // ENG-1094 (Grace): a confident lavender-plum accent — Discover's
              // one deliberate accent — instead of the muddy flat ~20%
              // `primarySoftStrong` wash that read as grey.
              backgroundColor: colors.importHeroBg,
              marginBottom: Spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.full,
                backgroundColor: accent.primarySolid,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinkIcon size={20} color={Accent.primaryForeground} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ ...Type.headline, color: colors.navPrimary }}>Import from TikTok, Instagram & YouTube</Text>
              <Text style={{ ...Type.caption, color: colors.textSecondary }}>Paste a link or share from any app</Text>
            </View>
            <View
              style={{
                paddingHorizontal: Spacing.dense,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.full,
                backgroundColor: accent.primarySolid,
              }}
            >
              <Text style={{ ...Type.caption, fontWeight: "600", color: Accent.primaryForeground }}>Paste link</Text>
            </View>
          </Pressable>
        ) : (
          /* Legacy nav-row slab (flag-off / kill switch). 2026-05-12 premium-bar
             audit DC13 + ENG-1082: a DELIBERATE soft-tint affordance, NOT a
             white recipe card, so it stands apart from the white feed cards
             (Sloe treatment §10). testID preserved for the Maestro
             25_import_shared flow. */
          <Pressable
            onPress={() => router.push("/import-shared" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Import from TikTok, Instagram, YouTube or a website"
            testID="discover-import-cta"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.md,
              padding: Spacing.md,
              borderRadius: CARD_RADIUS,
              backgroundColor: accent.primarySoft,
              marginBottom: Spacing.md,
            }}
          >
            <IconBox color={t.accent} size={36}>
              <LinkIcon size={18} color={t.accent} />
            </IconBox>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Type.body, fontWeight: '600', color: colors.text }}>Import from TikTok, Instagram & YouTube</Text>
              <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }}>Paste a link or share from any app</Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* ── Prototype port (2026-04-20, screens-mobile.jsx
            `DiscoverScreen` lines 345–438): three stacked sections.

              1. "Matches your day" — 2 hero cards from `filtered.slice(0, 2)`.
              2. "More ideas" — single card containing compact meal-row list
                 for `filtered.slice(2)`.
              3. "My Library" — bottom rail for jumping to saved recipes.

            When `filtered` is empty we skip sections 1 + 2 and render
            the existing "No recipes yet" empty state. The library
            jump-card still renders so users can pivot to saved.

            F-11 reversed 2026-04-20: fit-percent badge is back per
            Grace's prototype screenshot — primary-tinted `{N}%` pill
            top-right of the hero card body, value from the shared
            `computeRecipeFitPercent` helper. Pinned by
            `tests/unit/recipeCardFitBadge.test.ts`. Web parity:
            `src/app/components/DiscoverFeed.tsx`. */}

        {loading && filtered.length === 0 ? (
          <View style={{ paddingTop: Spacing.md }}>
            {/* Gap-2 fix (2026-06-09): "Recipe ideas" loading-state header
                Type.headline → Type.title (24pt Newsreader serif) for
                section-divider weight per recipes.md §0 / design-system §2.2.
                headers census 2026-06-10: ink colors.text → navPrimary (in-scroll
                section headers match Today's navPrimary, not text). */}
            <Text
              style={{
                ...Type.title,
                color: colors.navPrimary,
                marginBottom: Spacing.sm,
              }}
            >
              Recipe ideas
            </Text>
            <DiscoverLoadingSkeleton />
            {slowLoad ? (
              <View style={{ alignItems: "center", marginTop: Spacing.lg, paddingHorizontal: Spacing.lg }}>
                <Text
                  style={{
                    ...Type.caption,
                    color: colors.textTertiary,
                    textAlign: "center",
                    maxWidth: 280,
                    lineHeight: 17,
                  }}
                >
                  Taking longer than usual. Check your connection if this hangs.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading recipes"
                  onPress={() => void refresh()}
                  style={({ pressed }) => ({
                    marginTop: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 8,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: accent.primary,
                    backgroundColor: accent.primary + "10",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ ...Type.caption, fontWeight: '600', color: accent.primary }}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingTop: 60, paddingBottom: 20, alignItems: "center", gap: 8 }}>
            {search.trim() ? (
              <Search size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
            ) : (
              <Utensils size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
            )}
            <Text style={{ ...Type.headline, color: colors.text }}>
              {search.trim() ? `No results for "${search.trim()}"` : "No recipes yet"}
            </Text>
            <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
              {search.trim() ? "Try a different search term." : "Pull down to refresh, or check your connection."}
            </Text>
          </View>
        ) : (
          <>
            {/* 2026-05-22 evening (Grace): editorial hero (overlay
                title on top of full-bleed image) replaced with the
                same MacroIconRow card style as the rest of the feed —
                "everything should be like the bottom one". Single
                consistent grammar across the whole Discover stream;
                no special-case treatment for the first card. */}
            {/* Gap-2 fix (2026-06-09): section headers Type.headline → Type.title
                (24pt Newsreader serif) for editorial section-divider weight.
                headers census 2026-06-10: ink colors.text → navPrimary. */}
            <Text
              style={{
                ...Type.title,
                color: colors.navPrimary,
                marginBottom: Spacing.sm,
              }}
            >
              Recipe ideas
            </Text>
            {/* Gap-3 fix (2026-06-09): hero-card vertical gap 12 → Spacing.md (16). */}
            <View style={{ gap: Spacing.md }}>
              {filtered.slice(0, 3).map((r) => renderHeroCard(r))}
            </View>

            {filtered.length > 3 ? (
              <>
                {/* Gap-2 fix (2026-06-09): "More ideas" header Type.headline → Type.title.
                    headers census 2026-06-10: ink colors.text → navPrimary. */}
                <Text
                  style={{
                    ...Type.title,
                    color: colors.navPrimary,
                    marginTop: Spacing.xl,
                    marginBottom: Spacing.sm,
                  }}
                >
                  More ideas
                </Text>
                {/* "More ideas" list slab — same seamless cream card as the
                    hero cards (24px radius, soft plum lift in light, tonal
                    lift + hairline in dark, no light-mode border). The shadow
                    rides an outer wrapper because the inner View clips its row
                    dividers with `overflow: 'hidden'`. */}
                <View style={{ borderRadius: RECIPE_CARD_RADIUS, ...(cardElevation.shadowStyle ?? {}) }}>
                  <View
                    style={{
                      borderRadius: RECIPE_CARD_RADIUS,
                      backgroundColor: cardElevation.liftBg ?? colors.card,
                      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
                      borderColor: colors.cardBorder,
                      overflow: "hidden",
                    }}
                  >
                    {filtered.slice(3).map((r, idx) => renderMoreIdeaRow(r, idx))}
                  </View>
                </View>
              </>
            ) : null}
          </>
        )}

        {/* Bottom rail — jump-card to My Library. Import card moved
            up to be the permanent first card above the discovery
            sections (2026-05-12 audit). Always renders so users can
            navigate to their saved recipes from the discovery feed
            even when the feed is empty. */}
        {/* Gap-2 fix (2026-06-09): "My Library" header Type.headline → Type.title.
            headers census 2026-06-10: ink colors.text → navPrimary. */}
        <Text style={{ ...Type.title, color: colors.navPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm }}>
          My Library
        </Text>

        {/* My Library CTA — Gap-3 fix (2026-06-09): gap 12 → Spacing.md (16). */}
        <Pressable
          onPress={() => router.push("/(tabs)/library" as Href)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.md,
            padding: Spacing.md,
            borderRadius: CARD_RADIUS,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.cardBorder,
          }}
        >
          <IconBox color={Accent.success} size={36}>
            <Bookmark size={18} color={Accent.success} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text style={{ ...Type.body, fontWeight: '600', color: colors.text }}>My Library</Text>
            <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }}>Saved and imported recipes</Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
