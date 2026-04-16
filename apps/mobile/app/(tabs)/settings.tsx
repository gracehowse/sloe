import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { useTheme, type ThemePreference } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { normalizeWeekSummaryMode, type WeekSummaryMode } from "../../../../src/lib/nutrition/weekSummaryWindow";

type NotificationPrefs = {
  newRecipes: boolean;
  mealReminders: boolean;
  weeklyReport: boolean;
  creatorUpdates: boolean;
  /** Today tab: show time under each logged meal (time label or logged-at). */
  showMealTimestamps: boolean;
  weekSummaryMode: WeekSummaryMode;
};

const DEFAULT_PREFS: NotificationPrefs = {
  newRecipes: true,
  mealReminders: false,
  weeklyReport: true,
  creatorUpdates: true,
  showMealTimestamps: false,
  weekSummaryMode: "rolling",
};

type BoolPrefKey = "newRecipes" | "mealReminders" | "weeklyReport" | "creatorUpdates" | "showMealTimestamps";

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "Automatic", value: "auto" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

/** PostgREST sometimes returns jsonb as object, string, or a single-element array. */
function normalizeRedeemPromoRpcData(data: unknown): {
  ok: boolean;
  tier?: string;
  error?: string;
} | null {
  let cur: unknown = data;
  if (Array.isArray(cur) && cur.length === 1) cur = cur[0];
  for (let i = 0; i < 3; i++) {
    if (typeof cur !== "string") break;
    try {
      cur = JSON.parse(cur) as unknown;
    } catch {
      return null;
    }
  }
  if (cur == null || typeof cur !== "object") return null;
  const o = cur as Record<string, unknown>;
  const okRaw = o.ok;
  const ok = okRaw === true || okRaw === "true";
  const tier = typeof o.tier === "string" ? o.tier : undefined;
  const error = typeof o.error === "string" ? o.error : undefined;
  return { ok, tier, error };
}

function messageForPromoError(error: string | undefined): string {
  switch (error) {
    case "invalid_or_expired":
      return "That code is not valid, has expired, or has reached its use limit.";
    case "not_authenticated":
      return "Sign in again, then try the code.";
    case "invalid_code":
      return "Enter a promo code.";
    default:
      return "That code could not be applied. Check for typos and try again.";
  }
}

