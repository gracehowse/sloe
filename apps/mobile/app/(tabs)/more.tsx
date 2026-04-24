import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, Linking, Share, Switch, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  Sparkles,
  Users,
  Flame,
  LayoutGrid,
  Calendar,
  Coffee,
  Wine,
  HeartPulse,
  Bell,
  Mail,
  Palette,
  Download,
  Code,
  HelpCircle,
  FileText,
  BookOpen,
  RefreshCw,
  Trash2,
  ChevronRight,
  Info,
  PlusCircle,
  CheckSquare,
  Square,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { GradientAvatar } from "@/components/GradientAvatar";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets, type ResolvedTargets } from "@/lib/calcTargets";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { getSupprWebBase } from "@/lib/supprWeb";
import { isHealthSyncAvailable } from "@/lib/healthSync";
import { nukeAllUserAppData, clearStructuredMealPlans } from "@/lib/nukeAccountData";
import { cancelWeeklyRecapPush } from "@/lib/weeklyRecapPush";
import { normaliseDietaryFromProfile } from "../../../../src/constants/dietaryPreferences";
import { saveWeekStartDay } from "../../../../src/lib/nutrition/weekStartDayClient";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { track } from "@/lib/analytics";
// G-6 (2026-04-19, TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`) — CSV export
// is the primary path for regular users. Shared helper so web + mobile
// emit identical CSV bytes (structural pin:
// `tests/unit/nutritionLogToCsv.test.ts`).
import {
  nutritionLogToCsv,
  nutritionLogCsvFilename,
} from "../../../../src/lib/export/nutritionLogToCsv";
// Household summary row — 2026-04-20 Claude Design prototype port
// (mirrors `screens-mobile.jsx` L723 + web Profile). Row hides when
// the user isn't in a household.
import { getMyHousehold } from "../../../../src/lib/household/householdClient";
import {
  presetFromShareLunch,
  sharingPresetShortLabel,
} from "../../../../src/lib/household/sharingGrid";
import {
  parseSharingStateJson,
  sharingStorageKey,
} from "../../../../src/lib/household/sharingGridStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ── Icon Box ──
 * Mirrors the prototype's `.meal-row .icon-box` (36×36, radius 10,
 * tinted bg). Used for every row on the More tab so spacing matches
 * the Plan / Today / Progress tab rows which already ported the same
 * prototype pattern.
 */
function IconBox({ color, size = 36, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

function openLegalPath(path: "/privacy" | "/terms") {
  const base = getSupprWebBase();
  if (!base) {
    Alert.alert("Unavailable", "Web URL is not configured in app settings.");
    return;
  }
  const url = `${base}${path}`;
  void Linking.openURL(url).catch(() => {
    Alert.alert("Could not open link", url);
  });
}

/* ── Section heading ──
 * Matches the prototype `.section-h h3` (14px, fw 700, fg). Kept as a
 * component so spacing (22px top, 10px bottom) stays identical across
 * every group on the screen. */
function SectionHeading({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: -0.1, marginTop: 22, marginBottom: 10 }}>
      {title}
    </Text>
  );
}

/* ── Settings Row ──
 * Visual port of the prototype's `.meal-row` for the More tab: 36×36
 * icon-box on the left, 13/11 two-line label, optional trailing badge
 * + chevron. First-row is borderless; all subsequent rows get a
 * top-border so the card renders a clean divider sequence regardless
 * of how the callsite orders rows.
 */
