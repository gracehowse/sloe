import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  RefreshControl,
  Image,
  type StyleProp,
  type ImageStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes } from "@/lib/recipes";
import { searchEdamam, type EdamamSearchResult } from "@/lib/verifyRecipe";
import { Search, Utensils, Bookmark, Link as LinkIcon, ChevronRight, ChefHat } from "lucide-react-native";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, Elevation, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
import type { RecipeCard } from "@/lib/types";
import { useAuth } from "@/context/auth";
import { useLibrarySearchStore } from "@/hooks/useLibrarySearchStore";
import { supabase } from "@/lib/supabase";
import { computeRecipeFitPercent } from "@suppr/shared/nutrition/recipeFitPercent";
import { DISCOVER_POPULAR_MIN_SAVES } from "@suppr/shared/recipes/fetchPublicRecipeSaveCounts";
import { recipeSearchMatch } from "@suppr/shared/recipes/recipeSearchMatch";
import { displayAttribution } from "@suppr/shared/recipes/displayAttribution";
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` imports
// dropped — the Discover hero card no longer renders the chip because
// the underlying source signal is fabricated (see the comment by the
// hero card body for the full rationale).
import { RecipesTabChrome } from "@/components/tabs/RecipesTabChrome";
import { DiscoverLoadingSkeleton } from "@/components/discover/DiscoverLoadingSkeleton";

// B5 Phase 2c (2026-04-27) — "Following" pill added. Filters Discover
// to recipes whose creator_id is in the set the user follows. Empty
// when the user follows nobody yet — copy points them at the next step.
const FILTERS = ["For You", "Following", "Popular", "Quick", "High Protein", "Low Carb"];

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
    <View style={{ position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#00000066" }}>
      <Text style={{ ...Type.caption, color: "#fff" }}>{source}</Text>
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
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
  const [filter, setFilter] = useState("For You");
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
    // Pill filter
    if (filter === "For You") return true;
    // B5 Phase 2c (2026-04-27) — Following filters to recipes whose
    // creator_id is in the user's follow set. Recipes without a
    // curated creator_id (imports, user-created) never match this
    // filter, which is correct — Following is creator-scoped.
    if (filter === "Following") {
      // D1 (2026-04-28): mirror web — match creatorId OR authorId.
      const cid = r.creatorId ?? null;
      const aid = (r as { authorId?: string | null }).authorId ?? null;
      if (cid && followedCreatorIds.has(cid)) return true;
      if (aid && followedAuthorIds.has(aid)) return true;
      return false;
    }
    // Popular — real filter (was `|| true`, which silently disabled
    // the gate; ui-critic flagged 2026-04-20).
    if (filter === "Popular") return (r.saves ?? r.savedCount ?? 0) >= DISCOVER_POPULAR_MIN_SAVES;
    if (filter === "Quick") {
      // GW-06 (audit 2026-04-28): pre-fix any recipe with
      // `cookTimeMin == null` passed through as "Quick" — most legacy
      // imports don't carry cook time, so the pill silently behaved
      // like "All". Now requires a real cook-time signal to qualify.
      const cm = r.cookTimeMin;
      const pm = (r as { prepTimeMin?: number | null }).prepTimeMin;
      const cookOk = typeof cm === "number" && cm > 0;
      const prepOk = typeof pm === "number" && pm > 0;
      if (!cookOk && !prepOk) return false;
      const total = (cookOk ? cm : 0) + (prepOk ? pm : 0);
      return total <= 30;
    }
    if (filter === "High Protein") return r.protein >= 25;
    if (filter === "Low Carb") return r.carbs <= 30;
    return true;
  });

  const t = {
    accent: Accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

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
        <Pressable
          key={item.id}
          onPress={() => router.push(`/recipe/${item.id}`)}
          style={{
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
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
          <View style={{ padding: 14 }}>
            {/* Fit-percent pill — primary-tinted, top-right of the
                card body. Matches prototype treatment. */}
            {/* F-45 (2026-04-22): fit-percent pill removed per repeated
                tester feedback ("Score means nothing — remove"). The
                value was being computed (see `fitPct`) but was not
                anchored to a target the user had chosen or surfaced
                otherwise, so it read as decorative noise. Keeping the
                computation available via `computeRecipeFitPercent` in
                case a future ranking pass wants it. */}
            <Text
              style={{ ...Type.body, fontWeight: '700', color: colors.text, paddingRight: 48 }}
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
            <MacroIconRow
              kcal={kcal}
              protein={protein}
              carbs={carbs}
              fat={fat}
              fiber={item.fiberG}
              cookTime={item.cookTime}
              textColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
              style={{ marginTop: 10 }}
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
        </Pressable>
      );
    },
    [router, colors, heroColor, t.accent, targets],
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderTopWidth: idx > 0 ? 1 : 0,
            borderTopColor: colors.cardBorder,
          }}
        >
          {/* F-55 (2026-04-22): use real thumbnail when the recipe has
              an image_url (social-feed parity — tester flagged "the
              more you might like is wrong - this is supposed to be
              like a social media feed"). Chef-hat glyph box stays as
              the fallback for image-less rows. */}
          <DiscoverCoverImage
            uri={item.image}
            style={{ width: 56, height: 56, borderRadius: 10 }}
            fallback={
              <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" }}>
                <ChefHat size={20} color={colors.textSecondary} />
              </View>
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={{ ...Type.body, color: colors.text }} numberOfLines={1}>
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Spacing.md, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={Accent.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Search bar — title + Library/Discover tabs live in RecipesTabChrome. */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: 14,
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={{ gap: 6, paddingRight: 32, alignItems: "center" }}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 8,
                minHeight: 36,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: filter === f ? t.accent : colors.cardBorder,
                backgroundColor: filter === f ? t.accent + "10" : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{ ...Type.caption, fontWeight: '600', lineHeight: 18, color: filter === f ? t.accent : colors.textSecondary }}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Eating out — Edamam restaurant + branded meals. Only renders
            when the user has typed at least 3 characters; collapsed
            when no hits so we don't waste vertical space. TestFlight
            `AOI9xgY88Dx-uphiXI8IzEk` (2026-04-18). */}
        {(eatingOutLoading || eatingOut.length > 0) && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
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
                    padding: 10,
                    borderRadius: Radius.md,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  {m.brand ? (
                    <Text style={{ ...Type.label, color: t.accent, marginBottom: 2 }} numberOfLines={1}>
                      {m.brand.toUpperCase()}
                    </Text>
                  ) : null}
                  <Text style={{ ...Type.caption, fontWeight: '600', color: colors.text, marginBottom: 6 }} numberOfLines={2}>
                    {m.label}
                  </Text>
                  <Text style={{ ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p
                  </Text>
                  <Text style={{ ...Type.caption, color: colors.textTertiary, marginTop: 2 }}>per 100 g</Text>
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
        <Pressable
          onPress={() => router.push("/import-shared" as Href)}
          accessibilityRole="button"
          accessibilityLabel="Import from TikTok, Instagram, YouTube or a website"
          testID="discover-import-cta"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: Radius.lg,
            backgroundColor: t.accent + "08",
            borderWidth: 1,
            borderColor: t.accent + "22",
            marginBottom: 14,
          }}
        >
          <IconBox color={t.accent} size={36}>
            <LinkIcon size={18} color={t.accent} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text style={{ ...Type.body, fontWeight: '600', color: colors.text }}>Import from TikTok, Instagram...</Text>
            <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }}>Paste a link or share from any app</Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </Pressable>

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
            <Text
              style={{
                ...Type.headline,
                color: colors.text,
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
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: Accent.primary,
                    backgroundColor: Accent.primary + "10",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ ...Type.caption, fontWeight: '600', color: Accent.primary }}>
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
            <Text
              style={{
                ...Type.headline,
                color: colors.text,
                marginBottom: Spacing.sm,
              }}
            >
              Recipe ideas
            </Text>
            <View style={{ gap: 12 }}>
              {filtered.slice(0, 3).map((r) => renderHeroCard(r))}
            </View>

            {filtered.length > 3 ? (
              <>
                <Text
                  style={{
                    ...Type.headline,
                    color: colors.text,
                    marginTop: Spacing.xl,
                    marginBottom: Spacing.sm,
                  }}
                >
                  More ideas
                </Text>
                <View
                  style={{
                    borderRadius: Radius.lg,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    overflow: "hidden",
                  }}
                >
                  {filtered.slice(3).map((r, idx) => renderMoreIdeaRow(r, idx))}
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
        <Text style={{ ...Type.headline, color: colors.text, marginTop: Spacing.xl, marginBottom: Spacing.sm }}>
          My Library
        </Text>

        {/* My Library CTA */}
        <Pressable
          onPress={() => router.push("/(tabs)/library" as Href)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: Spacing.md,
            borderRadius: Radius.lg,
            backgroundColor: colors.card,
            borderWidth: 1,
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
