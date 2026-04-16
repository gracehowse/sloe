import { useFocusEffect } from "@react-navigation/native";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { useCallback, useRef, useState } from "react";
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

/* ── Fit Badge ── */
function FitBadge({ fit }: { fit: string }) {
  const label = fit === "great" ? "Great" : fit === "warn" ? "High" : "Good";
  const color = fit === "great" ? Accent.success : fit === "warn" ? Accent.warning : Accent.primary;
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: color + "18" }}>
      <Text style={{ fontSize: 9, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}

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
    if (filter === "Popular") return (r.saves ?? 0) >= 50 || true;
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

  const fitColor = (fit?: string) =>
    fit === "great" ? t.green : fit === "warn" ? t.amber : t.accent;

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCard }) => {
      const fit = item.fit ?? "good";
      const fColor = fitColor(fit);
      return (
        <Pressable
          onPress={() => router.push(`/recipe/${item.id}`)}
          style={{
            width: cardWidth,
            borderRadius: Radius.lg,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          {/* Hero gradient area */}
          <View style={{ height: 80, alignItems: "center", justifyContent: "center", backgroundColor: fColor + "12" }}>
            <Ionicons name="restaurant-outline" size={28} color={fColor} />
            <SourceBadge source={item.source} />
          </View>

          {/* Card body */}
          <View style={{ padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, lineHeight: 16, marginBottom: 2 }} numberOfLines={2}>
              {decodeEntities(item.title)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 6 }}>
              {item.creatorName}{item.cookTime ? ` · ${item.cookTime}` : ""}
            </Text>

            {/* Macro dots */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
              {([
                ["P", Math.round(item.protein), t.protein],
                ["C", Math.round(item.carbs), t.carbs],
                ["F", Math.round(item.fat), t.fat],
              ] as const).map(([label, val, color]) => (
                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: color }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>{val}g</Text>
                </View>
              ))}
            </View>

            {/* Cal + fit badge */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>
                {Math.round(item.calories)}
                <Text style={{ fontSize: 9, fontWeight: "400", color: colors.textTertiary }}> kcal</Text>
              </Text>
              <FitBadge fit={fit} />
            </View>

            {/* Saves + made */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 5 }}>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>{(item.saves ?? 0).toLocaleString()} saves</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>{(item.made ?? 0).toLocaleString()} made</Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [cardWidth, router, colors, t],
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
            {/* Header */}
            <View style={{ paddingTop: 18, paddingBottom: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4 }}>Discover</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>Recipes that fit your macros</Text>
            </View>

            {/* Search bar */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: 12,
            }}>
              <Ionicons name="search-outline" size={15} color={colors.textTertiary} />
              <TextInput
                ref={searchInputRef}
                value={search}
                onChangeText={setSearch}
                placeholder="Search or paste a link..."
                placeholderTextColor={colors.textTertiary}
                style={{ flex: 1, fontSize: 12, color: colors.text, padding: 0 }}
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