function SettingsRow({ icon: Icon, iconColor, label, sub, badge, isFirst, onPress }: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  sub?: string;
  badge?: string;
  isFirst?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.cardBorder,
      }}
    >
      <IconBox color={iconColor}>
        <Icon size={18} color={iconColor} strokeWidth={1.75} />
      </IconBox>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 17 }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {badge ? <Text style={{ fontSize: 11, color: colors.textTertiary }}>{badge}</Text> : null}
        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
      </View>
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
    usingDefaults: boolean;
    targetResolution: ResolvedTargets["resolution"];
    userTier: string;
    dietaryRestrictions: string[];
    notificationPref: string | null;
  }>({
    savedCount: 0,
    streak: 0,
    targetCalories: NUTRITION_DEFAULTS.calories,
    targetProtein: NUTRITION_DEFAULTS.protein,
    targetCarbs: NUTRITION_DEFAULTS.carbs,
    targetFat: NUTRITION_DEFAULTS.fat,
    usingDefaults: true,
    targetResolution: "fallback",
    userTier: "free",
    dietaryRestrictions: [],
    notificationPref: null,
  });

  /** Household summary — 2026-04-20 prototype port. `null` means "not
   * in a household" and hides the row. Loaded once on mount; refetch
   * tied to the existing focus effect below so leave/join flows in
   * the Plan tab update the subtitle immediately on return. */
  const [householdSummary, setHouseholdSummary] = useState<
    | { memberCount: number; subtitle: string }
    | null
  >(null);

  /** After first successful load, keep showing cached targets while refetching (avoids 2000 kcal flash). */
  const profileTargetsShownOnceRef = useRef(false);
  const [profileTargetsSubReady, setProfileTargetsSubReady] = useState(false);

  const loadProfileData = useCallback(() => {
    if (!userId) {
      profileTargetsShownOnceRef.current = false;
      setProfileTargetsSubReady(true);
      return;
    }
    if (!profileTargetsShownOnceRef.current) {
      setProfileTargetsSubReady(false);
    }
    void (async () => {
      try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, dietary, notification_prefs, user_tier, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace",
        )
        .eq("id", userId)
        .maybeSingle();

      if (profileErr || !profile) {
        setProfileData((prev) => ({
          ...prev,
          usingDefaults: true,
          targetResolution: "fallback",
          targetCalories: NUTRITION_DEFAULTS.calories,
          targetProtein: NUTRITION_DEFAULTS.protein,
          targetCarbs: NUTRITION_DEFAULTS.carbs,
          targetFat: NUTRITION_DEFAULTS.fat,
        }));
        return;
      }

      let savedCount = 0;
      try {
        const { count } = await supabase
          .from("saves")
          .select("recipe_id", { count: "exact", head: true })
          .eq("user_id", userId);
        savedCount = count ?? 0;
      } catch {
        savedCount = 0;
      }

      let streak = 0;
      try {
        const { data: logs } = await supabase
          .from("nutrition_entries")
          .select("date_key")
          .eq("user_id", userId)
          .order("date_key", { ascending: false })
          .limit(60);
        if (logs && logs.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const uniqueDays = [...new Set(logs.map((l: { date_key: string }) => l.date_key))].sort((a: string, b: string) =>
            b.localeCompare(a),
          );
          for (const dayStr of uniqueDays) {
            const d = new Date(`${dayStr}T00:00:00`);
            const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
            if (diff === streak) streak++;
            else break;
          }
        }
      } catch {
        streak = 0;
      }

      const p = profile as Record<string, unknown>;
      const restrictions = normaliseDietaryFromProfile(p.dietary);
      const np = p.notification_prefs as { reminder_time?: unknown } | null | undefined;
      const notifTime = np && typeof np === "object" && np.reminder_time != null ? String(np.reminder_time) : null;

      const targets = resolveTargets(
        {
          target_calories: p.target_calories != null ? Number(p.target_calories) : null,
          target_protein: p.target_protein != null ? Number(p.target_protein) : null,
          target_carbs: p.target_carbs != null ? Number(p.target_carbs) : null,
          target_fat: p.target_fat != null ? Number(p.target_fat) : null,
          target_fiber_g: p.target_fiber_g != null ? Number(p.target_fiber_g) : null,
        },
        {
          weight_kg: p.weight_kg != null ? Number(p.weight_kg) : null,
          height_cm: p.height_cm != null ? Number(p.height_cm) : null,
          sex: typeof p.sex === "string" ? p.sex : null,
          activity_level: typeof p.activity_level === "string" ? p.activity_level : null,
          goal: typeof p.goal === "string" ? p.goal : null,
          dob: typeof p.dob === "string" ? p.dob : null,
          age: p.age != null ? Number(p.age) : null,
          plan_pace: typeof p.plan_pace === "string" ? p.plan_pace : null,
        },
      );

      setProfileData({
        savedCount,
        streak,
        targetCalories: targets.calories,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFat: targets.fat,
        usingDefaults: targets.usingDefaults,
        targetResolution: targets.resolution,
        userTier: (typeof p.user_tier === "string" ? p.user_tier : null) ?? "free",
        dietaryRestrictions: restrictions,
        notificationPref: notifTime,
      });
      } finally {
        setProfileTargetsSubReady(true);
        profileTargetsShownOnceRef.current = true;
      }
    })();
  }, [userId]);

  // Reload profile data whenever this tab gets focus (e.g. after editing profile)
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  // Load household summary (runs on mount + when userId changes).
  // Errors hide the row — never block the rest of the More tab.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHouseholdSummary(null);
      return () => {};
    }
    void (async () => {
      try {
        const { data: hh } = await getMyHousehold(supabase as any, userId);
        if (cancelled) return;
        if (!hh?.household) {
          setHouseholdSummary(null);
          return;
        }
        let preset = presetFromShareLunch(Boolean(hh.household.shareLunch));
        try {
          const raw = await AsyncStorage.getItem(sharingStorageKey(hh.household.id));
          const parsed = parseSharingStateJson(raw);
          if (parsed) preset = parsed.preset;
        } catch {
          // fall back to derived preset
        }
        const count = hh.members.length;
        if (!cancelled) {
          setHouseholdSummary({
            memberCount: count,
            subtitle: `${count} ${count === 1 ? "person" : "people"} · ${sharingPresetShortLabel(preset)}`,
          });
        }
      } catch {
        if (!cancelled) setHouseholdSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [weekStartPickerOpen, setWeekStartPickerOpen] = useState(false);
  const [trackedMacros, setTrackedMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [weekStartDay, setWeekStartDay] = useState<"sunday" | "monday">("monday");
  /** Batch 2.5 — hydration / stimulants targets + bottom-sheet state. */
  const [caffeineTargetPickerOpen, setCaffeineTargetPickerOpen] = useState(false);
  const [alcoholTargetPickerOpen, setAlcoholTargetPickerOpen] = useState(false);
  const [targetCaffeineMg, setTargetCaffeineMg] = useState<number>(400);
  const [targetAlcoholGWeekly, setTargetAlcoholGWeekly] = useState<number>(0);
  const [caffeineInput, setCaffeineInput] = useState<string>("400");
  const [alcoholInput, setAlcoholInput] = useState<string>("0");
  /** Batch 4.11 / H6 audit (2026-04-18) — weekly recap push toggle state.
   * `weeklyRecapPushEnabled` mirrors `profiles.weekly_recap_push_enabled`;
   * default true until hydrated from Supabase. The modal mounts its own
   * Switch which commits on tap — no Save button. */
  const [weeklyRecapPushEnabled, setWeeklyRecapPushEnabled] = useState<boolean>(true);
  const [weeklyRecapPushPickerOpen, setWeeklyRecapPushPickerOpen] = useState(false);

  // Load dashboard + hydration targets settings
  useEffect(() => {
    if (!userId) return;
    // Try new columns first; fall through to legacy select if the migration
    // hasn't landed on this environment yet.
    void (async () => {
      let resp = await supabase
        .from("profiles")
        .select(
          "tracked_macros, week_start_day, target_caffeine_mg, target_alcohol_g_weekly, weekly_recap_push_enabled",
        )
        .eq("id", userId)
        .maybeSingle();
      if (resp.error) {
        resp = await supabase
          .from("profiles")
          .select("tracked_macros, week_start_day")
          .eq("id", userId)
          .maybeSingle();
      }
      const { data } = resp;
      if (!data) return;
      if (data.tracked_macros && Array.isArray(data.tracked_macros)) {
        setTrackedMacros(data.tracked_macros as string[]);
      }
      if (data.week_start_day === "sunday" || data.week_start_day === "monday") {
        setWeekStartDay(data.week_start_day);
      }
      const tc = (data as any).target_caffeine_mg;
      if (typeof tc === "number" && Number.isFinite(tc) && tc >= 0) {
        setTargetCaffeineMg(Math.round(tc));
        setCaffeineInput(String(Math.round(tc)));
      }
      const ta = (data as any).target_alcohol_g_weekly;
      if (typeof ta === "number" && Number.isFinite(ta) && ta >= 0) {
        setTargetAlcoholGWeekly(Math.round(ta));
        setAlcoholInput(String(Math.round(ta)));
      }
      const wrp = (data as any).weekly_recap_push_enabled;
      if (wrp !== undefined) {
        // Default to true when the column is absent; only `false`
        // explicitly opts the user out.
        setWeeklyRecapPushEnabled(wrp !== false);
      }
    })();
  }, [userId]);

  const handleResetPlan = useCallback(async (clearData: boolean) => {
    if (!userId) return;
    setResetting(true);
    setResetModalOpen(false);

    try {
      if (clearData) {
        const r = await nukeAllUserAppData(supabase, userId);
        if (!r.ok) {
          Alert.alert("Could not erase data", r.message);
          return;
        }
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.multiRemove([
            "health_import_nutrition",
            "health_export_nutrition",
            "health_import_generic_labels",
            "health_sync_apple_connected",
          ]);
        } catch {
          /* ignore */
        }
      } else {
        const cleared = await clearStructuredMealPlans(supabase, userId);
        if (!cleared.ok) {
          Alert.alert("Reset failed", cleared.message);
          return;
        }
        const { error } = await supabase
          .from("profiles")
          .update({
            target_calories: NUTRITION_DEFAULTS.calories,
            // A2 provenance — "Reset plan" reverts to NUTRITION_DEFAULTS.
            // Tagged reset_default so Rule 2 (Maintenance Recalibrate) can
            // tell this apart from a real user-set target. (migration 20260427110000)
            target_calories_set_at: new Date().toISOString(),
            target_calories_source: "reset_default",
            target_protein: NUTRITION_DEFAULTS.protein,
            target_carbs: NUTRITION_DEFAULTS.carbs,
            target_fat: NUTRITION_DEFAULTS.fat,
            target_fiber_g: NUTRITION_DEFAULTS.fiber,
            target_water_ml: NUTRITION_DEFAULTS.water,
            onboarding_completed: false,
          })
          .eq("id", userId);
        if (error) {
          Alert.alert("Reset failed", error.message);
          return;
        }
      }

      router.replace("/onboarding" as any);
    } catch (e: unknown) {
      Alert.alert("Reset failed", e instanceof Error ? e.message : "Something went wrong. Please try again.");
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

  /* ── Display helpers ── */
  const avatarInitial = (
    session?.user?.user_metadata?.display_name?.[0] ??
    session?.user?.email?.[0] ??
    "S"
  ).toString().toUpperCase();
  const displayName =
    session?.user?.user_metadata?.display_name ??
    session?.user?.email?.split("@")[0] ??
    "Your Profile";
  const tierLabel =
    profileData.userTier === "pro" ? "Pro" : profileData.userTier === "base" ? "Base" : "Free";
  const tierBadgeColor =
    profileData.userTier === "pro"
      ? Accent.primary
      : profileData.userTier === "base"
        ? Accent.success
        : colors.textSecondary;
  const joinedLabel = (() => {
    const createdAt = session?.user?.created_at;
    if (!createdAt) return "Joined recently";
    const d = new Date(createdAt);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays < 7) return "Joined this week";
    if (diffDays < 30) return `Joined ${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `Joined ${Math.floor(diffDays / 30)}mo ago`;
    return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
    >
      {/* Phone-top header (prototype port 2026-04-20):
          ACCOUNT overline + big "More" title + circular avatar
          button top-right. Matches the Discover/Today/Progress
          phone-top treatment. */}
      <View style={{ paddingBottom: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1.4, textTransform: "uppercase" }}>
            Account
          </Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.6, marginTop: 2 }}>
            More
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile" as any)}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={10}
        >
          {/* Brand-gradient avatar (D7, 2026-04-21). Gradient is
              explicitly sanctioned on avatars per
              `docs/ux/brand-guidelines.md`; matches web
              `Profile.tsx` avatarGradient. */}
          <GradientAvatar
            size={40}
            initial={avatarInitial}
            fontSize={14}
            borderColor={colors.cardBorder}
            gradientIdSuffix="more-header"
          />
        </Pressable>
      </View>

      {/* Profile card — prototype top-card: gradient avatar + name/tier
          on the left, small tier badge chip on the right. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: 14,
          marginBottom: 4,
        }}
      >
        {/* Brand-gradient avatar (D7, 2026-04-21). See GradientAvatar
            for rationale; same treatment as the 40×40 top-right button
            so the two avatars on this screen read as one paint system. */}
        <GradientAvatar
          size={52}
          initial={avatarInitial}
          fontSize={18}
          gradientIdSuffix="more-card"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{displayName}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {tierLabel} tier · {joinedLabel}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: tierBadgeColor + "1a",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: tierBadgeColor, letterSpacing: 0.2 }}>
            {tierLabel}
          </Text>
        </View>
      </View>

      {/* 3 Stat Pills — real data */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {([
          [String(profileData.savedCount), "Recipes", t.accent, null],
          [String(profileData.streak), "Streak", t.green, null],
          [String(Math.min(100, Math.round(
            (Math.min(profileData.streak, 7) / 7) * 40 +
            (Math.min(profileData.savedCount, 10) / 10) * 30 +
            30 // base points for being active
          ))), "Score", t.amber, () => Alert.alert(
            "Your Suppr Score",
            "Your score (0–100) reflects how actively you're using Suppr.\n\n"
            + "• Logging streak — log meals consistently to build your streak (up to 40 pts)\n"
            + "• Saved recipes — save recipes to your library (up to 30 pts)\n"
            + "• Active account — you get 30 pts just for being here\n\n"
            + "Your score reflects how actively you use Suppr."
          )],
        ] as [string, string, string, (() => void) | null][]).map(([v, l, c, onPress]) => (
          <Pressable key={l} onPress={onPress ?? undefined} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: c }}>{v}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{l}</Text>
              {onPress ? <Info size={12} color={colors.textTertiary} strokeWidth={1.75} /> : null}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Membership — prototype treatment: upgrade row sits in its own
          card with a gradient-style icon-box (`.meal-row` with `hl: true`).
          Copy branches by tier so the pitch matches the feature map:
            - Free → Base gives unlimited recipes + multi-day plans;
              Pro adds AI photo/voice logging on top.
            - Base → only AI logging is the Pro-only upsell. Adaptive
              TDEE is ungated (landing-maintenance.md §Known monetisation
              gaps) so we never claim it here. */}
      {profileData.userTier !== "pro" ? (
        <>
          <SectionHeading title="Membership" />
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
            <Pressable
              onPress={() => router.push("/paywall?from=settings" as any)}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: Accent.primary + "22",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={18} color={Accent.primary} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  {profileData.userTier === "free" ? "Upgrade your plan" : "Upgrade to Pro"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {profileData.userTier === "free"
                    ? "Unlimited recipes, multi-day plans, and AI logging"
                    : "Unlock AI photo and voice logging with Pro"}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Everything else — 2026-04-20 prototype port. Single row
          (Household) rendered only when the user is in a household.
          Matches `screens-mobile.jsx` L723 ordering — household row
          lives above Targets / Health / Settings. */}
      {householdSummary ? (
        <>
          <SectionHeading title="Everything else" />
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
            <SettingsRow
              isFirst
              icon={Users}
              iconColor={t.accent}
              label="Household"
              sub={householdSummary.subtitle}
              onPress={() => router.push("/household-settings" as any)}
            />
          </View>
        </>
      ) : null}

      {/* Goals & Targets */}
      <SectionHeading title="Goals & targets" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow
          isFirst
          icon={Flame}
          iconColor={t.accent}
          label="Daily targets"
          sub={
            !profileTargetsSubReady
              ? "Loading…"
              : (() => {
                  const macro = `${profileData.targetProtein}P / ${profileData.targetCarbs}C / ${profileData.targetFat}F`;
                  const k = `${profileData.targetCalories.toLocaleString()} kcal`;
                  if (profileData.targetResolution === "fallback") return `${k} (defaults) · Tap to personalise`;
                  if (profileData.targetResolution === "computed") return `${k} (from your stats) · ${macro}`;
                  return `${k} · ${macro}`;
                })()
          }
          onPress={() => router.push("/targets" as any)}
        />
        <SettingsRow icon={LayoutGrid} iconColor={t.accent} label="Dashboard widgets" sub={trackedMacros.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")} onPress={() => setWidgetPickerOpen(true)} />
        <SettingsRow icon={Calendar} iconColor={t.accent} label="Week starts on" sub={weekStartDay === "monday" ? "Monday" : "Sunday"} onPress={() => setWeekStartPickerOpen(true)} />
        <SettingsRow
          icon={Coffee}
          iconColor={t.accent}
          label="Caffeine limit"
          sub={`${targetCaffeineMg} mg/day · FDA guideline is 400 mg`}
          onPress={() => setCaffeineTargetPickerOpen(true)}
        />
        <SettingsRow
          icon={Wine}
          iconColor={t.accent}
          label="Alcohol limit"
          sub={targetAlcoholGWeekly > 0 ? `${targetAlcoholGWeekly} g/week` : "Off · set a target to show the row"}
          onPress={() => setAlcoholTargetPickerOpen(true)}
        />
      </View>

      {/* Connections */}
      <SectionHeading title="Connections" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow isFirst icon={HeartPulse} iconColor={t.green} label="Apple Health" sub={isHealthSyncAvailable() ? "Connected" : "Not connected"} onPress={() => router.push("/health-sync" as any)} />
        <SettingsRow
          icon={Bell}
          iconColor={t.accent}
          label="Notifications"
          sub={profileData.notificationPref ? `Daily reminder at ${profileData.notificationPref}` : "Off"}
          onPress={() => router.push("/(tabs)/notifications" as any)}
        />
        {/* Weekly recap push toggle (Batch 4.11 — H6 audit fix, 2026-04-18).
          * Gives the user a first-class opt-out surface matching web
          * Settings. The Progress-visit scheduler still runs as a
          * defensive fallback, but this row is the primary control. */}
        <SettingsRow
          icon={Mail}
          iconColor={t.accent}
          label="Weekly recap"
          sub={
            weeklyRecapPushEnabled
              ? `${weekStartDay === "monday" ? "Sunday" : "Saturday"} 18:00 (respects your week start)`
              : "Off · re-enable to get the Sun/Sat 18:00 nudge"
          }
          onPress={() => setWeeklyRecapPushPickerOpen(true)}
        />
      </View>

      {/* Recipes */}
      <SectionHeading title="Recipes" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow isFirst icon={PlusCircle} iconColor={t.green} label="Create recipe" sub="Build and share a recipe" onPress={() => router.push("/create-recipe" as any)} />
      </View>

      {/* App */}
      <SectionHeading title="App" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow
          isFirst
          icon={Palette}
          iconColor={t.accent}
          label="Appearance"
          sub="Theme and display"
          onPress={() => router.push("/(tabs)/settings" as any)}
        />
        {/* G-6 (2026-04-19, TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`) —
            CSV is the primary export path; JSON stays for full
            backup / developer use. The single "Export Data" row was
            replaced with two, not hidden behind a sub-menu, because
            the tester's ask was about visibility of the option, not
            its placement. */}
        <SettingsRow
          icon={Download}
          iconColor={t.accent}
          label="Export nutrition log (CSV)"
          sub="Spreadsheet-friendly. Opens in Numbers, Excel, or Google Sheets."
          onPress={async () => {
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
              // Share.share on iOS/Android surfaces a native sheet. We
              // pass the CSV body as the message so the user can paste
              // into Numbers/Excel/Sheets. A file-backed share via
              // expo-file-system is a follow-up if message-size becomes
              // a problem for power users with multi-year logs.
              await Share.share({ message: csv, title: filename });
            } catch (e) {
              Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
            }
          }}
        />
        <SettingsRow
          icon={Code}
          iconColor={colors.textTertiary}
          label="Export all data (JSON)"
          sub="Full backup for developers or migration."
          onPress={async () => {
            if (!userId) return;
            try {
              const [{ data: profile }, { data: entries }, { data: recipes }] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
                supabase.from("nutrition_entries").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
                supabase.from("saves").select("recipe_id").eq("user_id", userId),
              ]);
              const payload = JSON.stringify({ exportedAt: new Date().toISOString(), profile, entries, savedRecipeIds: recipes?.map((r: any) => r.recipe_id) ?? [] }, null, 2);
              await Share.share({ message: payload, title: "Suppr Data Export" });
            } catch (e) {
              Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
            }
          }}
        />
        <SettingsRow icon={HelpCircle} iconColor={t.accent} label="Help & information" sub="How it works, disclaimers, sources" onPress={() => {
          const base = getSupprWebBase();
          if (base) void Linking.openURL(`${base}/help`).catch(() => {});
          else void Linking.openURL("mailto:privacy@suppr-club.com").catch(() => {});
        }} />
      </View>

      {/* Legal */}
      <SectionHeading title="Legal" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow isFirst icon={FileText} iconColor={t.accent} label="Privacy policy" sub="How we use your data" onPress={() => openLegalPath("/privacy")} />
        <SettingsRow icon={BookOpen} iconColor={t.accent} label="Terms of use" sub="Service agreement" onPress={() => openLegalPath("/terms")} />
      </View>

      {/* F-49 (2026-04-22): visible build-stamp so we can diagnose what's
          actually installed. `BUILD_MARKER` is a fresh unique string every
          build so we can grep it in feedback screenshots to confirm which
          binary is running on a tester's device. */}
      <SectionHeading title="Build" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 14 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
          {`v${(Constants.expoConfig?.version ?? "?")} · build ${((Constants as unknown as { nativeBuildVersion?: string }).nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber ?? "?")} · MARKER F50-2026-04-22`}
        </Text>
      </View>

      {/* Danger zone */}
      <SectionHeading title="Danger zone" />
      <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
        <SettingsRow
          isFirst
          icon={RefreshCw}
          iconColor={t.amber}
          label="Reset or erase everything"
          sub="New targets, or wipe log, library & plans"
          onPress={() => setResetModalOpen(true)}
        />
        <SettingsRow
          icon={Trash2}
          iconColor={t.red}
          label="Erase all app data…"
          sub="Journal, library, plans, shopping — opens reset options"
          onPress={() => setResetModalOpen(true)}
        />
      </View>

      {/* Sign Out — kept as a standalone destructive button beneath the
          card stack so the action stays obvious and reachable after
          long-scroll. */}
      <Pressable
        onPress={() => void supabase.auth.signOut()}
        style={{ paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: t.red + "40", alignItems: "center", marginTop: 22 }}
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
              <View style={{ width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: t.amber + "18", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md }}>
                <RefreshCw size={24} color={t.amber} strokeWidth={1.75} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" }}>Reset or start over</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, maxWidth: 300, lineHeight: 18 }}>
                Reset targets clears your planner and defaults your goals while keeping your food log and saved recipes. Erase everything also removes journal entries, library saves, shopping lists, your private imported recipes, and synced activity summaries stored on Suppr — then sends you through onboarding again. Your account and subscription tier stay as they are.
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
              <Text style={{ color: t.red, fontWeight: "700", fontSize: 15 }}>Erase all app data</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2, textAlign: "center", paddingHorizontal: 12 }}>
                Journal, library, plans, shopping, private recipes, notifications
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  "Delete your account?",
                  "This will permanently delete your account, all data, and sign you out. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete Account",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const { data: sessionData } = await supabase.auth.getSession();
                          const token = sessionData?.session?.access_token;
                          const base = getSupprWebBase();
                          if (!base) {
                            Alert.alert("Error", "API URL not configured. Please contact support.");
                            return;
                          }
                          const res = await fetch(`${base}/api/account/delete`, {
                            method: "DELETE",
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          });
                          const json = await res.json();
                          if (json.ok) {
                            await supabase.auth.signOut();
                            Alert.alert("Account deleted", "Your account has been permanently deleted.");
                          } else {
                            Alert.alert("Deletion failed", json.error || "Please try again.");
                          }
                        } catch {
                          Alert.alert("Deletion failed", "Please try again later.");
                        }
                      },
                    },
                  ],
                );
              }}
              style={{ paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: t.red, fontWeight: "800", fontSize: 15 }}>Delete my account permanently</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2, textAlign: "center", paddingHorizontal: 12 }}>
                Removes your account, all data, and signs you out
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
              { key: "protein", label: "Protein", color: MacroColors.protein },
              { key: "carbs", label: "Carbs", color: MacroColors.carbs },
              { key: "fat", label: "Fat", color: MacroColors.fat },
              { key: "fiber", label: "Fiber", color: MacroColors.fiber },
              { key: "sugar", label: "Sugar", color: MacroColors.sugar },
              { key: "sodium", label: "Sodium", color: MacroColors.sodium },
              { key: "water", label: "Water", color: MacroColors.water },
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
                  {isActive ? (
                    <CheckSquare size={22} color={Accent.primary} strokeWidth={1.75} />
                  ) : (
                    <Square size={22} color={colors.textTertiary} strokeWidth={1.75} />
                  )}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setWidgetPickerOpen(false)} style={{ marginTop: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Accent.primary, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Caffeine target picker (Batch 2.5) */}
      <Modal visible={caffeineTargetPickerOpen} transparent animationType="slide" onRequestClose={() => setCaffeineTargetPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setCaffeineTargetPickerOpen(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.xl }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Caffeine limit</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.lg }}>FDA upper bound for healthy adults is 400 mg/day. Set your own comfortable ceiling.</Text>
            <TextInput
              accessibilityLabel="Caffeine limit in milligrams per day"
              keyboardType="number-pad"
              value={caffeineInput}
              onChangeText={setCaffeineInput}
              placeholder="400"
              placeholderTextColor={colors.textTertiary}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text }}
            />
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>Example: 400 mg ≈ 4 cups of coffee.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save caffeine limit"
              onPress={async () => {
                const n = Math.max(0, Math.min(2000, Math.round(Number(caffeineInput))));
                if (Number.isNaN(n)) {
                  setCaffeineInput(String(targetCaffeineMg));
                  return;
                }
                setTargetCaffeineMg(n);
                setCaffeineInput(String(n));
                if (userId) {
                  const { error } = await supabase.from("profiles").update({ target_caffeine_mg: n }).eq("id", userId);
                  if (error) Alert.alert("Could not save", error.message);
                }
                setCaffeineTargetPickerOpen(false);
              }}
              style={{ marginTop: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Accent.primary, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Alcohol target picker (Batch 2.5) */}
      <Modal visible={alcoholTargetPickerOpen} transparent animationType="slide" onRequestClose={() => setAlcoholTargetPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setAlcoholTargetPickerOpen(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.xl }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Alcohol limit (g/week)</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.lg }}>
              Set 0 to hide the alcohol row. 14 g ethanol ≈ 1 US standard drink. 196 g/week = 14 UK units.
            </Text>
            <TextInput
              accessibilityLabel="Alcohol limit in grams per week"
              keyboardType="number-pad"
              value={alcoholInput}
              onChangeText={setAlcoholInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save alcohol limit"
              onPress={async () => {
                const n = Math.max(0, Math.min(2000, Math.round(Number(alcoholInput))));
                if (Number.isNaN(n)) {
                  setAlcoholInput(String(targetAlcoholGWeekly));
                  return;
                }
                setTargetAlcoholGWeekly(n);
                setAlcoholInput(String(n));
                if (userId) {
                  const { error } = await supabase.from("profiles").update({ target_alcohol_g_weekly: n }).eq("id", userId);
                  if (error) Alert.alert("Could not save", error.message);
                }
                setAlcoholTargetPickerOpen(false);
              }}
              style={{ marginTop: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Accent.primary, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Weekly Recap Push Picker (Batch 4.11 — H6 audit fix, 2026-04-18) */}
      <Modal
        visible={weeklyRecapPushPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWeeklyRecapPushPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onPress={() => setWeeklyRecapPushPickerOpen(false)}
          />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.xl }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Weekly recap</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.lg }}>
              Get a one-tap summary of your week on {weekStartDay === "monday" ? "Sunday" : "Saturday"} evening. Off by choice — no reminder will be sent.
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Send weekly recap</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {weeklyRecapPushEnabled
                    ? "On · next push lands at the end of your week"
                    : "Off · no push will be scheduled"}
                </Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel="Weekly recap push notifications"
                accessibilityState={{ checked: weeklyRecapPushEnabled }}
                value={weeklyRecapPushEnabled}
                onValueChange={(next) => {
                  const previous = weeklyRecapPushEnabled;
                  if (previous === next) return;
                  // Optimistic flip so the Switch animates immediately.
                  setWeeklyRecapPushEnabled(next);
                  if (!userId) {
                    setWeeklyRecapPushEnabled(previous);
                    Alert.alert("Sign in required", "Sign in to change this preference.");
                    return;
                  }
                  void (async () => {
                    const { error } = await supabase
                      .from("profiles")
                      .update({ weekly_recap_push_enabled: next })
                      .eq("id", userId);
                    if (error) {
                      setWeeklyRecapPushEnabled(previous);
                      Alert.alert(
                        "Could not save",
                        "We couldn't save your preference. Please try again.",
                      );
                      return;
                    }
                    // Mobile-local scheduling was removed 2026-04-20
                    // (see docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md).
                    // Server cron at `app/api/push/weekly-recap/route.ts`
                    // reads `profiles.weekly_recap_push_enabled` and
                    // owns delivery. OFF still cancels any stale
                    // pre-kill local schedule lingering in the OS
                    // queue; ON is a DB-only toggle.
                    if (!next) {
                      try {
                        await cancelWeeklyRecapPush();
                      } catch {
                        // captureException inside the helper already
                        // routes OS errors; never revert the DB toggle.
                      }
                    }
                    track(AnalyticsEvents.weekly_recap_push_enabled_toggled, {
                      enabled: next,
                    });
                  })();
                }}
                trackColor={{ false: colors.border, true: Accent.primary }}
              />
            </View>
            <Pressable
              onPress={() => setWeeklyRecapPushPickerOpen(false)}
              style={{ marginTop: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Accent.primary, alignItems: "center" }}
            >
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.lg }}>Week starts on</Text>
            {(["monday", "sunday"] as const).map((day) => (
              <Pressable
                key={day}
                onPress={() => {
                  const previous = weekStartDay;
                  // No-op re-taps and the initial hydrated value must
                  // stay silent in analytics — only actual changes fire.
                  if (previous === day) {
                    setWeekStartPickerOpen(false);
                    return;
                  }
                  setWeekStartDay(day);
                  setWeekStartPickerOpen(false);
                  if (!userId) return;
                  void (async () => {
                    // Shared helper — locks the update shape in sync with
                    // the web settings screen (M11 audit, 2026-04-18).
                    try {
                      await saveWeekStartDay(supabase, userId, day);
                    } catch {
                      setWeekStartDay(previous);
                      Alert.alert("Could not save", "We couldn't save your week-start preference. Please try again.");
                      return;
                    }
                    track(AnalyticsEvents.week_start_day_changed, {
                      from: previous,
                      to: day,
                    });
                  })();
                }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.text }}>{day === "monday" ? "Monday" : "Sunday"}</Text>
                {weekStartDay === day && <CheckCircle2 size={22} color={Accent.primary} strokeWidth={1.75} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
