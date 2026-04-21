import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { consumeNewSocialRecipeUrlFromClipboard } from "@/lib/clipboardShareForward";
import { useDiscoverRecipes } from "@/lib/recipes";
import { searchEdamam, type EdamamSearchResult } from "@/lib/verifyRecipe";
import { Ionicons } from "@expo/vector-icons";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Radius } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";

const FILTERS = ["For You", "Popular", "Quick", "High Protein", "Low Carb"];

/* ── Icon Box (local helper matching prototype) ── */
function IconBox({ color, size = 28, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

// Build 10 F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19):
// the per-card `FitBadge` + `fitColor` helper were removed — testers
// reported the score felt irrelevant. Mobile also never populated
// `item.fit` on any RecipeCard (the badge always showed "Good"), so
// there's nothing for a ranking fallback to replace. See resolved.md.

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
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = (screenWidth - 40 - 8) / 2; // 20px padding each side, 8px gap from columnWrapperStyle

  const { recipes, loading, refresh } = useDiscoverRecipes();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("For You");
  const searchInputRef = useRef<TextInput>(null);

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

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => {
      const kcal = Math.round(item.calories);
      const protein = Math.round(item.protein);
      return (
        <Pressable
          onPress={() => router.push(`/recipe/${item.id}`)}
          style={{
            width: cardWidth,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {/* Image area — 16:10 per prototype hero cards */}
          <View style={{ aspectRatio: 16 / 10, alignItems: "center", justifyContent: "center", backgroundColor: heroColor + "10" }}>
            <Ionicons name="restaurant-outline" size={28} color={heroColor} />
            <SourceBadge source={item.source} />
          </View>

          {/* Card body — prototype layout: title row (title + fit chip),
              source line, metadata row (kcal / protein / time with
              small lucide-style icons). */}
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              <Text
                style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.text, lineHeight: 17, letterSpacing: -0.1 }}
                numberOfLines={2}
              >
                {decodeEntities(item.title)}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
              {item.creatorName || item.source || ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="flame-outline" size={11} color={MacroColors.calories} />
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {kcal} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="barbell-outline" size={11} color={MacroColors.protein} />
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {protein} g
                </Text>
              </View>
              {item.cookTime ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    {item.cookTime}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [cardWidth, router, colors],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderRecipe}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={Accent.primary}
          />
        }
        ListHeaderComponent={
          <View>
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
                <Ionicons name="search-outline" size={18} color={colors.text} />
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
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
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
                marginBottom: 14,
              }}
            >
              <IconBox color={t.accent} size={36}>
                <Ionicons name="download-outline" size={18} color={t.accent} />
              </IconBox>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Import from TikTok, Instagram...</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Paste a link or share from any app</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
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
                marginBottom: 14,
              }}
            >
              <IconBox color={Accent.success} size={36}>
                <Ionicons name="bookmark" size={18} color={Accent.success} />
              </IconBox>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>My Library</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Saved and imported recipes</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 60, alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="large" color={Accent.primary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Loading recipes...</Text>
            </View>
          ) : (
            <View style={{ paddingTop: 80, alignItems: "center", gap: 8 }}>
              <Ionicons name={search.trim() ? "search-outline" : "restaurant-outline"} size={40} color={colors.textTertiary} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
                {search.trim() ? `No results for "${search.trim()}"` : "No recipes yet"}
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
                {search.trim() ? "Try a different search term." : "Pull down to refresh, or check your connection."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
