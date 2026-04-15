import { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

const SOURCES = [
  {
    name: "USDA FoodData Central",
    description:
      "Laboratory-tested nutrition data for thousands of whole foods, maintained by the U.S. Department of Agriculture. Includes Foundation, SR Legacy, and Survey datasets.",
    url: "https://fdc.nal.usda.gov",
  },
  {
    name: "Open Food Facts",
    description:
      "A free, open-source database of food products from around the world. Built by volunteers who scan barcodes and record nutrition labels. Strong coverage across the UK, EU, US, and Australia.",
    url: "https://world.openfoodfacts.org",
  },
  {
    name: "FatSecret Platform API",
    description:
      "A comprehensive food and nutrition database with detailed serving-size information for branded and generic foods.",
    url: "https://platform.fatsecret.com",
  },
];

export default function NutritionSourcesScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/more");
  const colors = useThemeColors();

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
        topTitle: { color: Accent.primary, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
        scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 60 },
        heading: { fontSize: 22, fontWeight: "700", color: colors.text },
        intro: { fontSize: 14, lineHeight: 22, color: colors.textSecondary },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: Spacing.sm,
        },
        sourceName: { fontSize: 16, fontWeight: "700", color: colors.text },
        sourceDesc: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
        sourceLink: { fontSize: 13, color: Accent.primary, fontWeight: "600", marginTop: Spacing.xs },
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          Suppr combines multiple trusted databases to give you the most accurate nutrition information
          possible, wherever you are in the world. When you import a recipe or search for a food, we check
          these sources and pick the best match.
        </Text>

        {SOURCES.map((s) => (
          <View key={s.name} style={styles.card}>
            <Text style={styles.sourceName}>{s.name}</Text>
            <Text style={styles.sourceDesc}>{s.description}</Text>
            <Pressable onPress={() => Linking.openURL(s.url)}>
              <Text style={styles.sourceLink}>
                {s.url.replace("https://", "")} <Ionicons name="open-outline" size={12} color={Accent.primary} />
              </Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Nutrition values are estimates and may vary depending on brand, preparation method, and portion
          size. Always refer to product packaging for the most accurate information. If something looks
          wrong, tap an ingredient on the verify screen to search for a better match.
        </Text>
      </ScrollView>
    </View>
  );
}