function normalizeUserTier(raw: string | null | undefined): "free" | "base" | "pro" {
  const t = String(raw ?? "free")
    .toLowerCase()
    .trim();
  if (t === "pro" || t === "base" || t === "free") return t;
  return "free";
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const authEmail = session?.user?.email ?? null;
  const colors = useThemeColors();
  const { preference, setPreference } = useTheme();

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>("free");
  const [activityAdjust, setActivityAdjust] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 120,
          gap: Spacing.md,
        },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
        muted: { color: colors.textSecondary, paddingHorizontal: Spacing.xl },
        center: { paddingVertical: 40, alignItems: "center" },
        err: { color: "#f87171", fontSize: 14 },
        card: {
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: Spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowLast: { borderBottomWidth: 0 },
        rowLabel: { flex: 1, paddingRight: 8, color: colors.text, fontSize: 15, lineHeight: 20 },
        saving: { color: colors.textTertiary, fontSize: 13 },
        sectionTitle: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginTop: Spacing.md,
        },
        segmentedRow: {
          flexDirection: "row",
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        segmentBtn: {
          flex: 1,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        segmentBtnActive: {
          backgroundColor: Accent.primary + "20",
          borderColor: Accent.primary,
        },
        segmentBtnText: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.textSecondary,
        },
        segmentBtnTextActive: {
          color: Accent.primary,
        },
      }),
    [colors],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("notification_prefs, prefer_activity_adjusted_calories")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) {
        setError("Couldn't load notification settings.");
      } else {
        const raw = (data as { notification_prefs?: unknown } | null)?.notification_prefs;
        if (raw && typeof raw === "object") {
          const merged = { ...DEFAULT_PREFS, ...(raw as Partial<NotificationPrefs>) };
          merged.weekSummaryMode = normalizeWeekSummaryMode(merged.weekSummaryMode);
          setPrefs(merged);
        }
        setActivityAdjust(Boolean((data as any)?.prefer_activity_adjusted_calories));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Load user tier
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("user_tier")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const tier = normalizeUserTier((data as { user_tier?: string } | null)?.user_tier);
        setUserTier(tier);
      });
  }, [userId]);

  const handleChangePassword = useCallback(async () => {
    if (!authEmail) {
      Alert.alert("Error", "No email on this account.");
      return;
    }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(authEmail);
    if (resetErr) Alert.alert("Error", resetErr.message);
    else Alert.alert("Password Reset", "Check your inbox for a password reset link.");
  }, [authEmail]);

  const handleRedeemPromo = useCallback(async () => {
    if (!userId || !promoCode.trim()) return;
    setPromoSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("redeem_promo_code", {
        p_code: promoCode.trim().toUpperCase(),
      });
      if (rpcErr) {
        Alert.alert("Could not redeem", rpcErr.message || "Check your connection and try again.");
        return;
      }
      const payload = normalizeRedeemPromoRpcData(data);
      if (payload?.ok) {
        const { data: prof, error: refetchErr } = await supabase
          .from("profiles")
          .select("user_tier")
          .eq("id", userId)
          .maybeSingle();
        if (refetchErr) {
          Alert.alert("Redeemed", "Your code was applied. Restart the app if your plan badge does not update.");
        } else {
          const verified = normalizeUserTier((prof as { user_tier?: string } | null)?.user_tier);
          setUserTier(verified);
          const label = verified === "pro" ? "Pro" : verified === "base" ? "Base" : "Free";
          Alert.alert("Success", `Your plan is now ${label}.`);
        }
        setPromoCode("");
      } else {
        Alert.alert(
          "Could not apply code",
          messageForPromoError(payload?.error),
        );
      }
    } catch {
      Alert.alert("Error", "Could not redeem code.");
    } finally {
      setPromoSubmitting(false);
    }
  }, [userId, promoCode]);

  const persist = useCallback(
    async (next: NotificationPrefs) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      const { error: uErr } = await supabase.from("profiles").update({ notification_prefs: next }).eq("id", userId);
      setSaving(false);
      if (uErr) setError("Couldn't save settings. Try again.");
    },
    [userId],
  );

  const toggle = (key: BoolPrefKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void persist(next);
      return next;
    });
  };

  const setWeekSummaryMode = (mode: WeekSummaryMode) => {
    setPrefs((prev) => {
      if (prev.weekSummaryMode === mode) return prev;
      const next = { ...prev, weekSummaryMode: mode };
      void persist(next);
      return next;
    });
  };

  if (!userId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.muted}>Sign in to manage settings.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>
          Plan, appearance, and notifications.
        </Text>

        {/* Plan + promo first (not grouped under appearance / theme) */}
        <Text style={styles.sectionTitle}>Your plan</Text>
        <View style={styles.card}>
          <View style={[styles.row, { justifyContent: "flex-start", gap: 12 }]}>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
              backgroundColor: userTier === "pro" ? Accent.primary + "18" : userTier === "base" ? Accent.success + "18" : colors.border + "60",
            }}>
              <Text style={{
                fontSize: 13, fontWeight: "700",
                color: userTier === "pro" ? Accent.primary : userTier === "base" ? Accent.success : colors.textSecondary,
              }}>
                {userTier === "pro" ? "Pro" : userTier === "base" ? "Base" : "Free"}
              </Text>
            </View>
            {authEmail ? <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{authEmail}</Text> : null}
          </View>
          {userTier !== "pro" && (
            <Pressable
              style={styles.row}
              onPress={() => router.push("/paywall" as any)}
            >
              <Text style={[styles.rowLabel, { color: Accent.success }]}>View plans</Text>
              <Ionicons name="chevron-forward" size={16} color={Accent.success} />
            </Pressable>
          )}
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.sm, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.6 }}>PROMO CODE</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Enter your code exactly as provided (letters are not case-sensitive).
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="e.g. SUPPR_TEST_PREMIUM"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
                  color: colors.text, fontSize: 14,
                }}
              />
              <Pressable
                onPress={() => void handleRedeemPromo()}
                disabled={promoSubmitting || !promoCode.trim()}
                style={{
                  paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: Accent.primary,
                  opacity: promoSubmitting || !promoCode.trim() ? 0.4 : 1,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  {promoSubmitting ? "..." : "Apply"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.segmentedRow}>
          {THEME_OPTIONS.map((opt, idx) => {
            const isActive = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.segmentBtn,
                  isActive && styles.segmentBtnActive,
                  idx > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                ]}
                onPress={() => setPreference(opt.value)}
              >
                <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => void handleChangePassword()}>
            <Text style={styles.rowLabel}>Change Password</Text>
            <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            style={[styles.row, styles.rowLast]}
            onPress={() => void supabase.auth.signOut()}
          >
            <Text style={[styles.rowLabel, { color: "#ef4444" }]}>Sign Out</Text>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Accent.primary} />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>Journal display</Text>
            <View style={styles.card}>
              <Row
                label="Show meal times on Today"
                value={prefs.showMealTimestamps}
                onToggle={() => toggle("showMealTimestamps")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <View style={[styles.row, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Adjust goal for activity</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 }}>
                    Adds bonus calories when Apple Health shows you burned more than your estimated maintenance.
                  </Text>
                </View>
                <Switch
                  value={activityAdjust}
                  onValueChange={async (v) => {
                    setActivityAdjust(v);
                    if (userId) {
                      await supabase.from("profiles").update({ prefer_activity_adjusted_calories: v }).eq("id", userId);
                    }
                  }}
                  trackColor={{ true: Accent.primary }}
                />
              </View>
              <View style={[styles.row, styles.rowLast, { flexDirection: "column", alignItems: "stretch", gap: 10 }]}>
                <Text style={styles.rowLabel}>Burn / deficit summary window</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  Applies to the weekly block when you expand your calorie ring on Today.
                </Text>
                <View style={styles.segmentedRow}>
                  <Pressable
                    style={[
                      styles.segmentBtn,
                      prefs.weekSummaryMode === "rolling" && styles.segmentBtnActive,
                      { borderRightWidth: 1, borderRightColor: colors.border },
                    ]}
                    onPress={() => setWeekSummaryMode("rolling")}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        prefs.weekSummaryMode === "rolling" && styles.segmentBtnTextActive,
                      ]}
                    >
                      Rolling (last 7 days)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentBtn, prefs.weekSummaryMode === "calendar_week" && styles.segmentBtnActive]}
                    onPress={() => setWeekSummaryMode("calendar_week")}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        prefs.weekSummaryMode === "calendar_week" && styles.segmentBtnTextActive,
                      ]}
                    >
                      This week
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              <Row
                label="New recipes from people you follow"
                value={prefs.newRecipes}
                onToggle={() => toggle("newRecipes")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Meal plan ready"
                value={prefs.mealReminders}
                onToggle={() => toggle("mealReminders")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Weekly summary"
                value={prefs.weeklyReport}
                onToggle={() => toggle("weeklyReport")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Your recipe publish updates"
                value={prefs.creatorUpdates}
                onToggle={() => toggle("creatorUpdates")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Pressable
                style={[styles.row, styles.rowLast]}
                onPress={() => router.push("/(tabs)/notifications" as any)}
              >
                <Text style={styles.rowLabel}>Open alerts inbox</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
            {saving ? <Text style={styles.saving}>Saving…</Text> : null}

            <Text style={styles.sectionTitle}>Data</Text>
            <View style={styles.card}>
              <Pressable
                style={[styles.row, styles.rowLast]}
                onPress={async () => {
                  if (!userId) return;
                  try {
                    const { data: entries } = await supabase
                      .from("nutrition_entries")
                      .select("*")
                      .eq("user_id", userId)
                      .order("created_at", { ascending: true });
                    const { data: profile } = await supabase
                      .from("profiles")
                      .select("*")
                      .eq("id", userId)
                      .maybeSingle();
                    const payload = JSON.stringify({ profile, entries }, null, 2);
                    await Share.share({ message: payload, title: "Suppr Data Export" });
                  } catch (e) {
                    Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
                  }
                }}
              >
                <Text style={styles.rowLabel}>Export my data (JSON)</Text>
                <Text style={{ color: Accent.primary, fontWeight: "600", fontSize: 14 }}>Export</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row(props: {
  label: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isLast?: boolean;
  styles: Record<string, any>;
  colors: { text: string; textTertiary: string; border: string };
}) {
  return (
    <View style={[props.styles.row, props.isLast && props.styles.rowLast]}>
      <Text style={props.styles.rowLabel}>{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={() => props.onToggle()}
        disabled={props.disabled}
        trackColor={{ false: props.colors.border, true: Accent.primary + "99" }}
        thumbColor={Platform.OS === "android" ? (props.value ? "#fff" : props.colors.textTertiary) : undefined}
        ios_backgroundColor={props.colors.border}
      />
    </View>
  );
}
