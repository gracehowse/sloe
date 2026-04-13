import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { getPlatemateWebBase } from "@/lib/platemateWeb";

type MenuItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route: string };

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Create",
    items: [
      { label: "Create Recipe", icon: "create-outline", route: "/create-recipe" },
      { label: "Import from link", icon: "link-outline", route: "/import-shared" },
    ],
  },
  {
    title: "Health",
    items: [
      { label: "Fasting Timer", icon: "timer-outline", route: "/fasting" },
      { label: "Health Sync", icon: "heart-outline", route: "/health-sync" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile & Targets", icon: "person-outline", route: "/profile" },
      { label: "Shopping List", icon: "cart-outline", route: "/shopping" },
      { label: "Notifications", icon: "notifications-outline", route: "/(tabs)/notifications" },
      { label: "Settings", icon: "settings-outline", route: "/(tabs)/settings" },
    ],
  },
  {
    title: "About",
    items: [
      { label: "Nutrition Data Sources", icon: "information-circle-outline", route: "/nutrition-sources" },
    ],
  },
];

function openLegalPath(path: "/privacy" | "/terms") {
  const base = getPlatemateWebBase();
  if (!base) {
    Alert.alert("Unavailable", "Web URL is not configured in app settings.");
    return;
  }
  const url = `${base}${path}`;
  void Linking.openURL(url).catch(() => {
    Alert.alert("Could not open link", url);
  });
}

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
          fontSize: 20,
          fontWeight: "700",
          color: colors.text,
        },
        userCard: {
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.lg,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
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
        sectionTitle: {
          fontSize: 12,
          fontWeight: "600",
          color: colors.textSecondary,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          paddingHorizontal: Spacing.xl,
          marginTop: Spacing.lg,
          marginBottom: Spacing.xs,
        },
        list: {
          paddingHorizontal: Spacing.xl,
          gap: 1,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          paddingVertical: 14,
          paddingHorizontal: Spacing.lg,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        rowFirst: { borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md },
        rowLast: { borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
        rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.text },
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
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(session?.user?.email?.[0] ?? "P").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userEmail}>{session?.user?.email ?? "Not signed in"}</Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.list}>
            {section.items.map((item, i) => (
              <Pressable
                key={item.label}
                style={[
                  styles.row,
                  i === 0 && styles.rowFirst,
                  i === section.items.length - 1 && styles.rowLast,
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon} size={20} color={Neon.purple} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.list}>
        <Pressable style={[styles.row, styles.rowFirst]} onPress={() => openLegalPath("/privacy")}>
          <Ionicons name="document-text-outline" size={20} color={Neon.purple} />
          <Text style={styles.rowLabel}>Privacy policy</Text>
          <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
        </Pressable>
        <Pressable style={[styles.row, styles.rowLast]} onPress={() => openLegalPath("/terms")}>
          <Ionicons name="reader-outline" size={20} color={Neon.purple} />
          <Text style={styles.rowLabel}>Terms of use</Text>
          <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      <Pressable
        style={styles.signOutBtn}
        onPress={() => void supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}
