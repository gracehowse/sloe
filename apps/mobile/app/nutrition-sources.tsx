import { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Beaker, BookOpen, Database, Globe2, Utensils, type LucideIcon } from "lucide-react-native";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { NUTRITION_SOURCES } from "@suppr/shared/landing/nutritionSources";

/**
 * Per-source description + public URL. Keyed on the canonical names that
 * live in `NUTRITION_SOURCES` (the landing-page SSOT, which mirrors the
 * real pipeline order in `src/lib/nutrition/verifyIngredients.ts`). If a
 * source is added or removed in the SSOT, the screen picks it up
 * automatically — the only manual step is adding its description + URL
 * here. Missing entries log once to the console so QA spots drift.
 *
 * 2026-05-14 (premium-bar audit Group J #8): each source now carries a
 * `tagline` (one-line summary) + `icon` (lucide-react-native) so the
 * row reads as a styled card not a wall of text. Tagline appears in
 * the bold byline position; the long-form description follows.
 */
const SOURCE_DETAILS: Record<
  string,
  { tagline: string; description: string; url: string; icon: LucideIcon }
> = {
  "USDA FoodData Central": {
    tagline: "Laboratory-tested data for whole foods.",
    description:
      "Maintained by the U.S. Department of Agriculture. Includes Foundation, SR Legacy, and Survey datasets covering tens of thousands of generic and minimally processed foods.",
    url: "https://fdc.nal.usda.gov",
    icon: Beaker,
  },
  "Edamam": {
    tagline: "Strong on restaurant meals and recipes.",
    description:
      "A nutrition database with deep coverage of restaurant items, recipes, and generic foods. Backed by the Edamam Food & Measures database used by major food publishers. Powered by Edamam.",
    url: "https://www.edamam.com/",
    icon: Utensils,
  },
  "Open Food Facts": {
    tagline: "Open-source barcode database, 2M+ products.",
    description:
      "A free, open-source database of food products built by volunteers who scan barcodes and record nutrition labels. Strong coverage across the UK, EU, US, and Australia. Product data (c) Open Food Facts contributors, available under the Open Database License (ODbL).",
    url: "https://world.openfoodfacts.org",
    icon: Globe2,
  },
  "FatSecret": {
    tagline: "Branded food database with 800,000+ items.",
    description:
      "A comprehensive food and nutrition database with detailed serving-size information for branded and generic foods.",
    url: "https://platform.fatsecret.com",
    icon: Database,
  },
};

/** Drift-guard fallback icon when a new source is added to the SSOT
 *  without a row in `SOURCE_DETAILS`. Generic book/reference glyph. */
const FALLBACK_ICON: LucideIcon = BookOpen;

export default function NutritionSourcesScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/settings");
  const colors = useThemeColors();
  // Source links + the INFO overline read in `Accent.primarySolid` (the
  // aubergine text/icon-on-light variant); the icon-box uses `Accent.primarySoft`
  // (Sloe treatment system, 2026-06-08). Both are static `Accent.*` constants,
  // so the StyleSheet only depends on `colors`.

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backText: { color: colors.text, fontSize: 17, fontWeight: "600" },
        // INFO overline + source links read in `accent.primarySolid` (#4E3260,
        // AA on the white page) — small accent text uses the solid variant per
        // the Sloe treatment system (2026-06-08). The icon-box tint stays the
        // soft aubergine wash.
        topTitle: { color: Accent.primarySolid, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
        scroll: { padding: Spacing.xl, gap: Spacing.xxl, paddingBottom: 60 },
        heading: { ...Type.title, color: colors.text },
        intro: { fontSize: 14, lineHeight: 22, color: colors.textSecondary },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          flexDirection: "row",
          gap: Spacing.md,
        },
        iconBox: {
          width: 40,
          height: 40,
          borderRadius: Radius.md,
          backgroundColor: Accent.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        },
        cardBody: {
          flex: 1,
          gap: Spacing.xs,
        },
        sourceName: { fontSize: 16, fontWeight: "700", color: colors.text },
        sourceTagline: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          lineHeight: 18,
        },
        sourceDesc: {
          fontSize: 13,
          lineHeight: 20,
          color: colors.textSecondary,
          marginTop: 2,
        },
        sourceLink: {
          fontSize: 13,
          color: Accent.primarySolid,
          fontWeight: "600",
          marginTop: Spacing.xs,
        },
        disclaimer: {
          fontSize: 12,
          lineHeight: 18,
          color: colors.textTertiary,
          marginTop: Spacing.md,
        },
      }),
    [colors],
  );

  return (
    <View testID="screen-nutrition-sources" style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>INFO</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>About nutrition data</Text>
        <Text style={styles.intro}>
          Sloe combines multiple trusted databases to give you the most accurate nutrition information
          possible, wherever you are in the world. When you import a recipe or search for a food, we check
          these sources and pick the best match.
        </Text>

        {NUTRITION_SOURCES.map((name) => {
          const detail = SOURCE_DETAILS[name];
          if (!detail) {
            // Drift guard: new SSOT source without a description here.
            // Fails loud in dev; renders the name only so the list stays
            // complete in production.
            if (__DEV__) {
              console.warn(`[nutrition-sources] missing description for "${name}"`);
            }
            return (
              <View key={name} style={styles.card}>
                <View style={styles.iconBox}>
                  <FALLBACK_ICON size={20} color={Accent.primarySolid} strokeWidth={1.75} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.sourceName}>{name}</Text>
                </View>
              </View>
            );
          }
          const Icon = detail.icon;
          return (
            <View key={name} style={styles.card} testID={`nutrition-source-${name}`}>
              <View style={styles.iconBox}>
                <Icon size={20} color={Accent.primarySolid} strokeWidth={1.75} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.sourceName}>{name}</Text>
                <Text style={styles.sourceTagline}>{detail.tagline}</Text>
                <Text style={styles.sourceDesc}>{detail.description}</Text>
                <Pressable onPress={() => Linking.openURL(detail.url)}>
                  <Text style={styles.sourceLink}>
                    {detail.url.replace("https://", "")}{" "}
                    <Ionicons name="open-outline" size={12} color={Accent.primarySolid} />
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.disclaimer}>
          Nutrition values are estimates and may vary depending on brand, preparation method, and portion
          size. Always refer to product packaging for the most accurate information. If something looks
          wrong, tap an ingredient on the verify screen to search for a better match.
        </Text>
      </ScrollView>
    </View>
  );
}
