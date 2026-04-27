import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes } from "@/lib/recipes";
import { searchEdamam, type EdamamSearchResult } from "@/lib/verifyRecipe";
import { Search, Utensils, Flame, Beef, Wheat, Droplets, Leaf, Clock, Bookmark, Link as LinkIcon, ChevronRight, ChefHat } from "lucide-react-native";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { computeRecipeFitPercent } from "../../../../src/lib/nutrition/recipeFitPercent";
import { DISCOVER_POPULAR_MIN_SAVES } from "../../../../src/lib/recipes/fetchPublicRecipeSaveCounts";
import { recipeSearchMatch } from "../../../../src/lib/recipes/recipeSearchMatch";

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
      <Text style={{ fontSize: 9, fontWeight: "500", color: "#fff" }}>{source}</Text>
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("For You");
  const searchInputRef = useRef<TextInput>(null);

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
  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setFollowedCreatorIds(new Set());
        return;
      }
      let cancelled = false;
      (async () => {
        const { data } = await supabase
          .from("follows")
          .select("creator_id")
          .eq("user_id", userId);
        if (cancelled || !Array.isArray(data)) return;
        const ids = new Set<string>();
        for (const row of data) {
          const id = (row as { creator_id?: string | null }).creator_id;
          if (typeof id === "string") ids.add(id);
        }
        setFollowedCreatorIds(ids);
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
      return r.creatorId != null && followedCreatorIds.has(r.creatorId);
    }
    // Popular — real filter (was `|| true`, which silently disabled
    // the gate; ui-critic flagged 2026-04-20).
    if (filter === "Popular") return (r.saves ?? r.savedCount ?? 0) >= DISCOVER_POPULAR_MIN_SAVES;
    if (filter === "Quick") {
      const cm = r.cookTimeMin;
      if (cm != null && cm > 0) return cm <= 20;
      return true;
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
              weight in the no-image case. */}
          <View
            style={{
              aspectRatio: item.image ? 16 / 10 : 8,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <RecipeHeroFallback id={item.id} title={item.title} />
            )}
            <SourceBadge source={item.source} />
          </View>
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
              style={{ fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 19, letterSpacing: -0.1, paddingRight: 48 }}
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
                  style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: "underline" }}
                  numberOfLines={1}
                >
                  {item.creatorName || item.source || ""}
                </Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>
                {item.creatorName || item.source || ""}
              </Text>
            )}
            {/* Polish (2026-04-25 visual-qa): pre-fix, only kcal and
                protein had icons — carbs and fat were tacked onto the
                protein row as plain text ("Xg P · Yg C · Zg F"). Tester
                feedback: "on the discover page protein has an icon but
                none of the other macro nutrients do". Each macro now
                gets its own icon + value pair, matching the prototype's
                visual treatment. Fibre joins when the recipe carries it. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Flame size={11} color={MacroColors.calories} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {kcal} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Beef size={11} color={MacroColors.protein} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {protein}g
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Wheat size={11} color={MacroColors.carbs} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {carbs}g
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Droplets size={11} color={MacroColors.fat} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {fat}g
                </Text>
              </View>
              {Number.isFinite(item.fiberG) && (item.fiberG ?? 0) > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Leaf size={11} color={Accent.success} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                    {Math.round((item.fiberG ?? 0) * 10) / 10}g
                  </Text>
                </View>
              ) : null}
              {item.cookTime ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Clock size={11} color={colors.textTertiary} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{item.cookTime}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [router, colors, heroColor, t.accent, targets],
  );

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
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={{ width: 56, height: 56, borderRadius: 10 }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" }}>
              <ChefHat size={20} color={colors.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={1}>
              {decodeEntities(item.title)}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
              {item.creatorName || item.source || ""}
              {item.cookTime ? ` · ${item.cookTime}` : ""}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>{kcal}</Text>
            {` · ${protein}P · ${carbs}C`}
          </Text>
        </Pressable>
      );
    },
    [router, colors],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={Accent.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header — prototype treatment: BROWSE overline + large
            Discover title + round search-icon button top-right. */}
        {/* P2-34 (2026-04-25 visual-qa): the round search-icon button
            in the top-right was a duplicate of the search bar
            immediately below it. Two affordances for the same job on
            the same screen reads as indecision. The header now carries
            only the title; the search bar below is the single
            search entry point. */}
        <View style={{ paddingTop: 18, paddingBottom: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1.4, textTransform: "uppercase" }}>
            Browse
          </Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.6, marginTop: 2 }}>
            Discover
          </Text>
        </View>

        {/* Search bar — prototype treatment: bigger, 48kcat placeholder. */}
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
            placeholder="Search 48,000+ recipes & foods"
            placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, fontSize: 14, color: colors.text, padding: 0 }}
          />
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: filter === f ? t.accent : colors.cardBorder,
                backgroundColor: filter === f ? t.accent + "10" : "transparent",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "500", color: filter === f ? t.accent : colors.textSecondary }}>{f}</Text>
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
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.4, textTransform: "uppercase" }}>
                Eating out
              </Text>
              {eatingOutLoading ? (
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>Searching…</Text>
              ) : (
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
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
                  onPress={() => router.push({ pathname: "/(tabs)" as any, params: { search: m.label } })}
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
                    <Text style={{ fontSize: 10, fontWeight: "700", color: t.accent, marginBottom: 2 }} numberOfLines={1}>
                      {m.brand.toUpperCase()}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }} numberOfLines={2}>
                    {m.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.textTertiary, marginTop: 2 }}>per 100 g</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Prototype port (2026-04-20, screens-mobile.jsx
            `DiscoverScreen` lines 345–438): three stacked sections.

              1. "Matches your day" — 2 hero cards from `filtered.slice(0, 2)`.
              2. "More ideas" — single card containing compact meal-row list
                 for `filtered.slice(2)`.
              3. "From your sources" — Import + My Library CTAs at the
                 BOTTOM (prototype treats them as utility, not discovery).

            When `filtered` is empty we skip sections 1 + 2 and render
            the existing "No recipes yet" empty state. Section 3 still
            renders — that's how users bring content in.

            F-11 reversed 2026-04-20: fit-percent badge is back per
            Grace's prototype screenshot — primary-tinted `{N}%` pill
            top-right of the hero card body, value from the shared
            `computeRecipeFitPercent` helper. Pinned by
            `tests/unit/recipeCardFitBadge.test.ts`. Web parity:
            `src/app/components/DiscoverFeed.tsx`. */}

        {loading && filtered.length === 0 ? (
          <View style={{ paddingTop: 60, alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="large" color={Accent.primary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Loading recipes...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingTop: 60, paddingBottom: 20, alignItems: "center", gap: 8 }}>
            {search.trim() ? (
              <Search size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
            ) : (
              <Utensils size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
            )}
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
              {search.trim() ? `No results for "${search.trim()}"` : "No recipes yet"}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
              {search.trim() ? "Try a different search term." : "Pull down to refresh, or check your connection."}
            </Text>
          </View>
        ) : (
          <>
            {/* Section 1 — Matches your day */}
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: -0.1, marginTop: 8, marginBottom: 10 }}>
              Matches your day
            </Text>
            <View style={{ gap: 12 }}>
              {filtered.slice(0, 2).map((r) => renderHeroCard(r))}
            </View>

            {/* Section 2 — More ideas.
                F-61 (2026-04-22): tester `AEq5NTi0n…` + `APpAKhhR…`
                flagged that "More ideas" compact list rows felt
                second-class next to the big hero cards and asked for
                a uniform social-feed render. Promote this section to
                hero-card style — same layout, same image treatment,
                just stacked below Matches-your-day with a 12px gap.
                `renderMoreIdeaRow` is retained in case a future
                density toggle re-enables the compact variant, but
                nothing calls it right now. */}
            {filtered.length > 2 ? (
              <>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: -0.1, marginTop: 22, marginBottom: 10 }}>
                  More ideas
                </Text>
                <View style={{ gap: 12 }}>
                  {filtered.slice(2).map((r) => renderHeroCard(r))}
                </View>
              </>
            ) : null}
          </>
        )}

        {/* Section 3 — From your sources. Always rendered so users
            can still bring content in when the feed is empty. */}
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: -0.1, marginTop: 22, marginBottom: 10 }}>
          From your sources
        </Text>

        {/* Import CTA */}
        <Pressable
          onPress={() => router.push("/import-shared" as Href)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: Radius.lg,
            backgroundColor: t.accent + "08",
            borderWidth: 1,
            borderColor: t.accent + "22",
            marginBottom: 10,
          }}
        >
          <IconBox color={t.accent} size={36}>
            <LinkIcon size={18} color={t.accent} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Import from TikTok, Instagram...</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Paste a link or share from any app</Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </Pressable>

        {/* My Library CTA */}
        <Pressable
          onPress={() => router.push("/(tabs)/library" as Href)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
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
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>My Library</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Saved and imported recipes</Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
