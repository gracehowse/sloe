import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ITEMS = [
  { label: "Shopping List", icon: "cart.fill" as const, route: "/(tabs)/settings" },
  { label: "Barcode Scanner", icon: "barcode.viewfinder" as const, route: "/(tabs)/barcode" },
  { label: "Notifications", icon: "bell.fill" as const, route: "/(tabs)/notifications" },
  { label: "Settings", icon: "gearshape.fill" as const, route: "/(tabs)/settings" },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
      </View>

      <View style={styles.list}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={[styles.row, { borderColor: colors.border }]}
            onPress={() => router.push(item.route as any)}
          >
            <IconSymbol size={22} name={item.icon} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
            <IconSymbol size={16} name="chevron.right" color={colors.textTertiary} />
          </Pressable>
        ))}
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
  list: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
});
