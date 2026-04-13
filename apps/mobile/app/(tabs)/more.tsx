import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";

const ITEMS = [
  { label: "Create Recipe", emoji: "✏️", route: "/create-recipe" },
  { label: "Shopping List", emoji: "🛒", route: "/shopping" },
  { label: "Import from link", emoji: "📥", route: "/import-shared" },
  { label: "Profile & Targets", emoji: "🎯", route: "/profile" },
  { label: "Barcode Scanner", emoji: "📷", route: "/(tabs)/barcode" },
  { label: "Notifications", emoji: "🔔", route: "/(tabs)/notifications" },
  { label: "Settings", emoji: "⚙️", route: "/(tabs)/settings" },
  { label: "About nutrition data", emoji: "ℹ️", route: "/nutrition-sources" },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { alignItems: "center", paddingVertical: Spacing.md },
        headerTitle: {
          fontSize: 22,
          fontWeight: "800",
          color: Neon.purple,
          letterSpacing: 3,
        },
        userCard: {
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.xl,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Neon.pink + "30",
          padding: Spacing.xl,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.lg,
        },
        userAvatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: Neon.purple,
          justifyContent: "center",
          alignItems: "center",
        },
        userAvatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
        userEmail: { color: colors.textSecondary, fontSize: 14, flex: 1 },
        list: {
          paddingHorizontal: Spacing.xl,
          gap: Spacing.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          paddingVertical: Spacing.lg,
          paddingHorizontal: Spacing.lg,
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        rowEmoji: { fontSize: 20 },
        rowLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
        rowChevron: { color: colors.tabIconDefault, fontSize: 22, fontWeight: "600" },
        signOutBtn: {
          marginHorizontal: Spacing.xl,
          marginTop: Spacing.xxxl,
          paddingVertical: Spacing.lg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Neon.red + "40",
          alignItems: "center",
        },
        signOutText: { color: Neon.red, fontWeight: "600", fontSize: 15 },
      }),
    [colors],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MORE</Text>
      </View>

      {/* User info */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(session?.user?.email?.[0] ?? "P").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userEmail}>{session?.user?.email ?? "Not signed in"}</Text>
      </View>

      <View style={styles.list}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={styles.row}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.rowEmoji}>{item.emoji}</Text>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.signOutBtn}
        onPress={() => void supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}
