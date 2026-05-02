import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { ChevronRight, LogOut, Mail } from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { useTheme, type ThemePreference } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { presentCustomerCenter } from "@/lib/purchases";
import { supabase } from "@/lib/supabase";
import { usePromoCode, normalizeUserTier as normalizeUserTierShared } from "@/hooks/usePromoCode";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { normalizeWeekSummaryMode, type WeekSummaryMode } from "../../../../src/lib/nutrition/weekSummaryWindow";
import {
  coerceWeightSurfaceMode,
  type WeightSurfaceMode,
} from "../../../../src/lib/nutrition/weightSurfaceMode";
import ActivityLevelPreview from "@/components/ActivityLevelPreview";
import {
  ACTIVITY_SHORT_LABELS,
  type ActivityLevel,
  type NutritionStrategy,
  type PlanPace,
  type Sex,
} from "../../../../src/lib/nutrition/tdee";
import { recomputeTargetsForActivity } from "../../../../src/lib/nutrition/recomputeTargetsForActivity";
import { YouSubTabHeader } from "@/components/tabs/YouSubTabHeader";
import { SettingsBundleContent } from "@/components/settings/SettingsBundleContent";
import { CancelExportPromptSheet } from "@/components/settings/CancelExportPromptSheet";
import {
  nutritionLogToCsv,
  nutritionLogCsvFilename,
} from "../../../../src/lib/export/nutritionLogToCsv";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_TRACKING_EXTRAS,
  TRACKING_EXTRAS_STORAGE_KEY,
  parseTrackingExtras,
  serializeTrackingExtras,
  type TrackingExtras,
} from "../../../../src/lib/nutrition/trackingExtras";

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

