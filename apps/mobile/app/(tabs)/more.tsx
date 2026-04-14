import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { getPlatemateWebBase } from "@/lib/platemateWeb";

/* ── Icon Box ── */
function IconBox({ color, size = 30, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.8, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

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

/* ── Settings Row ── */
function SettingsRow({ icon, iconColor, label, sub, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  sub: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
      <IconBox color={iconColor}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </IconBox>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const colors = useThemeColors();

  const t = {
    accent: Accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    red: Accent.destructive,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
    >
      {/* Avatar + Name */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: t.accent + "10", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: t.accent }}>
            {(session?.user?.email?.[0] ?? "P").toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {session?.user?.user_metadata?.display_name ?? session?.user?.email?.split("@")[0] ?? "Your Profile"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary }}>Pro · Joined recently</Text>
        </View>
      </View>

      {/* 3 Stat Pills */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {([
          ["42", "Recipes", t.accent],
          ["12", "Published", t.green],
          ["238", "Followers", t.amber],
        ] as const).map(([v, l, c]) => (
          <View key={l} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: c }}>{v}</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Settings Section */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Settings</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <SettingsRow icon="flame-outline" iconColor={t.accent} label="Daily Targets" sub="2,100 kcal · 150P / 250C / 65F" onPress={() => router.push("/profile" as any)} />
        <SettingsRow icon="restaurant-outline" iconColor={t.accent} label="Preferences" sub="No restrictions" onPress={() => router.push("/(tabs)/settings" as any)} />
        <SettingsRow icon="link-outline" iconColor={t.accent} label="Connected" sub="Apple Health, Instagram" />
        <SettingsRow icon="time-outline" iconColor={t.accent} label="Notifications" sub="Daily reminder at 7 PM" onPress={() => router.push("/(tabs)/notifications" as any)} />
        <SettingsRow icon="download-outline" iconColor={t.accent} label="Export Data" sub="CSV download" />
      </View>

      {/* Creator Tools */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Creator Tools</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <SettingsRow icon="create-outline" iconColor={t.green} label="Published Recipes" sub="12 recipes · 891 total makes" onPress={() => router.push("/create-recipe" as any)} />
        <SettingsRow icon="bar-chart-outline" iconColor={t.green} label="Analytics" sub="Views, saves, engagement" />
        <SettingsRow icon="add-circle-outline" iconColor={t.green} label="Publish New" sub="Share with the community" onPress={() => router.push("/create-recipe" as any)} />
      </View>

      {/* Legal */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Legal</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <SettingsRow icon="document-text-outline" iconColor={t.accent} label="Privacy Policy" sub="How we use your data" onPress={() => openLegalPath("/privacy")} />
        <SettingsRow icon="reader-outline" iconColor={t.accent} label="Terms of Use" sub="Service agreement" onPress={() => openLegalPath("/terms")} />
      </View>

      {/* Sign Out */}
      <Pressable
        onPress={() => void supabase.auth.signOut()}
        style={{ paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: t.red + "40", alignItems: "center", marginTop: 16 }}
      >
        <Text style={{ color: t.red, fontWeight: "600", fontSize: 15 }}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}
