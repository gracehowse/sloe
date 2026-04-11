import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Neon, Spacing, Radius } from "@/constants/theme";

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MEAL PLANNER</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📋</Text>
          <Text style={styles.cardTitle}>Plan your week</Text>
          <Text style={styles.cardDesc}>
            Save recipes to your library, then generate a meal plan that fits your macro targets automatically.
          </Text>
          <Pressable style={styles.generateBtn}>
            <Text style={styles.generateBtnText}>Generate Plan</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛒 Shopping List</Text>
          <Text style={styles.cardDesc}>
            Your shopping list is generated automatically from your meal plan. Grouped by category, ready to check off.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  header: { alignItems: "center", paddingVertical: Spacing.md },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Neon.purple,
    letterSpacing: 3,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: "#16161e",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Neon.pink + "30",
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: "center",
  },
  emoji: { fontSize: 36 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc" },
  cardDesc: { fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 20 },
  generateBtn: {
    backgroundColor: Neon.purple,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    marginTop: Spacing.sm,
  },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