// Promo-code redemption logic (normalizeRedeemPromoRpcData,
// messageForPromoError, normalizeUserTier) now lives in
// `@/hooks/usePromoCode`. See D9 M1 (2026-04-21 backlog).
const normalizeUserTier = normalizeUserTierShared;

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
  /**
   * 2026-05-01 (journey-architect P1) — cancel-flow export prompt.
   * Surfaces a Suppr-owned bottom sheet BEFORE routing to RC's
   * customerCenter so the export option is proactive, not buried in
   * Settings. Two equal-weight cards: "Take your data with you"
   * (export CSV first) / "Continue to manage" (route to RC). The X
   * dismisses without action.
   */
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  // P3-30 (2026-04-25): net-carbs lens opt-in. Source of truth:
  // `profiles.net_carbs_lens_enabled` (migration 20260503103000).
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  // T13 (2026-04-24) — weight surface opt-out (DI-P0-03).
  const [weightSurfaceMode, setWeightSurfaceMode] = useState<WeightSurfaceMode>("show");
  const {
    code: promoCode,
    setCode: setPromoCode,
    submitting: promoSubmitting,
    redeem: redeemPromo,
  } = usePromoCode({ userId });
  // Activity-level self-edit (build 10 fix E-2, 2026-04-19 —
  // TestFlight `AIIm60n` / `AHCSYMATS`). Opens a modal with
  // `ActivityLevelPreview` + live TDEE preview, writes
  // `activity_level` + recomputed targets via the shared helper.
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [activityPickerSelection, setActivityPickerSelection] =
    useState<ActivityLevel>("sedentary");
  const [activityPickerSaving, setActivityPickerSaving] = useState(false);
  const [profileSex, setProfileSex] = useState<Sex>("unspecified");
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const [profilePlanPace, setProfilePlanPace] = useState<PlanPace | null>(null);
  const [profileNutritionStrategy, setProfileNutritionStrategy] =
    useState<NutritionStrategy | null>(null);

  // Phase 2 / B1.4 (D-2026-04-27-08) — Tracking extras opt-in.
  // Defaults OFF. AsyncStorage-only (no schema change). Toggling
  // updates the local state + persists immediately so Today picks up
  // the new pref on next render via the effect in the tracker host.
  const [trackingExtras, setTrackingExtras] = useState<TrackingExtras>(DEFAULT_TRACKING_EXTRAS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TRACKING_EXTRAS_STORAGE_KEY);
        if (cancelled) return;
        setTrackingExtras(parseTrackingExtras(raw));
      } catch {
        // Storage unavailable — keep defaults.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const persistTrackingExtras = useCallback(async (next: TrackingExtras) => {
    setTrackingExtras(next);
    try {
      await AsyncStorage.setItem(TRACKING_EXTRAS_STORAGE_KEY, serializeTrackingExtras(next));
    } catch {
      // Soft failure — local state already reflects the toggle.
    }
  }, []);

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
        err: { color: Accent.destructive, fontSize: 14 },
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
        .select("notification_prefs, prefer_activity_adjusted_calories, weight_surface_mode, net_carbs_lens_enabled")
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
        setWeightSurfaceMode(coerceWeightSurfaceMode((data as any)?.weight_surface_mode));
        setNetCarbsLensEnabled(Boolean((data as any)?.net_carbs_lens_enabled));
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

  // Activity level row + body stats (build 10 fix E-2, 2026-04-19).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "activity_level, sex, age, height_cm, weight_kg, goal, plan_pace, nutrition_strategy",
        )
        .eq("id", userId)
        .maybeSingle();
      if (!data || cancelled) return;
      const row = data as Record<string, unknown>;
      const al = row.activity_level;
      if (
        al === "sedentary" ||
        al === "light" ||
        al === "moderate" ||
        al === "active" ||
        al === "very_active"
      ) {
        setActivityLevel(al);
        setActivityPickerSelection(al);
      }
      const s = row.sex;
      if (s === "male" || s === "female" || s === "unspecified") setProfileSex(s);
      const a = row.age;
      if (typeof a === "number" && Number.isFinite(a) && a > 0) setProfileAge(Math.round(a));
      const w = row.weight_kg;
      if (typeof w === "number" && Number.isFinite(w) && w > 0) setProfileWeightKg(w);
      const h = row.height_cm;
      if (typeof h === "number" && Number.isFinite(h) && h > 0) setProfileHeightCm(h);
      const g = row.goal;
      if (typeof g === "string" && g.length > 0) setProfileGoal(g);
      const pp = row.plan_pace;
      if (pp === "relaxed" || pp === "steady" || pp === "accelerated" || pp === "vigorous") {
        setProfilePlanPace(pp);
      }
      const ns = row.nutrition_strategy;
      if (ns === "balanced" || ns === "high_protein" || ns === "high_satisfaction" || ns === "low_carb") {
        setProfileNutritionStrategy(ns);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openActivityPicker = useCallback(() => {
    setActivityPickerSelection(activityLevel ?? "sedentary");
    setActivityPickerOpen(true);
  }, [activityLevel]);

  // Audit 2026-04-30 modal-dismiss sweep: an in-flight save used to lock
  // the Cancel button + backdrop, so a hung request trapped the user in
  // the picker. We now (a) always allow dismissal, (b) cap the visible
  // saving flag at 10s in case the request hangs.
  const activitySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activitySaveCancelledRef = useRef(false);

  const clearActivitySaveTimeout = useCallback(() => {
    if (activitySaveTimeoutRef.current) {
      clearTimeout(activitySaveTimeoutRef.current);
      activitySaveTimeoutRef.current = null;
    }
  }, []);

  // Always allow dismiss. If a save is in flight, we mark it cancelled
  // so the in-flight request's resolution becomes a no-op for UI state,
  // and we clear the watchdog timeout.
  const dismissActivityPicker = useCallback(() => {
    activitySaveCancelledRef.current = true;
    clearActivitySaveTimeout();
    setActivityPickerSaving(false);
    setActivityPickerOpen(false);
  }, [clearActivitySaveTimeout]);

  useEffect(() => {
    return () => {
      clearActivitySaveTimeout();
    };
  }, [clearActivitySaveTimeout]);

  const saveActivityLevel = useCallback(async () => {
    if (!userId) return;
    const nextLevel = activityPickerSelection;
    if (nextLevel === activityLevel) {
      setActivityPickerOpen(false);
      return;
    }
    activitySaveCancelledRef.current = false;
    setActivityPickerSaving(true);

    // 10s watchdog — if the network hangs, auto-clear the saving flag
    // so the picker stops looking frozen. The actual request may still
    // resolve later; we no-op its UI effects via the cancelled ref.
    clearActivitySaveTimeout();
    activitySaveTimeoutRef.current = setTimeout(() => {
      activitySaveCancelledRef.current = true;
      setActivityPickerSaving(false);
      activitySaveTimeoutRef.current = null;
      Alert.alert(
        "Still saving…",
        "We didn't hear back in time. Check your connection and try again.",
      );
    }, 10_000);

    const recomputed =
      profileWeightKg != null && profileHeightCm != null && profileAge != null
        ? recomputeTargetsForActivity({
            sex: profileSex,
            weightKg: profileWeightKg,
            heightCm: profileHeightCm,
            age: profileAge,
            activityLevel: nextLevel,
            goal: profileGoal,
            planPace: profilePlanPace,
            nutritionStrategy: profileNutritionStrategy,
          })
        : null;

    const baseUpdate: Record<string, unknown> = { activity_level: nextLevel };
    const writeable: Record<string, unknown> = recomputed
      ? {
          ...baseUpdate,
          target_calories: recomputed.target_calories,
          // A2 provenance — activity-level recompute path. Only stamp when
          // we're actually rewriting target_calories. (migration 20260427110000)
          target_calories_set_at: new Date().toISOString(),
          target_calories_source: "recompute",
          target_protein: recomputed.target_protein,
          target_carbs: recomputed.target_carbs,
          target_fat: recomputed.target_fat,
          target_fiber_g: recomputed.target_fiber_g,
        }
      : baseUpdate;

    const { error: uErr } = await supabase
      .from("profiles")
      .update(writeable)
      .eq("id", userId);

    clearActivitySaveTimeout();

    // If the user already dismissed (cancel / backdrop / Android back) or
    // the watchdog fired, skip all UI state writes — they belong to a
    // dead session.
    if (activitySaveCancelledRef.current) {
      return;
    }
    setActivityPickerSaving(false);
    if (uErr) {
      Alert.alert("Couldn't save", "Please try again.");
      return;
    }
    setActivityLevel(nextLevel);
    setActivityPickerOpen(false);
    if (recomputed) {
      Alert.alert(
        "Activity level updated",
        `new calorie target ${recomputed.target_calories.toLocaleString()}`,
      );
    } else {
      Alert.alert("Activity level updated");
    }
  }, [
    userId,
    activityPickerSelection,
    activityLevel,
    profileAge,
    profileGoal,
    profileHeightCm,
    profileNutritionStrategy,
    profilePlanPace,
    profileSex,
    profileWeightKg,
    clearActivitySaveTimeout,
  ]);

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
    const result = await redeemPromo();
    if (result.ok) setUserTier(result.tier);
  }, [redeemPromo]);

  /**
   * 2026-05-01 (journey-architect P1) — cancel-flow handlers.
   *
   * `routeToManage` is the canonical RC handoff. Pulled out so both
   * the "Continue to manage" card on the prompt sheet AND any future
   * direct-cancel path can reuse the same fallback chain.
   *
   * `exportThenManage` runs the existing CSV export FIRST, then leaves
   * the prompt sheet open so the user can still tap "Continue to
   * manage" if they want. We never silently route them away after
   * export — the user is in charge of "I'm done with this" so they
   * can also just tap the X.
   */
  const routeToManage = useCallback(async () => {
    const result = await presentCustomerCenter();
    if (result.presented) return;
    const url = Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url).catch(() => {
      Alert.alert(
        "Couldn't open subscription settings",
        "Manage your Suppr subscription from the App Store / Play Store app.",
      );
    });
  }, []);

  const exportNutritionLogCsvAtCancel = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: entries, error } = await supabase
        .from("nutrition_entries")
        .select(
          "date_key, time_label, name, recipe_title, portion_multiplier, calories, protein, carbs, fat, fiber_g, source",
        )
        .eq("user_id", userId)
        .order("date_key", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        Alert.alert("Export failed", error.message);
        return;
      }
      const csv = nutritionLogToCsv(entries ?? []);
      const filename = nutritionLogCsvFilename();
      await Share.share({ message: csv, title: filename });
    } catch (e) {
      Alert.alert(
        "Export failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  }, [userId]);

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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Phase 2 / B1.1 — You sub-tab pill bar (Progress default,
          Settings + More siblings). */}
      <YouSubTabHeader />
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
            {/* PR-01 (audit 2026-04-28): Base tier display collapsed
                — legacy `userTier === "base"` rows render as "Free"
                since the user has no active paid entitlement. */}
            <View style={{
              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
              backgroundColor: userTier === "pro" ? Accent.primary + "18" : colors.border + "60",
            }}>
              <Text style={{
                fontSize: 13, fontWeight: "700",
                color: userTier === "pro" ? Accent.primary : colors.textSecondary,
              }}>
                {userTier === "pro" ? "Pro" : "Free"}
              </Text>
            </View>
            {authEmail ? <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{authEmail}</Text> : null}
          </View>
          {userTier !== "pro" && (
            <Pressable
              style={styles.row}
              onPress={() => router.push("/paywall?from=settings" as any)}
            >
              <Text style={[styles.rowLabel, { color: Accent.success }]}>View plans</Text>
              <ChevronRight size={16} color={Accent.success} strokeWidth={1.75} />
            </Pressable>
          )}
          {userTier !== "free" && (
            <Pressable
              testID="settings-manage-subscription-row"
              style={styles.row}
              onPress={() => {
                // 2026-05-01 (journey-architect P1) — surface the
                // export prompt at the cancel touchpoint instead of
                // routing straight to RC. The user can still continue
                // to manage in one tap; the export becomes proactive
                // rather than buried in Settings.
                setCancelPromptOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
            >
              <Text style={styles.rowLabel}>Manage subscription</Text>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
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
            <Mail size={18} color={colors.textTertiary} strokeWidth={1.75} />
          </Pressable>
          <Pressable
            style={[styles.row, styles.rowLast]}
            onPress={() => void supabase.auth.signOut()}
          >
            <Text style={[styles.rowLabel, { color: Accent.destructive }]}>Sign Out</Text>
            <LogOut size={18} color={Accent.destructive} strokeWidth={1.75} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Accent.primary} />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>Body & activity</Text>
            <View style={styles.card}>
              {/* Activity level row (build 10 fix E-2, 2026-04-19 —
                  TestFlight `AIIm60n` / `AHCSYMATS`). Opens a modal
                  with the live TDEE preview; writes activity_level +
                  recomputed target_calories via the shared helper. */}
              <Pressable
                testID="settings-activity-level-row"
                style={[styles.row, styles.rowLast]}
                onPress={openActivityPicker}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Activity level</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 }}>
                    Used to estimate your baseline calorie burn before workouts and steps.
                  </Text>
                </View>
                <Text
                  testID="settings-activity-level-value"
                  style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginRight: 8 }}
                >
                  {activityLevel ? ACTIVITY_SHORT_LABELS[activityLevel] : "Not set"}
                </Text>
                <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
              </Pressable>
            </View>

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
                    Adds bonus calories when your activity source shows you burned more than your estimated maintenance.
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
              {/* P3-30 (2026-04-25): net-carbs lens toggle. Mirrors the
                  web Settings toggle in src/app/components/Settings.tsx.
                  Tracker carbs tile + Recipe Detail nutrition row swap
                  "Carbs" → "Net carbs" via the shared
                  src/lib/nutrition/netCarbs.ts helper. */}
              <View style={[styles.row, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Show net carbs</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 }}>
                    Display “Net carbs” (carbs − fibre) on the Tracker and recipe pages. Useful for keto / low-carb tracking.
                  </Text>
                </View>
                <Switch
                  testID="settings-net-carbs-lens-toggle"
                  value={netCarbsLensEnabled}
                  onValueChange={async (v) => {
                    setNetCarbsLensEnabled(v);
                    if (userId) {
                      await supabase.from("profiles").update({ net_carbs_lens_enabled: v } as never).eq("id", userId);
                    }
                  }}
                  trackColor={{ true: Accent.primary }}
                />
              </View>
              {/*
                T13 (2026-04-24) — weight surface opt-out (DI-P0-03).
                Default = "show" so existing users see no change.
              */}
              <View style={[styles.row, { flexDirection: "column", alignItems: "stretch", gap: 10 }]}>
                <Text style={styles.rowLabel}>How weight shows up</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  Soften how weight appears on the Digest, Progress, and chart. We still save what you log.
                </Text>
                <View style={styles.segmentedRow}>
                  {(
                    [
                      { mode: "show" as const, label: "Show" },
                      { mode: "trends_only" as const, label: "Trends only" },
                      { mode: "hide" as const, label: "Hide" },
                    ]
                  ).map(({ mode, label }, idx, arr) => {
                    const selected = weightSurfaceMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        testID={`weight-surface-mode-${mode}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[
                          styles.segmentBtn,
                          selected && styles.segmentBtnActive,
                          idx < arr.length - 1 ? { borderRightWidth: 1, borderRightColor: colors.border } : null,
                        ]}
                        onPress={async () => {
                          const next: WeightSurfaceMode = mode;
                          setWeightSurfaceMode(next);
                          if (userId) {
                            await supabase
                              .from("profiles")
                              .update({ weight_surface_mode: next } as never)
                              .eq("id", userId);
                          }
                        }}
                        disabled={saving}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            selected && styles.segmentBtnTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
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
                label="Updates on your published recipes"
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
                <Text style={styles.rowLabel}>Open notifications</Text>
                <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.75} />
              </Pressable>
            </View>
            {saving ? <Text style={styles.saving}>Saving…</Text> : null}

            {/* Phase 2 / B1.4 (D-2026-04-27-08) — Tracking extras
                opt-in. Caffeine + alcohol Today widgets default OFF.
                Toggling on surfaces the corresponding row in the
                hydration card on Today and preserves any historical
                data unchanged. */}
            <Text style={styles.sectionTitle}>Tracking extras</Text>
            <View style={styles.card}>
              <Row
                label="Track caffeine"
                value={trackingExtras.trackCaffeine}
                onToggle={() => void persistTrackingExtras({ ...trackingExtras, trackCaffeine: !trackingExtras.trackCaffeine })}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Track alcohol"
                value={trackingExtras.trackAlcohol}
                onToggle={() => void persistTrackingExtras({ ...trackingExtras, trackAlcohol: !trackingExtras.trackAlcohol })}
                isLast
                styles={styles}
                colors={colors}
              />
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4, marginHorizontal: Spacing.md }}>
              Off by default. Hydration stays on regardless. When off,
              your existing logs are preserved but the row is hidden
              on Today.
            </Text>

            {/* About — houses the "What's new in Suppr" surface.
                Entry point per F-0 spec (2026-04-19): testers should
                have a single reliable place to see which of their
                feedback items shipped in the latest build. */}
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Pressable
                testID="settings-whats-new-row"
                style={[styles.row, styles.rowLast]}
                onPress={() => router.push("/whats-new" as any)}
                accessibilityRole="button"
                accessibilityLabel="What's new in Suppr"
              >
                <Text style={styles.rowLabel}>What&apos;s new in Suppr</Text>
                <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Data</Text>
            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={async () => {
                  if (!userId) return;
                  try {
                    const { nutritionEntriesToCsv } = await import("@/lib/exportCsv");
                    const { data: entries } = await supabase
                      .from("nutrition_entries")
                      .select("date_key, name, recipe_title, calories, protein, carbs, fat, fiber_g, source, time_label")
                      .eq("user_id", userId)
                      .order("date_key", { ascending: true });
                    const csv = nutritionEntriesToCsv(entries ?? []);
                    await Share.share({ message: csv, title: "Suppr Nutrition Export.csv" });
                  } catch (e) {
                    Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
                  }
                }}
              >
                <Text style={styles.rowLabel}>Export nutrition log (CSV)</Text>
                <Text style={{ color: Accent.primary, fontWeight: "600", fontSize: 14 }}>Export</Text>
              </Pressable>
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
                <Text style={styles.rowLabel}>Export all data (JSON)</Text>
                <Text style={{ color: Accent.primary, fontWeight: "600", fontSize: 14 }}>Export</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Group G IA Batch B (2026-04-29) — settings absorbs the
            More-tab body so every row reachable from /more is also
            reachable here. Decision doc:
            `docs/decisions/2026-04-28-group-g-ia-collapse.md`. The
            bundle owns its own state, loading, and modals. Some rows
            (Export CSV/JSON, Notifications) are also rendered above
            in the legacy Settings sections; intentional during
            B–D, the duplicates are removed in the post-D cleanup. */}
        <SettingsBundleContent context="settings" />
      </ScrollView>

      {/* Activity-level picker modal (build 10 fix E-2, 2026-04-19;
          dismiss-while-saving fixed 2026-04-30 modal-dismiss sweep). */}
      <Modal
        visible={activityPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={dismissActivityPicker}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss activity level picker"
            onPress={dismissActivityPicker}
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: Radius.xl,
              borderTopRightRadius: Radius.xl,
              paddingTop: Spacing.lg,
              paddingHorizontal: Spacing.xl,
              paddingBottom: insets.bottom + Spacing.lg,
              maxHeight: "90%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: Spacing.md,
              }}
            >
              <Pressable
                onPress={dismissActivityPicker}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                Activity level
              </Text>
              <Pressable
                onPress={() => void saveActivityLevel()}
                disabled={
                  activityPickerSaving ||
                  activityPickerSelection === activityLevel
                }
                hitSlop={12}
              >
                <Text
                  style={{
                    color:
                      activityPickerSaving ||
                      activityPickerSelection === activityLevel
                        ? colors.textTertiary
                        : Accent.primary,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {activityPickerSaving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              How active are you on a typical day?
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.md }}>
              Used to estimate your baseline calorie burn before workouts and steps.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ActivityLevelPreview
                sex={profileSex}
                weightKg={profileWeightKg}
                heightCm={profileHeightCm}
                age={profileAge}
                selected={activityPickerSelection}
                onSelect={setActivityPickerSelection}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2026-05-01 (journey-architect P1) — cancel-flow prompt sheet.
          Surfaces between "Manage subscription" tap and the RC handoff
          so the export option is proactive, not buried in Settings.
          See `apps/mobile/components/settings/CancelExportPromptSheet.tsx`. */}
      <CancelExportPromptSheet
        visible={cancelPromptOpen}
        onDismiss={() => setCancelPromptOpen(false)}
        onExport={async () => {
          // Run export FIRST. Leave the prompt open so the user can
          // still tap "Continue to manage" or dismiss after.
          await exportNutritionLogCsvAtCancel();
        }}
        onContinueToManage={async () => {
          setCancelPromptOpen(false);
          await routeToManage();
        }}
      />
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
