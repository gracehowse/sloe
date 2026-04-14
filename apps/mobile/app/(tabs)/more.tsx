import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
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
  const userId = session?.user?.id ?? null;

  // Fetch real profile data
  const [profileData, setProfileData] = useState<{
    savedCount: number;
    streak: number;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    dietaryRestrictions: string[];
    notificationPref: string | null;
  }>({ savedCount: 0, streak: 0, targetCalories: NUTRITION_DEFAULTS.calories, targetProtein: NUTRITION_DEFAULTS.protein, targetCarbs: NUTRITION_DEFAULTS.carbs, targetFat: NUTRITION_DEFAULTS.fat, dietaryRestrictions: [], notificationPref: null });

  const loadProfileData = useCallback(async () => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Saved recipes count
      const { count } = await supabase
        .from("saved_recipes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      // Profile targets + preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, dietary_restrictions, notification_prefs")
        .eq("id", userId)
        .maybeSingle();

      // Logging streak (count consecutive days with entries ending today)
      const { data: logs } = await supabase
        .from("nutrition_entries")
        .select("date_key")
        .eq("user_id", userId)
        .order("date_key", { ascending: false })
        .limit(60);

      let streak = 0;
      if (logs && logs.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const uniqueDays = [...new Set(logs.map((l: any) => l.date_key))].sort((a: string, b: string) => b.localeCompare(a));
        for (const dayStr of uniqueDays) {
          const d = new Date(dayStr + "T00:00:00");
          const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
          if (diff === streak) streak++;
          else break;
        }
      }

      if (cancelled) return;
      // Parse dietary restrictions
      const dr = (profile as any)?.dietary_restrictions;
      const restrictions: string[] = Array.isArray(dr) ? dr.map(String) : [];
      // Parse notification prefs
      const np = (profile as any)?.notification_prefs;
      const notifTime = np && typeof np === "object" && np.reminder_time ? String(np.reminder_time) : null;

      setProfileData({
        savedCount: count ?? 0,
        streak,
        targetCalories: (profile as any)?.target_calories ?? NUTRITION_DEFAULTS.calories,
        targetProtein: (profile as any)?.target_protein ?? NUTRITION_DEFAULTS.protein,
        targetCarbs: (profile as any)?.target_carbs ?? NUTRITION_DEFAULTS.carbs,
        targetFat: (profile as any)?.target_fat ?? NUTRITION_DEFAULTS.fat,
        dietaryRestrictions: restrictions,
        notificationPref: notifTime,
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Reload profile data whenever this tab gets focus (e.g. after editing profile)
  useFocusEffect(useCallback(() => { void loadProfileData(); }, [loadProfileData]));

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [weekStartPickerOpen, setWeekStartPickerOpen] = useState(false);
  const [trackedMacros, setTrackedMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [weekStartDay, setWeekStartDay] = useState<"sunday" | "monday">("monday");

  // Load dashboard settings
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("tracked_macros, week_start_day")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.tracked_macros && Array.isArray(data.tracked_macros)) {
          setTrackedMacros(data.tracked_macros as string[]);
        }
        if (data?.week_start_day === "sunday" || data?.week_start_day === "monday") {
          setWeekStartDay(data.week_start_day);
        }
      });
  }, [userId]);

  const handleResetPlan = useCallback(async (clearData: boolean) => {
    if (!userId) return;
    setResetting(true);
    setResetModalOpen(false);

    try {
      // Run data clearing operations in parallel for speed
      const ops = [
        supabase.from("profiles").update({
          target_calories: NUTRITION_DEFAULTS.calories,
          target_protein: NUTRITION_DEFAULTS.protein,
          target_carbs: NUTRITION_DEFAULTS.carbs,
          target_fat: NUTRITION_DEFAULTS.fat,
          target_fiber_g: NUTRITION_DEFAULTS.fiber,
          target_water_ml: NUTRITION_DEFAULTS.water,
          onboarding_completed: false,
        }).eq("id", userId),
        supabase.from("meal_plan_days").delete().eq("user_id", userId),
      ] as PromiseLike<any>[];

      if (clearData) {
        ops.push(
          supabase.from("nutrition_entries").delete().eq("user_id", userId),
          supabase.from("nutrition_journals").update({ by_day: {} }).eq("user_id", userId),
          supabase.from("saved_recipes").delete().eq("user_id", userId),
        );
      }

      await Promise.all(ops);

      // Navigate immediately — don't wait for an alert
      router.replace("/onboarding" as any);
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setResetting(false);
    }
  }, [userId, router]);

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
          <Text style={{ fontSize: 12, color: colors.textTertiary }}>Pro · {(() => {
            const createdAt = session?.user?.created_at;
            if (!createdAt) return "Joined recently";
            const d = new Date(createdAt);
            const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
            if (diffDays < 7) return "Joined this week";
            if (diffDays < 30) return `Joined ${Math.floor(diffDays / 7)}w ago`;
            if (diffDays < 365) return `Joined ${Math.floor(diffDays / 30)}mo ago`;
            return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
          })()}</Text>
        </View>
      </View>

      {/* 3 Stat Pills — real data */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {([
          [String(profileData.savedCount), "Recipes", t.accent, null],
          [String(profileData.streak), "Streak", t.green, null],
          [String(Math.min(100, Math.round(
            (Math.min(profileData.streak, 7) / 7) * 40 +
            (Math.min(profileData.savedCount, 10) / 10) * 30 +
            30 // base points for being active
          ))), "Score", t.amber, () => Alert.alert(
            "Your Platemate Score",
            "Your score (0–100) reflects how actively you're using Platemate.\n\n"
            + "• Logging streak — log meals consistently to build your streak (up to 40 pts)\n"
            + "• Saved recipes — save recipes to your library (up to 30 pts)\n"
            + "• Active account — you get 30 pts just for being here\n\n"
            + "Keep logging and saving recipes to hit 100!"
          )],
        ] as [string, string, string, (() => void) | null][]).map(([v, l, c, onPress]) => (
          <Pressable key={l} onPress={onPress ?? undefined} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: c }}>{v}</Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{l}{onPress ? " ⓘ" : ""}</Text>
          </Pressable>
        ))}
      </View>

      {/* Settings Section */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Settings</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <SettingsRow icon="flame-outline" iconColor={t.accent} label="Daily Targets" sub={`${profileData.targetCalories.toLocaleString()} kcal · ${profileData.targetProtein}P / ${profileData.targetCarbs}C / ${profileData.targetFat}F`} onPress={() => router.push("/profile" as any)} />
        <SettingsRow icon="color-palette-outline" iconColor={t.accent} label="Appearance" sub="Theme & display settings" onPress={() => router.push("/(tabs)/settings" as any)} />
        <SettingsRow icon="apps-outline" iconColor={t.accent} label="Dashboard Widgets" sub={trackedMacros.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")} onPress={() => setWidgetPickerOpen(true)} />
        <SettingsRow icon="calendar-outline" iconColor={t.accent} label="Week Starts On" sub={weekStartDay === "monday" ? "Monday" : "Sunday"} onPress={() => setWeekStartPickerOpen(true)} />
        <SettingsRow icon="link-outline" iconColor={t.accent} label="Connected" sub="Not connected" />
        <SettingsRow icon="time-outline" iconColor={t.accent} label="Notifications" sub={profileData.notificationPref ? `Daily reminder at ${profileData.notificationPref}` : "Off"} onPress={() => router.push("/(tabs)/notifications" as any)} />
        <SettingsRow icon="download-outline" iconColor={t.accent} label="Export Data" sub="CSV download" />
        <SettingsRow icon="refresh-outline" iconColor={t.amber} label="Reset Plan" sub="Start fresh with new goals" onPress={() => setResetModalOpen(true)} />
        <SettingsRow icon="help-circle-outline" iconColor={t.accent} label="Help" sub="FAQs and support" onPress={() => {
          const base = getPlatemateWebBase();
          if (base) void Linking.openURL(`${base}/help`).catch(() => {});
        }} />
      </View>

      {/* Creator Tools */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Creator Tools</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <SettingsRow icon="create-outline" iconColor={t.green} label="Published Recipes" sub={`${profileData.savedCount} recipes saved`} onPress={() => router.push("/create-recipe" as any)} />
        <SettingsRow icon="bar-chart-outline" iconColor={t.green} label="Analytics" sub={`${profileData.savedCount} recipes · ${profileData.streak} day streak`} />
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

      {/* Reset Plan Modal */}
      <Modal
        visible={resetModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setResetModalOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onPress={() => setResetModalOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: t.amber + "18", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md }}>
                <Ionicons name="refresh" size={24} color={t.amber} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" }}>Start Fresh</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, maxWidth: 280, lineHeight: 18 }}>
                Reset your calorie and macro targets back to defaults and clear your meal plan. You can then set up new goals.
              </Text>
            </View>

            <Pressable
              onPress={() => handleResetPlan(false)}
              disabled={resetting}
              style={{
                backgroundColor: t.accent,
                borderRadius: Radius.md,
                paddingVertical: 16,
                alignItems: "center",
                marginBottom: Spacing.sm,
                opacity: resetting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                {resetting ? "Resetting..." : "Reset Plan (Keep My Data)"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>
                Keeps your food log and saved recipes
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  "Clear all data?",
                  "This will permanently delete your food log, saved recipes, and meal plans. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear Everything", style: "destructive", onPress: () => handleResetPlan(true) },
                  ],
                );
              }}
              disabled={resetting}
              style={{
                borderWidth: 1,
                borderColor: t.red + "40",
                borderRadius: Radius.md,
                paddingVertical: 16,
                alignItems: "center",
                marginBottom: Spacing.sm,
                opacity: resetting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: t.red, fontWeight: "700", fontSize: 15 }}>Reset and Clear Data</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                Removes all logged food, recipes, and plans
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setResetModalOpen(false)}
              style={{ paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* Dashboard Widgets Picker */}
      <Modal visible={widgetPickerOpen} transparent animationType="slide" onRequestClose={() => setWidgetPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setWidgetPickerOpen(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.xl }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Dashboard Widgets</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.lg }}>Choose which nutrients appear on your Today screen</Text>
            {([
              { key: "protein", label: "Protein", color: "#5B8DEF" },
              { key: "carbs", label: "Carbs", color: "#F5A623" },
              { key: "fat", label: "Fat", color: "#E05C5C" },
              { key: "fiber", label: "Fiber", color: Accent.success },
              { key: "sugar", label: "Sugar", color: "#D87FE8" },
              { key: "sodium", label: "Sodium", color: "#7FB5E8" },
              { key: "water", label: "Water", color: "#4FC3F7" },
            ] as const).map(({ key, label, color }) => {
              const isActive = trackedMacros.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setTrackedMacros((prev) => {
                      const next = isActive ? prev.filter((m) => m !== key) : [...prev, key];
                      if (next.length === 0) return prev;
                      if (userId) supabase.from("profiles").update({ tracked_macros: next }).eq("id", userId).then();
                      return next;
                    });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
                >
                  <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.text }}>{label}</Text>
                  <Ionicons name={isActive ? "checkbox" : "square-outline"} size={22} color={isActive ? Accent.primary : colors.textTertiary} />
                </Pressable>
              );
            })}
            <Pressable onPress={() => setWidgetPickerOpen(false)} style={{ marginTop: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Accent.primary, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Week Start Day Picker */}
      <Modal visible={weekStartPickerOpen} transparent animationType="slide" onRequestClose={() => setWeekStartPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setWeekStartPickerOpen(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.xl }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.lg }}>Week Starts On</Text>
            {(["monday", "sunday"] as const).map((day) => (
              <Pressable
                key={day}
                onPress={() => {
                  setWeekStartDay(day);
                  setWeekStartPickerOpen(false);
                  if (userId) supabase.from("profiles").update({ week_start_day: day }).eq("id", userId).then();
                }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.text }}>{day === "monday" ? "Monday" : "Sunday"}</Text>
                {weekStartDay === day && <Ionicons name="checkmark-circle" size={22} color={Accent.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
