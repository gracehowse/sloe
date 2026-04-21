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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes } from "@/lib/recipes";
import { searchEdamam, type EdamamSearchResult } from "@/lib/verifyRecipe";
import { Search, Utensils, Flame, Beef, Clock, Bookmark, Link as LinkIcon, ChevronRight, ChefHat } from "lucide-react-native";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { computeRecipeFitPercent } from "../../../../src/lib/nutrition/recipeFitPercent";

const FILTERS = ["For You", "Popular", "Quick", "High Protein", "Low Carb"];

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
    // Search filter
    if (search.trim() && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    // Pill filter
    if (filter === "For You") return true;
    // Popular — real filter (was `|| true`, which silently disabled
    // the gate; ui-critic flagged 2026-04-20).
    if (filter === "Popular") return (r.saves ?? 0) >= 50;
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
      const fitPct = computeRecipeFitPercent(
        { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat },
        targets,
      ).percent;
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
          <View style={{ aspectRatio: 16 / 10, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {/* D8 (2026-04-21): deterministic cuisine-aware
                gradient+pattern+glyph fallback instead of a flat
                tint. Shared spec in
                `src/lib/recipe/recipeHeroFallback.ts`; web parity in
                `src/app/components/suppr/RecipeHeroFallback.tsx`.
                When real images land (not yet in `RecipeCard`) the
                fallback should be conditionally skipped — tracked in
                `docs/design/discover-hero-fallback.md` §6. */}
            <RecipeHeroFallback id={item.id} title={item.title} />
            <SourceBadge source={item.source} />
          </View>
          <View style={{ padding: 14 }}>
            {/* Fit-percent pill — primary-tinted, top-right of the
                card body. Matches prototype treatment. */}
            <View
              testID={`discover-hero-fit-${item.id}`}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: t.accent + "26",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: t.accent, fontVariant: ["tabular-nums"] }}>
                {fitPct}%
              </Text>
            </View>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 19, letterSpacing: -0.1, paddingRight: 48 }}
              numberOfLines={2}
            >
              {decodeEntities(item.title)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>
              {item.creatorName || item.source || ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Flame size={11} color={MacroColors.calories} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {kcal} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Beef size={11} color={MacroColors.protein} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {protein} g
                </Text>
              </View>
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
          {/* 2026-04-20 prototype port — chef-hat icon-box (40×40).
              Ionicons doesn't ship `restaurant` as a chef-hat glyph;
              MaterialCommunityIcons `chef-hat` matches the prototype
              literally and mirrors the web lucide `ChefHat` icon on
              `src/app/components/DiscoverFeed.tsx`. */}
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" }}>
            <ChefHat size={20} color={colors.textSecondary} />
          </View>
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
        <View style={{ paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1.4, textTransform: "uppercase" }}>
              Browse
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.6, marginTop: 2 }}>
              Discover
            </Text>
          </View>
          <Pressable
            onPress={() => searchInputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Focus search"
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Search size={18} color={colors.text} />
          </Pressable>
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

            {/* Section 2 — More ideas (only when a 3rd+ exists) */}
            {filtered.length > 2 ? (
              <>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: -0.1, marginTop: 22, marginBottom: 10 }}>
                  More ideas
                </Text>
                <View style={{ borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
                  {filtered.slice(2).map((r, idx) => renderMoreIdeaRow(r, idx))}
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
