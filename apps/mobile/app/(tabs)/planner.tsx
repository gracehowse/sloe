import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand, Colors, Spacing, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Meal Planner</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Plan your week</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Save recipes to your library, then generate a meal plan that fits your macro targets.
          </Text>
          <Pressable style={styles.generateBtn}>
            <Text style={styles.generateBtnText}>Generate Plan</Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Full meal planning with macro optimization, shopping lists, and cook mode coming to mobile soon. Use the web app for the complete experience.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  cardDesc: { fontSize: 14, lineHeight: 20 },
  generateBtn: {
    backgroundColor: Brand.violet,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  generateBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  hint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
});
