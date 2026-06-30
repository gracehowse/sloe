import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
// 2026-05-01 (P0-1, `claude/settings-mobile-structural-fix`) — the
// bundle now owns Manage subscription + promo-code redemption. Pre-
// fix these lived in the legacy in-file Plan section in
// `/(tabs)/settings.tsx`; the structural collapse moved them into
// the canonical Membership card so the bundle is the single source
// of truth.
import { presentCustomerCenter } from "@/lib/purchases";
import { CancelExportPromptSheet } from "@/components/settings/CancelExportPromptSheet";
import { DeleteAccountSheet } from "@/components/settings/DeleteAccountSheet";
import { useDeleteAccountSheet } from "@/components/settings/useDeleteAccountSheet";
import { usePromoCode } from "@/hooks/usePromoCode";
import {
  AlignLeft,
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CheckSquare,
  Code,
  Coffee,
  Download,
  FileText,
  Flame,
  EyeOff,
  HeartPulse,
  HelpCircle,
  LayoutGrid,
  Mail,
  Moon,
  Package,
  Palette,
  PlusCircle,
  RefreshCw,
  Smartphone,
  Sparkles,
  Square,
  Sun,
  Timer,
  User,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Accent, FontFamily, MacroColors, MacroColorsDark, Radius, Spacing } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { CARD_RADIUS, SHEET_RADIUS, TILE_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets, type ResolvedTargets } from "@/lib/calcTargets";
import { computeProtectedStreak, readFreezeLedger } from "@/lib/streakFreeze";
import { useAuth } from "@/context/auth";
import { useTheme, type ThemePreference } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import {
  useMacroDisplayStyle,
  type MacroDisplayStyle,
} from "@/lib/macroDisplayStyle";
import { MACRO_DISPLAY_OPTIONS } from "@suppr/shared/preferences/macroDisplayStyle";
import { useCalmMode } from "@/lib/calmMode";
import { supabase } from "@/lib/supabase";
import { fastingWindowLabel } from "@suppr/shared/fasting/milestones";
import { getSupprWebBase } from "@/lib/supprWeb";
import { probeHealthAccess } from "@/lib/healthSync";
import { nukeAllUserAppData } from "@suppr/shared/account/nukeAccountData";
import { cancelWeeklyRecapPush } from "@/lib/weeklyRecapPush";
import { normaliseDietaryFromProfile } from "../../../../src/constants/dietaryPreferences";
import { saveWeekStartDay } from "@suppr/nutrition-core/weekStartDayClient";
import {
  MEAL_SLOT_PRESET_OPTIONS,
  parseUserMealSlotConfig,
  type MealSlotPreset,
} from "@suppr/nutrition-core/userMealSlotConfig";
import { parsePantryStaples } from "@suppr/shared/planning/pantryStaples";
import {
  normalizeWeekSummaryMode,
  type WeekSummaryMode,
} from "@suppr/nutrition-core/weekSummaryWindow";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { saveDisplayName } from "@suppr/shared/account/displayName";
import { track, isFeatureEnabled } from "@/lib/analytics";
import {
  nutritionLogToCsv,
  nutritionLogCsvFilename,
} from "@suppr/shared/export/nutritionLogToCsv";
import { exportEverythingToFile } from "@/lib/exportEverything";
import { MobileMfpCsvImportCard } from "../imports/MfpCsvImportCard";
import {
  DEFAULT_TRACKING_EXTRAS,
  TRACKING_EXTRAS_STORAGE_KEY,
  parseTrackingExtras,
  serializeTrackingExtras,
  type TrackingExtras,
} from "@suppr/nutrition-core/trackingExtras";
import { getMyHousehold } from "@suppr/shared/household/householdClient";
import {
  presetFromShareLunch,
  sharingPresetShortLabel,
} from "@suppr/shared/household/sharingGrid";
import {
  parseSharingStateJson,
  sharingStorageKey,
} from "@suppr/shared/household/sharingGridStorage";
import { IconBox, SettingsRow } from "./SettingsRow";
import { BarcodeContributionsSection } from "./BarcodeContributionsSection";

/**
 * SettingsBundleContent — shared body of the legacy "More" tab.
 *
 * Why this exists: the Group G IA collapse
 * (`docs/decisions/2026-04-28-group-g-ia-collapse.md`) renders the
 * same set of sections on both `/(tabs)/more` and `/(tabs)/settings`
 * during Batch B → D. After Batch D, only `/settings` keeps it.
 *
 * Caller responsibilities:
 *   - Provide a parent `<ScrollView>` (modals self-portal so order
 *     within the tree is irrelevant).
 *   - Render the screen-specific phone-top header above this bundle.
 *
 * The bundle owns its own state (profile fetch, household summary,
 * dashboard widgets, week-start, caffeine/alcohol targets, weekly
 * recap toggle, all six modals).
 */

type Context = "more" | "settings";

const HOUSEHOLD_ROW_TEST_ID = "settings-household-row";

/**
 * Sloe warm-slab corner radius for every Settings section card — the
 * canonical `CARD_RADIUS` (24) from `SupprCard`, mirroring web
 * `var(--radius-card-lg)`. Bumped from the legacy 14 in the Settings
 * reskin so the cards carry the same rounded slab silhouette as the
 * Today / Recipes cards (Figma 09 Settings `335:2`).
 */
const SETTINGS_CARD_RADIUS = CARD_RADIUS;

function SectionHeading({ title }: { title: string }) {
  const accent = useAccent();
  const colors = useThemeColors();
  // Sloe DS (Figma 09 Settings `335:2`): section headers are small
  // ALL-CAPS grey eyebrows (GOALS & TARGETS / DISPLAY / CONNECTIONS /
  // REMINDERS / ACCOUNT), letter-spaced — the iOS-grouped-list pattern
  // in the frame. Was Newsreader serif plum 19px; the uppercase eyebrow
  // groups more aggressively + reads faster (design-system §2.2
  // `section-eyebrow`: Inter 10–11pt, +0.08em tracking, muted). The
  // serif plum is reserved for the screen title + profile name.
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: FontFamily.sansSemibold,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: "600",
        color: colors.textSecondary,
        letterSpacing: 0.9,
        textTransform: "uppercase",
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 2,
      }}
    >
      {title}
    </Text>
  );
}

/**
 * SettingsCard — ENG-823 (Redesign — Design Direction 2026, soft elevation in
 * Settings).
 *
 * Every section card in the bundle was a hand-rolled `<View>` repeating the
 * same `bg-card + radius-14 + hairline border` recipe (~13 copies). The 5-spine
 * direction (one elevation model) wants every resting card on the SAME
 * soft-ambient-shadow / tonal-lift treatment via `useCardElevation`, gated
 * behind `design_system_elevation`. Consolidating into one wrapper:
 *   - applies the flag-aware shadow / border / tonal-lift in one place
 *     (flag OFF → today's flat hairline-bordered card, unchanged), and
 *   - kills the 13x duplication so the next elevation change is a one-liner.
 *
 * `overflow: "hidden"` is the default because the bundle cards clip their row
 * dividers (`borderTopWidth` between rows). NOTE: iOS clips drop-shadows under
 * `overflow: "hidden"`, so on the light soft-elevation path the shadow is moved
 * to an OUTER wrapper (`shadowStyle` on the outer, clip on the inner) — same
 * technique `SupprCard` uses.
 */
function SettingsCard({
  children,
  style,
  testID,
  flashStyle,
}: {
  children: React.ReactNode;
  /** Extra style for the inner (clipping) card — padding, flexDirection, etc. */
  style?: import("react-native").ViewStyle;
  testID?: string;
  /** ENG-824 win-colour wash spread (overrides bg + border colour). */
  flashStyle?: import("react-native").ViewStyle;
}) {
  const colors = useThemeColors();
  // One-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-
  // soft-elevation.md): every Settings section card sits directly on the page
  // ground, so it takes the SOFT lift (light → cardSoft penumbra; dark → tonal
  // lift + hairline) rather than the flat slab. Was `useCardElevation()` (flat,
  // the 2026-06-04 slabs era) — flat re-introduced the "cards blend into the
  // page" read on the near-tonal #F6F5F2-on-#FFFFFF pairing. Mirrors web
  // `.card-slab` on the Settings section cards.
  const { shadowStyle, useBorder, liftBg } = useCardElevation({ variant: "soft" });

  const inner = (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: liftBg ?? colors.card,
          // Sloe warm-slab corner — 24px (mirrors web
          // `var(--radius-card-lg)` + mobile `CARD_RADIUS`/`TILE_RADIUS`).
          // Was 14 (the IA + palette drift the Settings reskin closes).
          borderRadius: SETTINGS_CARD_RADIUS,
          borderWidth: useBorder ? 1 : 0,
          borderColor: colors.cardBorder,
          overflow: "hidden",
        },
        style,
        flashStyle,
      ]}
    >
      {children}
    </View>
  );

  // Light soft-elevation: shadow must live on a non-clipping outer wrapper so
  // iOS doesn't clip it. Dark / flag-off: no shadow → render the card directly.
  if (shadowStyle) {
    return (
      <View style={[shadowStyle, { borderRadius: SETTINGS_CARD_RADIUS }]}>
        {inner}
      </View>
    );
  }
  return inner;
}

/** A segmented-control row inside the Display & extras card. Used
 *  for the macro-display style (tiles / bars) and theme preference
 *  (auto / light / dark) pickers added 2026-05-17. Visual treatment
 *  follows the same row shape as the SettingsRow + Switch pattern
 *  above so the section reads consistently. */
function SegmentedRow({
  icon: Icon,
  iconColor,
  label,
  description,
  options,
  value,
  onChange,
  colors,
  testID,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  description?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  colors: ReturnType<typeof useThemeColors>;
  testID?: string;
}) {
  const accent = useAccent();
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
        gap: 10,
      }}
      testID={testID}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconBox color={iconColor}>
          <Icon size={18} color={iconColor} strokeWidth={1.75} />
        </IconBox>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.text,
              lineHeight: 17,
            }}
          >
            {label}
          </Text>
          {description ? (
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.cardBorder,
          borderRadius: 8,
          padding: 2,
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${opt.label}`}
              testID={`${testID ?? "settings-segmented"}-option-${opt.value}`}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 6,
                // Active segment — white lift on the warm-grey rail (Sloe
                // treatment #8, 2026-06-08).
                backgroundColor: active ? colors.card : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? "700" : "500",
                  // Active label reads in `accent.primarySolid` (aubergine);
                  // inactive stays muted on the rail (treatment #8).
                  color: active ? accent.primarySolid : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

export function SettingsBundleContent({ context }: { context: Context }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Pro/upgrade
  // affordances, settings-toggle switch tracks, section accents, and primary
  // CTAs. Destructive actions (sign out / delete) keep `Accent.destructive`;
  // status keeps success/warning; macros keep `MacroColors`.
  const accent = useAccent(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  // One-card-treatment (2026-06-09): soft chrome for the page-ground stat
  // tiles (Recipes / Streak), matching the SettingsCard sections around them.
  // Tile-class rule (2026-06-10): stat tiles are flat-tonal, not lifted.
  const statTileElevation = useCardElevation();
  // ENG-1081 (Grace 2026-06-13: "flat white for now, maybe circle back"): the Pro
  // banner's aubergine soft-tint read as a lone grey card beside white siblings.
  // White slab by default; tint kept behind the flag-off path. NOTE: conversion
  // surface — flat white may soften the upgrade pull; the flag enables an
  // Option-C accent revisit without a revert. Web parity: Settings.tsx.
  const cohesionWhite = isFeatureEnabled("card_cohesion_white_v1");
  const userId = session?.user?.id ?? null;

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

  const [householdSummary, setHouseholdSummary] = useState<
    { memberCount: number; subtitle: string } | null
  >(null);

  // Keep showing cached targets while refetching to avoid a 2000 kcal flash.
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
            "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, dietary, notification_prefs, user_tier, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace, streak_freezes_earned_at, streak_freezes_used_history, streak_freeze_budget_max",
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

        // Debug audit 2026-05-04 (customer-lens P0 #1): Settings used
        // to compute streak via a hand-rolled algorithm against
        // nutrition_entries (limit 60, local date math, no freeze
        // ledger). Today / Progress / Recap all compute via the shared
        // `computeProtectedStreak` helper fed by the journal byDay
        // map. Result: same user, same day, two different streak
        // counts (Today "28-day streak", Settings "0 Streak"). Trust
        // killer flagged in customer-lens debug audit.
        // Now: hydrate a byDay map from nutrition_entries date_keys
        // (each row counted as one meal), pull the freeze ledger from
        // the profile select above, and route through the canonical
        // shared helpers — same path Today uses.
        let streak = 0;
        try {
          const { data: logs } = await supabase
            .from("nutrition_entries")
            .select("date_key")
            .eq("user_id", userId)
            .order("date_key", { ascending: false })
            .limit(400);
          const byDay: Record<string, Array<{ calories: number }>> = {};
          if (logs && logs.length > 0) {
            for (const l of logs as Array<{ date_key: string }>) {
              if (!l.date_key) continue;
              if (!byDay[l.date_key]) byDay[l.date_key] = [];
              byDay[l.date_key].push({ calories: 1 });
            }
          }
          const ledger = readFreezeLedger({
            earnedAt: (profile as { streak_freezes_earned_at?: unknown }).streak_freezes_earned_at,
            usedHistory: (profile as { streak_freezes_used_history?: unknown }).streak_freezes_used_history,
          });
          const budgetMaxRaw = (profile as { streak_freeze_budget_max?: unknown }).streak_freeze_budget_max;
          const budgetMax =
            typeof budgetMaxRaw === "number" && Number.isFinite(budgetMaxRaw) && budgetMaxRaw >= 0
              ? budgetMaxRaw
              : 3;
          streak = computeProtectedStreak(byDay as never, ledger, budgetMax).streakLength;
        } catch {
          streak = 0;
        }

        const p = profile as Record<string, unknown>;
        const restrictions = normaliseDietaryFromProfile(p.dietary);
        const np = p.notification_prefs as
          | { reminder_time?: unknown }
          | null
          | undefined;
        const notifTime =
          np && typeof np === "object" && np.reminder_time != null
            ? String(np.reminder_time)
            : null;

        const targets = resolveTargets(
          {
            target_calories:
              p.target_calories != null ? Number(p.target_calories) : null,
            target_protein:
              p.target_protein != null ? Number(p.target_protein) : null,
            target_carbs:
              p.target_carbs != null ? Number(p.target_carbs) : null,
            target_fat: p.target_fat != null ? Number(p.target_fat) : null,
            target_fiber_g:
              p.target_fiber_g != null ? Number(p.target_fiber_g) : null,
          },
          {
            weight_kg: p.weight_kg != null ? Number(p.weight_kg) : null,
            height_cm: p.height_cm != null ? Number(p.height_cm) : null,
            sex: typeof p.sex === "string" ? p.sex : null,
            activity_level:
              typeof p.activity_level === "string" ? p.activity_level : null,
            goal: typeof p.goal === "string" ? p.goal : null,
            dob: typeof p.dob === "string" ? p.dob : null,
            age: p.age != null ? Number(p.age) : null,
            plan_pace:
              typeof p.plan_pace === "string" ? p.plan_pace : null,
          },
        );

        const resolvedTier: "free" | "base" | "pro" = (() => {
          const t = typeof p.user_tier === "string" ? p.user_tier : null;
          return t === "free" || t === "base" || t === "pro" ? t : "free";
        })();
        setProfileData({
          savedCount,
          streak,
          targetCalories: targets.calories,
          targetProtein: targets.protein,
          targetCarbs: targets.carbs,
          targetFat: targets.fat,
          usingDefaults: targets.usingDefaults,
          targetResolution: targets.resolution,
          userTier: resolvedTier,
          dietaryRestrictions: restrictions,
          notificationPref: notifTime,
        });
        // Keep cached tier in sync from this surface so the next Plan
        // mount sees the latest value (sync-enforcer P0-7).
        void import("@/lib/cachedUserTier").then(({ saveCachedUserTier }) =>
          saveCachedUserTier(resolvedTier),
        );
      } finally {
        setProfileTargetsSubReady(true);
        profileTargetsShownOnceRef.current = true;
      }
    })();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

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
          const raw = await AsyncStorage.getItem(
            sharingStorageKey(hh.household.id),
          );
          const parsed = parseSharingStateJson(raw);
          if (parsed) preset = parsed.preset;
        } catch {
          // Fall back to the derived preset.
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

  // "Your name" — your display name (the avatar initial + Profile identity).
  // Source of truth is the Supabase auth user's `user_metadata.full_name`.
  // We pre-fill the input from the CURRENT metadata (full name, not just the
  // first token, so the user can edit "Grace Turner" rather than losing the
  // surname) and write back on commit via `supabase.auth.updateUser`.
  // Allowing an empty value clears the name. (Today shows a serif date hero
  // now, not a name greeting — ENG-1247.)
  const metadataFullName = (() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    for (const key of [
      "full_name",
      "name",
      "first_name",
      "preferred_name",
    ] as const) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  })();
  const [nameInput, setNameInput] = useState(metadataFullName);
  const [nameSaving, setNameSaving] = useState(false);
  // Re-seed the input when the session metadata changes underneath us
  // (e.g. another device updated it, or the post-save session refresh
  // lands) — but never clobber an in-flight edit the user is mid-typing.
  const nameDirtyRef = useRef(false);
  useEffect(() => {
    if (nameDirtyRef.current) return;
    setNameInput(metadataFullName);
  }, [metadataFullName]);

  /**
   * Persist the display name to the auth user's `user_metadata.full_name`
   * (NOT a `profiles` column — the tier-lockdown trigger rejects rows that
   * touch entitlement columns, and the display name lives in metadata anyway).
   * Trims input; an empty/whitespace value clears the name. After a
   * successful write we force a session refresh so the avatar / Profile
   * re-render without an app restart (the auth context's `onAuthStateChange`
   * re-emits the session). No-ops when the trimmed value already matches
   * what's stored.
   */
  const handleSaveName = useCallback(async () => {
    if (!userId) return;
    if (nameSaving) return;
    setNameSaving(true);
    try {
      const result = await saveDisplayName(
        supabase,
        nameInput,
        metadataFullName,
      );
      if (!result.ok) {
        Alert.alert("Couldn't save your name", result.message);
        return;
      }
      nameDirtyRef.current = false;
      // Normalise the visible value (strip trailing spaces) regardless of
      // whether a write happened.
      setNameInput(result.value);
      if (result.changed) {
        // Refresh the in-memory session so the avatar / Profile pick up the
        // new metadata immediately. `getSession()` re-reads from local storage
        // (which updateUser has already written), and the auth context's
        // listener fans the fresh session out.
        try {
          await supabase.auth.getSession();
        } catch {
          // Non-fatal: updateUser fired USER_UPDATED which the auth context
          // also listens for, so the session still refreshes.
        }
      }
    } finally {
      setNameSaving(false);
    }
  }, [userId, nameSaving, nameInput, metadataFullName]);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  // 2026-05-12 (premium-bar audit DC9): type-confirm gate for the
  // Erase Everything destructive path. `eraseConfirmOpen` controls
  // the modal; `eraseConfirmInput` is the user's typed string and
  // must equal "RESET" before the CTA enables.
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);
  const [eraseConfirmInput, setEraseConfirmInput] = useState("");
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [weekStartPickerOpen, setWeekStartPickerOpen] = useState(false);
  const [mealSlotPreset, setMealSlotPreset] = useState<MealSlotPreset>("classic");
  const [mealSlotPickerOpen, setMealSlotPickerOpen] = useState(false);
  const [pantryStaples, setPantryStaples] = useState<readonly string[]>([]);
  const [pantryPickerOpen, setPantryPickerOpen] = useState(false);
  const [pantryInput, setPantryInput] = useState("");
  // Audit 2026-05-22 subtractive: Promo code block was always-expanded
  // (input field + Apply button + caption visible for every user even
  // when most never use a code). Collapsed by default behind a chevron
  // row that mirrors the Membership row pattern; expands on tap.
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [trackedMacros, setTrackedMacros] = useState<string[]>([
    "protein",
    "carbs",
    "fat",
  ]);
  const [weekStartDay, setWeekStartDay] = useState<"sunday" | "monday">(
    "monday",
  );
  // Deficit/burn summary window (rolling 7-day vs current calendar week).
  // Hydrated from `profiles.notification_prefs.weekSummaryMode` and
  // changed here in Settings — mirrors web Settings → "Burn / deficit
  // summary" (the in-place Today toggle was removed 2026-05-26). The
  // chosen mode drives the Today summary window on next load.
  const [weekSummaryMode, setWeekSummaryMode] =
    useState<WeekSummaryMode>("rolling");
  const [deficitWindowPickerOpen, setDeficitWindowPickerOpen] =
    useState(false);
  // Fasting window — read from `profiles.fasting_window` so the
  // Settings row can show the current preference (e.g. "16:8 — 16h
  // fast / 8h eat") without forcing the user to tap through to
  // /fasting just to see what they picked. Default mirrors the
  // /fasting screen + onboarding step (`16:8`). Editing happens on
  // /fasting via the preset chips (2026-05-02 Build 40 fix).
  const [fastingWindow, setFastingWindow] = useState<string>("16:8");
  const [caffeineTargetPickerOpen, setCaffeineTargetPickerOpen] = useState(false);
  const [alcoholTargetPickerOpen, setAlcoholTargetPickerOpen] = useState(false);
  const [targetCaffeineMg, setTargetCaffeineMg] = useState<number>(400);
  const [targetAlcoholGWeekly, setTargetAlcoholGWeekly] = useState<number>(0);
  const [caffeineInput, setCaffeineInput] = useState<string>("400");
  const [alcoholInput, setAlcoholInput] = useState<string>("0");
  const [weeklyRecapPushEnabled, setWeeklyRecapPushEnabled] = useState<boolean>(
    true,
  );
  const [weeklyRecapPushPickerOpen, setWeeklyRecapPushPickerOpen] = useState(
    false,
  );
  // "Export everything" flow (2026-04-30 user-sentiment audit). The
  // row spinner is gated by this flag; double-taps are no-ops.
  const [exportingEverything, setExportingEverything] = useState(false);
  // CSV export — file-write spinner so the row sub copy reads
  // "Preparing your file…" while we hit Supabase + write to cache.
  // Replaces the silent broken Share.share({ message: csv }) path
  // (P0-2 — `claude/settings-mobile-structural-fix` 2026-05-01).
  const [exportingCsv, setExportingCsv] = useState(false);
  /**
   * Cancel-flow export prompt (PR replaces #43, 2026-05-02). Surfaces
   * a Suppr-owned bottom sheet BEFORE routing to RC's customerCenter
   * so the export option is proactive, not buried 4-5 taps deep in
   * Settings. Two equal-weight cards: "Take your data with you"
   * (export CSV first) / "Continue to manage" (route to RC). The X
   * dismisses without action. Closes journey-architect P1.
   */
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);

  // P0-1 / Tracking extras (2026-05-01,
  // `claude/settings-mobile-structural-fix`) — caffeine + alcohol
  // Today widgets default OFF. Migrated from `/(tabs)/settings.tsx`
  // legacy section so the bundle is the single source of truth.
  // AsyncStorage-only (no schema change). Toggling persists
  // immediately so the Today tracker host picks up the change on
  // next render.
  const [trackingExtras, setTrackingExtras] = useState<TrackingExtras>(
    DEFAULT_TRACKING_EXTRAS,
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(TRACKING_EXTRAS_STORAGE_KEY);
        if (cancelled) return;
        setTrackingExtras(parseTrackingExtras(raw));
      } catch {
        // Storage unavailable — keep defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const persistTrackingExtras = useCallback(async (next: TrackingExtras) => {
    setTrackingExtras(next);
    try {
      await AsyncStorage.setItem(
        TRACKING_EXTRAS_STORAGE_KEY,
        serializeTrackingExtras(next),
      );
    } catch {
      // Soft failure — local state already reflects the toggle.
    }
  }, []);

  // P3-30 (2026-04-25) — net-carbs lens opt-in. Source of truth:
  // `profiles.net_carbs_lens_enabled` (migration 20260503103000).
  // Migrated 2026-05-01 from the legacy `/(tabs)/settings.tsx`
  // Journal display section into the bundle's Display & extras
  // section so the structural collapse doesn't lose this toggle.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);

  // Theme preference (light / dark / system) — exposed via the
  // context shipped 2026-04. The setter UI lived in the legacy
  // settings shell and was lost in the 2026-05-01 structural fix;
  // restored here so the existing context plumbing surfaces in the
  // bundle for the first time. Grace flagged the missing UI 2026-05-17.
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();

  // Macro display style (tiles vs bars) — Today's macro block
  // renders either the 2×2 emoji-icon tiles (default, unchanged) or
  // the Cronometer/Lose It-style "Name … Value / Target" vertical
  // list with thin colored bars (Grace 2026-05-17 ask).
  const [macroDisplayStyle, setMacroDisplayStyle] = useMacroDisplayStyle();
  // ENG-1098 "Calm mode" — body-neutral display pref; v1 hides the per-slot
  // "Aim ~X kcal" numbers (Today + Plan). Client-side, shared key with web.
  const [calmMode, setCalmMode] = useCalmMode();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("net_carbs_lens_enabled")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setNetCarbsLensEnabled(
          Boolean((data as { net_carbs_lens_enabled?: unknown }).net_carbs_lens_enabled),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // P1-8 (2026-05-01) — real Apple Health connection state. The
  // pre-fix code surfaced `isHealthSyncAvailable()` which only
  // checks platform support, not user grant: a brand-new install on
  // iOS saw "Connected" before the permission sheet ever opened. We
  // now (a) seed from the `health_sync_apple_connected` flag the
  // /health-sync screen writes after a successful connect, then
  // (b) re-probe HealthKit on focus via `probeHealthAccess()` and
  // flip back to "Permission needed" on bridge-error (revoked in
  // iOS Settings).
  const [appleHealthState, setAppleHealthState] = useState<
    "checking" | "connected" | "permission_needed" | "unavailable"
  >("checking");
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const cached = await AsyncStorage.getItem(
            "health_sync_apple_connected",
          );
          if (!cancelled && cached === "true") setAppleHealthState("connected");
        } catch {
          // ignore — the probe below is authoritative.
        }
        const status = await probeHealthAccess();
        if (cancelled) return;
        if (status === "connected") setAppleHealthState("connected");
        else if (status === "denied") setAppleHealthState("permission_needed");
        else setAppleHealthState("unavailable");
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // P0-1 (2026-05-01) — Manage subscription + promo-code redemption
  // migrated from the legacy `/(tabs)/settings.tsx` Plan section
  // into the bundle's Membership card. Free users see View plans /
  // Upgrade only; base/pro see Manage subscription. The promo-code
  // input lives beneath both gates so testers can redeem regardless
  // of tier.
  const {
    code: promoCode,
    setCode: setPromoCode,
    submitting: promoSubmitting,
    redeem: redeemPromo,
  } = usePromoCode({ userId });
  const handleRedeemPromo = useCallback(async () => {
    const result = await redeemPromo();
    if (result.ok) {
      // Force a profile refetch so the tier badge / upgrade row
      // reflects the new entitlement immediately.
      loadProfileData();
    }
  }, [redeemPromo, loadProfileData]);
  /**
   * Routes to RevenueCat's customerCenter. Used by the cancel-flow
   * export prompt's "Continue to manage" CTA after the user has
   * either exported their data or chosen to skip it. Falls back to
   * the platform's native subscription surface when RC isn't
   * provisioned (Expo Go, missing key, web).
   */
  const routeToCustomerCenter = useCallback(async () => {
    const result = await presentCustomerCenter();
    if (result.presented) return;
    // Fallback: send the user to the platform's native subscription
    // surface so "manage my plan" is never a dead end. `no_api_key`
    // hits this path in builds where RC isn't provisioned;
    // `ui_unavailable` hits it in Expo Go or on web.
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url).catch(() => {
      Alert.alert(
        "Couldn't open subscription settings",
        "Manage your Sloe subscription from the App Store / Play Store app.",
      );
    });
  }, []);
  /**
   * Opens the cancel-flow export prompt sheet (PR replaces #43,
   * 2026-05-02). Closes journey-architect P1 — the CSV-export prompt
   * was buried 4-5 taps deep in Settings; tapping "Manage
   * subscription" never surfaced it. Now we render a Suppr-owned
   * interstitial with two equal-weight cards before handing off to
   * RC's customerCenter. The export CTA fires the same `runExportCsv`
   * the standalone Settings row uses, so the byte shape is identical
   * (pin: `tests/unit/nutritionLogToCsv.test.ts`).
   */
  const handleManageSubscription = useCallback(() => {
    track(AnalyticsEvents.cancel_export_prompt_shown, {
      source: "mobile",
      tier: profileData.userTier,
    });
    setCancelPromptOpen(true);
  }, [profileData.userTier]);

  const runExportEverything = useCallback(async () => {
    if (!userId) return;
    if (exportingEverything) return;
    setExportingEverything(true);
    try {
      const result = await exportEverythingToFile(userId);
      if (!result.ok) {
        if (result.reason === "rate_limited") {
          Alert.alert("Slow down", result.message);
        } else if (result.reason === "not_authenticated") {
          Alert.alert("Sign in required", result.message);
        } else {
          Alert.alert("Export failed", result.message);
        }
        return;
      }
      // Hand the file to the iOS share sheet: `Share.share({ url })` accepts a
      // `file://` URI and opens UIActivityViewController (Files/AirDrop/Mail).
      try {
        await Share.share({
          url: result.fileUri,
          title: result.filename,
        });
        Alert.alert(
          "Exported",
          `${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB)`,
        );
      } catch (e) {
        Alert.alert(
          "Couldn't open share sheet",
          e instanceof Error
            ? e.message
            : "The file was saved but the share sheet didn't open.",
        );
      }
    } finally {
      setExportingEverything(false);
    }
  }, [userId, exportingEverything]);

  /**
   * CSV export runner — extracted 2026-05-02 (PR replaces #43) so
   * both the standalone Settings export row AND the cancel-flow
   * export prompt sheet's "Take your data with you" CTA call the same
   * helper. Same Supabase select, same `nutritionLogToCsv` bytes, same
   * filename shape — keeps the pinned-bytes test
   * (`tests/unit/nutritionLogToCsv.test.ts`) passing for both entry
   * points. Fails gracefully when the cache directory or
   * `expo-file-system` is unavailable (vitest / unprovisioned builds).
   */
  const runExportCsv = useCallback(async () => {
    if (!userId) return;
    if (exportingCsv) return;
    setExportingCsv(true);
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

      let fsModule: unknown;
      try {
        fsModule = await import("expo-file-system");
      } catch {
        Alert.alert(
          "Export failed",
          "We couldn't access local storage to save the file.",
        );
        return;
      }
      const fsModAny = fsModule as {
        cacheDirectory?: unknown;
        writeAsStringAsync?: unknown;
        default?: {
          cacheDirectory?: unknown;
          writeAsStringAsync?: unknown;
        };
      };
      const cacheDir =
        (typeof fsModAny.cacheDirectory === "string"
          ? fsModAny.cacheDirectory
          : null) ??
        (typeof fsModAny.default?.cacheDirectory === "string"
          ? fsModAny.default?.cacheDirectory
          : null);
      const writeAsStringAsync =
        (typeof fsModAny.writeAsStringAsync === "function"
          ? fsModAny.writeAsStringAsync
          : null) ??
        (typeof fsModAny.default?.writeAsStringAsync === "function"
          ? fsModAny.default?.writeAsStringAsync
          : null);
      if (!cacheDir || !writeAsStringAsync) {
        Alert.alert(
          "Export failed",
          "We couldn't access local storage to save the file.",
        );
        return;
      }
      const fileUri = `${(cacheDir as string).replace(/\/$/, "")}/${filename}`;
      try {
        await (
          writeAsStringAsync as (
            uri: string,
            body: string,
          ) => Promise<void>
        )(fileUri, csv);
      } catch (e) {
        Alert.alert(
          "Export failed",
          e instanceof Error
            ? `Couldn't save to your device: ${e.message}`
            : "Couldn't save the export to your device.",
        );
        return;
      }
      try {
        await Share.share({ url: fileUri, title: filename });
      } catch (e) {
        Alert.alert(
          "Couldn't open share sheet",
          e instanceof Error
            ? e.message
            : "The file was saved but the share sheet didn't open.",
        );
      }
    } catch (e) {
      Alert.alert(
        "Export failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setExportingCsv(false);
    }
  }, [userId, exportingCsv]);

  // ENG-1262: export-first = COMPLETE archive (runExportEverything → /api/export/me), not the meal-log CSV; exportingEverything drives the button's loading state.
  const deleteAccount = useDeleteAccountSheet(userId, () => {
    void runExportEverything();
  });

  /**
   * Persist the deficit/burn summary window into the same
   * `notification_prefs` jsonb the Today summary hydrates from. Optimistic
   * local set first for instant UI; read-merge-write the DB so sibling
   * prefs (`reminder_time`, `activity_bonus_calories`, …) are preserved.
   * On failure, revert local state and surface an alert. Mirrors the web
   * Settings "Deficit summary" control and the "Week starts on"
   * row's save shape.
   */
  const persistWeekSummaryMode = useCallback(
    async (next: WeekSummaryMode) => {
      const previous = weekSummaryMode;
      if (previous === next) return;
      setWeekSummaryMode(next);
      if (!userId) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("notification_prefs")
          .eq("id", userId)
          .maybeSingle();
        const raw = (data as { notification_prefs?: unknown } | null)
          ?.notification_prefs;
        const prev =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? { ...(raw as Record<string, unknown>) }
            : {};
        const { error } = await supabase
          .from("profiles")
          .update({ notification_prefs: { ...prev, weekSummaryMode: next } })
          .eq("id", userId);
        if (error) throw error;
      } catch {
        setWeekSummaryMode(previous);
        Alert.alert(
          "Could not save",
          "We couldn't save your burn / deficit summary preference. Please try again.",
        );
      }
    },
    [userId, weekSummaryMode],
  );

  const savePantryStaples = useCallback(
    async (next: readonly string[]) => {
      const normalized = parsePantryStaples(next);
      const previous = pantryStaples;
      setPantryStaples(normalized);
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ pantry_staples: normalized })
        .eq("id", userId);
      if (error) {
        setPantryStaples(previous);
        Alert.alert(
          "Could not save",
          "We couldn't save your pantry staples. Please try again.",
        );
      }
    },
    [userId, pantryStaples],
  );

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      // Try the full select first; fall back if a column hasn't shipped.
      let resp = await supabase
        .from("profiles")
        .select(
          "tracked_macros, week_start_day, meal_slot_config, pantry_staples, target_caffeine_mg, target_alcohol_g_weekly, weekly_recap_push_enabled, fasting_window, notification_prefs",
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
      if (
        data.week_start_day === "sunday" ||
        data.week_start_day === "monday"
      ) {
        setWeekStartDay(data.week_start_day);
      }
      setMealSlotPreset(parseUserMealSlotConfig((data as { meal_slot_config?: unknown }).meal_slot_config).preset);
      setPantryStaples(parsePantryStaples((data as { pantry_staples?: unknown }).pantry_staples));
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
        setWeeklyRecapPushEnabled(wrp !== false);
      }
      // 2026-05-02 (Build 40 outstanding feedback) — mirror the
      // user's stored fasting window so the Settings row sub copy
      // is honest. Format guard: `parseFastingWindow` on /fasting
      // already falls back to 16:8 for anything malformed; we just
      // need a non-empty string here.
      const fw = (data as any).fasting_window;
      if (typeof fw === "string" && /^\d+:\d+$/.test(fw)) {
        setFastingWindow(fw);
      }
      // Deficit/burn summary window — read from the same
      // `notification_prefs.weekSummaryMode` the Today summary hydrates
      // from. `normalizeWeekSummaryMode` falls back to "rolling" for any
      // missing/unknown value, matching Today's hydration.
      const np = (data as any).notification_prefs;
      const rawMode =
        np && typeof np === "object" && !Array.isArray(np)
          ? (np as Record<string, unknown>).weekSummaryMode
          : undefined;
      setWeekSummaryMode(normalizeWeekSummaryMode(rawMode));
    })();
  }, [userId]);

  /**
   * 2026-05-11 (Grace TF feedback) — "Refresh my plan" flow.
   * Replaces the prior two-branch "Reset targets / Erase everything"
   * model. Always re-runs the user through onboarding so they can
   * update weight / height / goals / macros. At the end of onboarding
   * a one-shot prompt asks "Keep my logs and weight history?" — see
   * the matching hook in `apps/mobile/components/onboarding/mobile-flow.tsx`
   * which reads the AsyncStorage flag set here.
   */
  const handleRefreshPlan = useCallback(async () => {
    if (!userId) return;
    setResetting(true);
    setResetModalOpen(false);
    try {
      // 2026-05-12 (Grace TF) — DO NOT pre-set onboarding_completed=false here.
      // If persistOnboarding's upsert at the end of refresh-plan fails silently
      // (it catches + logs internally — see src/lib/onboarding/persist.ts), the
      // profile stays at false and the (tabs) guard bounces the user back to
      // Welcome forever. /onboarding mounts unconditionally, so flipping the
      // flag is unnecessary. Worst case on persist failure now: user lands on
      // Today with their OLD plan (recoverable) instead of a redirect loop.
      try {
        // Clear the persisted onboarding draft so the user starts from
        // their CURRENT profile state (the persist hydration in
        // `apps/mobile/components/onboarding/context.tsx` pulls from
        // profiles when this key is absent).
        await AsyncStorage.multiRemove(["suppr.onboarding-v2.state"]);
        // Set the reset-flag the mobile-flow handleComplete hook reads
        // to surface the post-onboarding "Keep my logs and weight
        // history?" prompt. Cleared by that hook once handled.
        await AsyncStorage.setItem("suppr.reset-plan-pending-prompt", "1");
      } catch {
        /* non-fatal — prompt won't show but onboarding still runs */
      }
      router.replace("/onboarding" as any);
    } catch (e: unknown) {
      Alert.alert(
        "Couldn't refresh plan",
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
    } finally {
      setResetting(false);
    }
  }, [userId, router]);

  /**
   * Nuclear option — wipes EVERYTHING (recipes, plans, saves, log,
   * weight history) and re-runs onboarding from scratch. Reserved for
   * "I want to delete my data and start fresh" — distinct from
   * `handleRefreshPlan` which preserves library content by default.
   */
  const handleNukeEverything = useCallback(async () => {
    if (!userId) return;
    setResetting(true);
    setResetModalOpen(false);
    try {
      const r = await nukeAllUserAppData(supabase, userId);
      if (!r.ok) {
        Alert.alert("Could not erase data", r.message);
        return;
      }
      try {
        await AsyncStorage.multiRemove([
          "health_import_nutrition",
          "health_export_nutrition",
          "health_import_generic_labels",
          "health_sync_apple_connected",
          "suppr.onboarding-v2.state",
          "suppr.reset-plan-pending-prompt",
        ]);
      } catch {
        /* ignore */
      }
      router.replace("/onboarding" as any);
    } catch (e: unknown) {
      Alert.alert(
        "Reset failed",
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
    } finally {
      setResetting(false);
    }
  }, [userId, router]);

  const t = useMemo(
    () => ({
      accent: accent.primary,
      green: Accent.success,
      amber: Accent.warning,
      red: Accent.destructive,
    }),
    [accent],
  );

  const avatarInitial = (
    session?.user?.user_metadata?.display_name?.[0] ??
    session?.user?.email?.[0] ??
    "S"
  )
    .toString()
    .toUpperCase();
  const displayName =
    // Prefer the name the user actually set (the same `user_metadata` the
    // "Your name" field writes, via metadataFullName) before falling back to
    // the email local-part — otherwise the header showed an ugly lowercase
    // handle ("gracemturner") instead of "Grace".
    session?.user?.user_metadata?.display_name ||
    metadataFullName ||
    session?.user?.email?.split("@")[0] ||
    "Your Profile";
  // Base tier collapsed into Free post-Free+Pro consolidation; legacy
  // `userTier === "base"` rows render as "Free". Drives both the profile
  // plan label ("Free plan" / "Pro plan") and the Sloe Pro banner action.
  const tierLabel = profileData.userTier === "pro" ? "Pro" : "Free";

  return (
    <>
      {/* Profile row — Sloe DS (Figma 09 Settings `335:2`): plum filled
          circle avatar (white serif initial) + name in Newsreader serif
          + plan label ("Free plan" / "Pro plan") in grey, sitting
          directly on the white page (no card chrome). The whole row taps
          through to /profile (the full editor). Tier is shown as the
          plan-label line, not a pill — the frame leads with identity,
          not a status marker. */}
      <Pressable
        testID="settings-profile-row"
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        onPress={() => router.push("/profile" as any)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingVertical: 8,
          marginTop: 4,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.navPrimary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: FontFamily.serifSemibold,
              fontSize: 22,
              fontWeight: "600",
              color: colors.primaryForeground,
            }}
          >
            {avatarInitial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FontFamily.serifSemibold,
              fontSize: 24,
              lineHeight: 28,
              fontWeight: "600",
              color: colors.text,
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}
            numberOfLines={1}
          >
            {/* v3 prototype: "email · plan" (ENG-1247). */}
            {session?.user?.email ? `${session.user.email} · ` : ""}
            {tierLabel === "Pro" ? "Pro plan" : "Free plan"}
          </Text>
        </View>
      </Pressable>

      {/* Sloe Pro upsell banner — Figma 09 Settings `335:2` / `335:23`.
          Full-width aubergine soft-tint rounded card: sparkle + "Sloe Pro"
          on the left, a "Manage" OUTLINE pill on the right. For free/base
          users "Manage" routes to the paywall (upgrade); for Pro users it
          opens the existing manage-subscription flow (RevenueCat customer
          center). The detailed upgrade/manage/promo rows still live in the
          Membership card below — this banner is the at-a-glance entry.
          2026-06-08: the card tint moved off the hardcoded clay rgba to
          `accent.primarySoft` (Pro = the brand aubergine, treatment #9).
          2026-06-12 (Sloe button canon): the "Manage" pill dropped its
          aubergine outline for the GHOST grammar — transparent, no border,
          plum label. Matches the web banner (`Settings.tsx`). */}
      <Pressable
        testID="settings-sloe-pro-banner"
        accessibilityRole="button"
        accessibilityLabel={
          profileData.userTier === "pro"
            ? "Manage your Sloe Pro subscription"
            : "Get Sloe Pro"
        }
        onPress={() => {
          if (profileData.userTier === "pro") {
            void handleManageSubscription();
          } else {
            router.push("/paywall?from=settings" as any);
          }
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 16,
          paddingHorizontal: 16,
          borderRadius: SETTINGS_CARD_RADIUS,
          backgroundColor: cohesionWhite
            ? statTileElevation.liftBg ?? colors.card
            : accent.primarySoft,
          ...(cohesionWhite
            ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder }
            : null),
          marginTop: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Sparkles size={18} color={accent.primarySolid} strokeWidth={1.75} />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: accent.primarySolid,
            }}
          >
            Sloe Pro
          </Text>
        </View>
        {/* Manage — GHOST treatment (Sloe button canon, 2026-06-12). The
            whole banner row is the Pressable, so this stays a decorative pill
            (nesting a SupprButton inside the Pressable would double the press
            target) — we apply the ghost grammar by hand: transparent, no
            border, plum label. Mirrors the web Pro-banner Manage pill. */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: Radius.full,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: accent.primarySolid }}>
            Manage
          </Text>
        </View>
      </Pressable>

      {/* Stats strip — Recipes / Streak.
          Audit 2026-05-22 subtractive: hide tiles whose value is zero
          (and the whole row if both are zero). "0 Recipes · — Streak"
          on a brand-new account read as dead chrome — two tiles
          shouting nothing. Tiles reappear individually as the user
          accumulates a streak or saves a recipe, so the row earns its
          space rather than reserving it pre-emptively. */}
      {(profileData.savedCount > 0 || profileData.streak > 0) ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {(
            [
              profileData.savedCount > 0
                ? [String(profileData.savedCount), "Recipes", t.accent]
                : null,
              profileData.streak > 0
                ? [String(profileData.streak), "Streak", t.green]
                : null,
            ].filter((x): x is [string, string, string] => x !== null)
          ).map(([v, l, c]) => (
            <Pressable
              key={l}
              // One-card-treatment (2026-06-09): the stat tile sits on the
              // page ground, so it takes the same soft card chrome as its
              // siblings — standard card fill + soft lift — instead of the
              // bespoke tinted-border inputBg chip that read as one-off
              // "dead chrome" next to the lifted cards around it. The
              // accent lives in the numeral, not the border.
              style={[
                {
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: Spacing.dense,
                  borderRadius: TILE_RADIUS,
                  backgroundColor: statTileElevation.liftBg ?? colors.card,
                  borderWidth: statTileElevation.useBorder ? 1 : 0,
                  borderColor: colors.cardBorder,
                },
                statTileElevation.shadowStyle,
              ]}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: c }}>
                {v}
              </Text>
              <Text
                style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}
              >
                {l}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Personal — the user's identity + personal preferences group.
          Sits at the top of the list (identity comes first). The "Your
          name" field below sets the display name (avatar + Profile): it
          writes the auth user's `user_metadata.full_name` via
          `supabase.auth.updateUser`. Empty clears it. (Today shows a serif
          date hero now, not a name greeting — ENG-1247.) Web mirror is the
          "Personal" card in `src/app/components/Settings.tsx` (the name
          field is the first row). Grace 2026-06-04: the name belongs
          inside a general Personal settings group, not a lone "Your name"
          card. */}
      <SectionHeading title="Personal" />
      <SettingsCard testID="settings-card-name" style={{ padding: 14, gap: 10 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: colors.text,
            lineHeight: 17,
          }}
          accessibilityRole="header"
        >
          Your name
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          Used to greet you on Today (&quot;Morning, {nameInput.trim().split(/\s+/)[0] || "Grace"}&quot;). Leave blank to keep it name-free.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <IconBox color={t.accent}>
            <User size={18} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <TextInput
            testID="settings-bundle-name-input"
            value={nameInput}
            onChangeText={(text) => {
              nameDirtyRef.current = true;
              setNameInput(text);
            }}
            onBlur={() => {
              void handleSaveName();
            }}
            placeholder="Your name"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSaveName();
            }}
            // PostHog session replay masks ALL text inputs at capture on
            // mobile (`maskAllTextInputs: true`, accepted as-is in
            // `apps/mobile/lib/analytics.ts`) — same posture as the promo
            // input above, no per-field prop needed.
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
              fontSize: 14,
            }}
          />
          {/* Save name — GHOST (Sloe button canon, 2026-06-12). Inline
              secondary alongside the name input: transparent, no border, plum
              label. Mirrors the web Settings name-save button. */}
          <SupprButton
            variant="ghost"
            testID="settings-bundle-name-save"
            onPress={() => void handleSaveName()}
            disabled={nameSaving || nameInput.trim() === metadataFullName}
            loading={nameSaving}
            label="Save"
            accessibilityLabel="Save your name"
          />
        </View>
      </SettingsCard>

      {/* Membership — restructured 2026-05-01
          (`claude/settings-mobile-structural-fix` P0-1). The card now
          carries every Plan-related row migrated from the legacy
          `/(tabs)/settings.tsx`: upgrade (free/base) → Manage
          subscription (base/pro) → promo-code input (always). */}
      <SectionHeading title="Membership" />
      <SettingsCard testID="settings-card-membership">
        {profileData.userTier !== "pro" ? (
          <Pressable
            testID="settings-bundle-upgrade-row"
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
                borderRadius: Radius.full,
                backgroundColor: accent.primary + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} color={accent.primary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {profileData.userTier === "free"
                  ? "Upgrade your plan"
                  : "Upgrade to Pro"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {profileData.userTier === "free"
                  ? "Unlimited recipes, multi-day plans, and AI logging"
                  : "Unlock AI photo and voice logging with Pro"}
              </Text>
            </View>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={1.75}
            />
          </Pressable>
        ) : null}
        {profileData.userTier !== "free" ? (
          <Pressable
            testID="settings-manage-subscription-row"
            onPress={() => void handleManageSubscription()}
            accessibilityRole="button"
            accessibilityLabel="Manage subscription"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderTopWidth:
                profileData.userTier !== "pro" ? 1 : 0,
              borderTopColor: colors.cardBorder,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: Radius.full,
                backgroundColor: accent.primary + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} color={accent.primary} strokeWidth={1.75} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
              }}
            >
              Manage subscription
            </Text>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={1.75}
            />
          </Pressable>
        ) : null}
        {/* Promo-code redemption — testers + creator codes. Sits
            beneath both upgrade / manage rows so it's reachable
            regardless of tier. Logic lives in `usePromoCode`.
            Audit 2026-05-22: collapsed by default — most users will
            never redeem a code. Tap the row to expand the input. */}
        <Pressable
          testID="settings-bundle-promo-code-toggle"
          onPress={() => setPromoExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={promoExpanded ? "Collapse promo code" : "Have a promo code?"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          }}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}>
            Have a promo code?
          </Text>
          {promoExpanded ? (
            <ChevronDown size={16} color={colors.textTertiary} strokeWidth={1.75} />
          ) : (
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
          )}
        </Pressable>
        {promoExpanded ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Enter your code exactly as provided (letters are not
            case-sensitive).
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              testID="settings-bundle-promo-code-input"
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Enter code"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                flex: 1,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.text,
                fontSize: 14,
              }}
            />
            {/* Apply promo — PRIMARY (Sloe button canon, 2026-06-12). The
                promo card's own action: solid aubergine pill, white label. */}
            <SupprButton
              variant="primary"
              testID="settings-bundle-promo-code-apply"
              onPress={() => void handleRedeemPromo()}
              disabled={promoSubmitting || !promoCode.trim()}
              loading={promoSubmitting}
              label="Apply"
            />
          </View>
        </View>
        ) : null}
      </SettingsCard>

      {/* Household — hides when the user isn't in a household */}
      {householdSummary ? (
        <>
          {/* 2026-05-02 — section was "Everything else" until a single
              Household row made the catch-all label feel arbitrary
              (user feedback). Renamed to "People" to describe the row
              that lives here today. Web mirror in
              `src/app/components/Profile.tsx`. */}
          <SectionHeading title="People" />
          <SettingsCard testID="settings-card-people">
            <SettingsRow
              testID={HOUSEHOLD_ROW_TEST_ID}
              isFirst
              icon={Users}
              iconColor={t.accent}
              label="Household"
              sub={householdSummary.subtitle}
              onPress={() => router.push("/household-settings" as any)}
            />
          </SettingsCard>
        </>
      ) : null}

      {/* Goals & targets */}
      <SectionHeading title="Goals & targets" />
      <SettingsCard testID="settings-card-goals">
        <SettingsRow
          testID="settings-bundle-daily-targets-row"
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
                  if (profileData.targetResolution === "fallback")
                    return `${k} (defaults) · Tap to personalise`;
                  if (profileData.targetResolution === "computed")
                    return `${k} (from your stats) · ${macro}`;
                  return `${k} · ${macro}`;
                })()
          }
          onPress={() => router.push("/targets" as any)}
        />
        <SettingsRow
          testID="settings-bundle-dashboard-widgets-row"
          icon={LayoutGrid}
          iconColor={t.accent}
          label="Dashboard widgets"
          sub={trackedMacros
            .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
            .join(", ")}
          onPress={() => setWidgetPickerOpen(true)}
        />
        <SettingsRow
          testID="settings-bundle-week-start-row"
          icon={Calendar}
          iconColor={t.accent}
          label="Week starts on"
          sub={weekStartDay === "monday" ? "Monday" : "Sunday"}
          onPress={() => setWeekStartPickerOpen(true)}
        />
        <SettingsRow
          testID="settings-bundle-meal-slots-row"
          icon={AlignLeft}
          iconColor={t.accent}
          label="Meal slots"
          sub={
            MEAL_SLOT_PRESET_OPTIONS.find((o) => o.id === mealSlotPreset)?.label ??
            "Breakfast, lunch, dinner & snacks"
          }
          onPress={() => setMealSlotPickerOpen(true)}
        />
        <SettingsRow
          testID="settings-bundle-pantry-row"
          icon={Package}
          iconColor={t.accent}
          label="Pantry staples"
          sub={
            pantryStaples.length > 0
              ? `${pantryStaples.length} always on hand`
              : "Skip when generating shopping list"
          }
          onPress={() => setPantryPickerOpen(true)}
        />
        {/* Deficit summary window — controls whether the Today
            burn/deficit averages cover the last 7 days ending on the
            day you view, or the current calendar week. Moved here from
            an in-place Today toggle (2026-05-26, Grace) so it's a
            durable preference; mirrors web Settings → "Burn / deficit
            summary". Persists to `notification_prefs.weekSummaryMode`. */}
        <SettingsRow
          testID="settings-bundle-deficit-window-row"
          icon={Flame}
          iconColor={t.accent}
          label="Deficit summary"
          sub={
            weekSummaryMode === "calendar_week"
              ? "This week (Mon–Sun)"
              : "Last 7 days"
          }
          onPress={() => setDeficitWindowPickerOpen(true)}
        />
        <SettingsRow
          testID="settings-bundle-caffeine-row"
          icon={Coffee}
          iconColor={t.accent}
          label="Caffeine limit"
          // EFSA + FDA both land at 400 mg/day; quote both bodies so the
          // citation reads regional-neutral to UK/EU users.
          sub={`${targetCaffeineMg} mg/day · EFSA & FDA upper limit 400 mg`}
          onPress={() => setCaffeineTargetPickerOpen(true)}
        />
        <SettingsRow
          testID="settings-bundle-alcohol-row"
          icon={Wine}
          iconColor={t.accent}
          label="Alcohol limit"
          sub={
            targetAlcoholGWeekly > 0
              ? `${targetAlcoholGWeekly} g/week`
              : "Off · set a target to show the row"
          }
          onPress={() => setAlcoholTargetPickerOpen(true)}
        />
        {/* Intermittent fasting — 2026-05-02 (Build 40 outstanding
            feedback: typing "fast" in Settings search returned "No
            matches", with no other in-app entry point to change the
            fasting window after onboarding). Routes to /fasting
            which now hosts the timer ring, start/end, history AND
            the 16:8 / 18:6 / 20:4 / 14:10 / OMAD preset picker (ENG-922),
            matching the web FastingTimer. Sub copy mirrors the stored
            window so the user can see at a glance what they picked. */}
        <SettingsRow
          testID="settings-bundle-fasting-row"
          icon={Timer}
          iconColor={t.accent}
          label="Intermittent fasting"
          sub={(() => {
            const parts = fastingWindow.split(":");
            const fast = parseInt(parts[0] ?? "", 10);
            const eat = parseInt(parts[1] ?? "", 10);
            if (
              Number.isFinite(fast) &&
              Number.isFinite(eat) &&
              fast > 0 &&
              eat > 0
            ) {
              return `${fastingWindowLabel(fastingWindow)} window · ${fast}h fast / ${eat}h eat`;
            }
            return "Tap to set fast / eat window";
          })()}
          onPress={() => router.push("/fasting" as any)}
        />
      </SettingsCard>

      {/* Display & extras — caffeine + alcohol Today widgets opt-in.
          Migrated from the legacy `/(tabs)/settings.tsx` Tracking
          extras section (P0-1, `claude/settings-mobile-structural-fix`
          2026-05-01). AsyncStorage-only via
          `TRACKING_EXTRAS_STORAGE_KEY`; Today's tracker host re-reads
          on focus. Hydration stays on regardless; turning these off
          hides the row on Today but preserves any historical logs. */}
      <SectionHeading title="Display" />
      <SettingsCard testID="settings-card-display">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <IconBox color={t.accent}>
            <Coffee size={18} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.text,
                lineHeight: 17,
              }}
            >
              Track caffeine
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Show a caffeine row on Today. Logs in mg, off by default.
            </Text>
          </View>
          <Switch
            testID="settings-bundle-track-caffeine-toggle"
            value={trackingExtras.trackCaffeine}
            onValueChange={(v) =>
              void persistTrackingExtras({
                ...trackingExtras,
                trackCaffeine: v,
              })
            }
            trackColor={{ true: accent.primary }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          }}
        >
          <IconBox color={t.accent}>
            <Wine size={18} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.text,
                lineHeight: 17,
              }}
            >
              Track alcohol
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Show an alcohol row on Today. Logs units + kcal, off by
              default.
            </Text>
          </View>
          <Switch
            testID="settings-bundle-track-alcohol-toggle"
            value={trackingExtras.trackAlcohol}
            onValueChange={(v) =>
              void persistTrackingExtras({
                ...trackingExtras,
                trackAlcohol: v,
              })
            }
            trackColor={{ true: accent.primary }}
          />
        </View>
        {/* P3-30 (2026-04-25) — Show net carbs toggle. Migrated
            2026-05-01 from the legacy `/(tabs)/settings.tsx` Journal
            display section so the structural collapse doesn't lose
            this preference. Tracker carbs tile + Recipe Detail
            nutrition row swap "Carbs" → "Net carbs" via
            src/lib/nutrition/netCarbs.ts. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          }}
        >
          <IconBox color={t.accent}>
            <Sparkles size={18} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.text,
                lineHeight: 17,
              }}
            >
              Show net carbs
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Display &quot;Net carbs&quot; (carbs − fibre) on the
              Tracker and recipe pages. Useful for keto / low-carb
              tracking.
            </Text>
          </View>
          <Switch
            testID="settings-net-carbs-lens-toggle"
            value={netCarbsLensEnabled}
            onValueChange={async (v) => {
              setNetCarbsLensEnabled(v);
              if (userId) {
                await supabase
                  .from("profiles")
                  .update({ net_carbs_lens_enabled: v } as never)
                  .eq("id", userId);
              }
            }}
            trackColor={{ true: accent.primary }}
          />
        </View>

        {/* Macro display — tiles vs bars. Grace 2026-05-17 ask:
            cronometer/lose-it-style bar list as an alternative to the
            2×2 emoji tile grid. Pref persists via AsyncStorage
            (`suppr.prefs.macro_display`); Today rebinds on next focus.
            Bars option packs more macros per inch — better for users
            tracking 5+ macros (sugar, sodium, water on top of P/C/F/Fb). */}
        <SegmentedRow
          testID="settings-macro-display-style"
          icon={macroDisplayStyle === "bars" ? AlignLeft : LayoutGrid}
          iconColor={t.accent}
          label="Macro display"
          description="Tiles = 2×2 squares (recommended). Bars = one full-width list."
          options={MACRO_DISPLAY_OPTIONS}
          value={macroDisplayStyle}
          onChange={(next) => setMacroDisplayStyle(next as MacroDisplayStyle)}
          colors={colors}
        />

        {/* Theme — light / dark / system. The context shipped 2026-04
            but the picker UI was lost in the 2026-05-01 settings
            structural fix; restored here so users can override the
            system scheme without digging into device settings. */}
        <SegmentedRow
          testID="settings-theme-preference"
          icon={
            themePreference === "light"
              ? Sun
              : themePreference === "dark"
                ? Moon
                : Smartphone
          }
          iconColor={t.accent}
          label="Theme"
          description="Auto follows your phone's light/dark setting."
          options={[
            { value: "auto", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={themePreference}
          onChange={(next) => setThemePreference(next as ThemePreference)}
          colors={colors}
        />

        {/* Calm mode (ENG-1098). Body-neutral opt-out raised by
            diversity-inclusion during the ENG-1092 "Aim ~X kcal" sign-off.
            v1 hides those per-slot aims (Today + Plan); the umbrella name lets
            the upcoming hide-weight / streak toggles fold in under one switch
            without a rename (product-lead 2026-06-14). Shared key with web. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          }}
        >
          <IconBox color={t.accent}>
            <EyeOff size={18} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.text,
                lineHeight: 17,
              }}
            >
              Hide calorie aims
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Hides the “Aim ~X kcal” suggestions on empty meals. Your targets
              still apply — they just stay quiet.
            </Text>
          </View>
          <Switch
            testID="settings-calm-mode-toggle"
            value={calmMode}
            onValueChange={(v) => setCalmMode(v)}
            trackColor={{ true: accent.primary }}
          />
        </View>
      </SettingsCard>

      {/* Connections — Sloe DS (Figma 09 Settings `335:2`): device /
          health integrations only. Reminder rows (Notifications, Weekly
          recap) moved to their own REMINDERS section below to match the
          frame's grouping. Apple Health is the only wired integration on
          iOS; Google Fit (in the frame) has no backing integration on the
          iOS-only build, so it is intentionally omitted rather than
          shipped as a dead row (see settings.md redesign note + migration
          tracker). */}
      <SectionHeading title="Connections" />
      <SettingsCard testID="settings-card-connections">
        <SettingsRow
          testID="settings-bundle-apple-health-row"
          isFirst
          icon={HeartPulse}
          iconColor={t.green}
          label="Apple Health"
          // P1-8 (2026-05-01) — reflect the real permission state, not
          // the bare platform capability. `probeHealthAccess()` issues
          // a 24h step-samples read; bridge errors mean the user
          // revoked access in iOS Settings → Privacy → Health → Suppr.
          sub={
            appleHealthState === "connected"
              ? "Connected"
              : appleHealthState === "permission_needed"
                ? "Permission needed · tap to fix"
                : appleHealthState === "unavailable"
                  ? "Not available on this device"
                  : "Checking…"
          }
          onPress={() => router.push("/health-sync" as any)}
        />
      </SettingsCard>

      {/* Reminders — Sloe DS (Figma 09 Settings `335:2`): the frame
          splits reminder controls (Daily reminder → time, Notifications)
          out of Connections into their own group. The Notifications row
          carries the daily-reminder time as its value ("Daily reminder at
          08:00"); Weekly recap is the second reminder output. */}
      <SectionHeading title="Reminders" />
      <SettingsCard testID="settings-card-reminders">
        <SettingsRow
          testID="settings-bundle-notifications-row"
          isFirst
          icon={Bell}
          iconColor={t.accent}
          label="Notifications"
          sub={
            profileData.notificationPref
              ? `Daily reminder at ${profileData.notificationPref}`
              : "Off"
          }
          onPress={() => router.push("/(tabs)/notifications" as any)}
        />
        <SettingsRow
          testID="settings-bundle-weekly-recap-row"
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
      </SettingsCard>

      {/* Recipes */}
      <SectionHeading title="Recipes" />
      <SettingsCard testID="settings-card-recipes">
        <SettingsRow
          testID="settings-bundle-create-recipe-row"
          isFirst
          icon={PlusCircle}
          iconColor={t.green}
          label="Create recipe"
          sub="Build and share a recipe"
          onPress={() => router.push("/create-recipe" as any)}
        />
      </SettingsCard>

      {/* Account — Sloe DS (Figma 09 Settings `335:2`): data + export
          rows live under the ACCOUNT eyebrow in the frame ("Export
          data"). Renamed from "App" so the group label matches the frame;
          testID stays `settings-card-app` (pinned by
          settingsElevationAndMarker.test.ts). Privacy / terms stay in a
          distinct LEGAL group below per the redesign spec (settings.md). */}
      <SectionHeading title="Account" />
      <SettingsCard testID="settings-card-app">
        {context === "more" ? (
          <SettingsRow
            isFirst
            icon={Palette}
            iconColor={t.accent}
            label="Settings"
            sub="Theme, password, plan, activity level, journal"
            onPress={() => router.push("/(tabs)/settings" as any)}
          />
        ) : null}
        <SettingsRow
          testID="settings-bundle-export-csv-row"
          isFirst={context === "settings"}
          icon={Download}
          iconColor={t.accent}
          label="Export nutrition log (CSV)"
          sub={
            exportingCsv
              ? "Preparing your file…"
              : "Spreadsheet-friendly. Opens in Numbers, Excel, or Google Sheets."
          }
          onPress={() => {
            void runExportCsv();
          }}
        />
        {/* "Export everything" — counters lock-in anxiety per the
            2026-04-30 user-sentiment audit (Paprika "recipes
            disappeared after upgrade", MFP "history gone after
            update", etc.). One server-authoritative endpoint emits
            the canonical payload (`/api/export/me`); the file is
            written to the iOS cache directory and surfaced via the
            standard share sheet so the user can save to Files,
            AirDrop, Mail, or Messages. The legacy partial JSON row
            (profile + entries + saves only) was replaced 2026-04-30
            because it both shipped truncated data AND used
            `Share.share({ message })` which routes through copy/
            paste — broken for any meaningful payload. */}
        <SettingsRow
          testID="settings-bundle-export-everything-row"
          icon={Download}
          iconColor={t.accent}
          label="Export everything"
          sub={
            exportingEverything
              ? "Preparing your file…"
              : "Yours forever. Take your data anywhere."
          }
          onPress={() => {
            if (exportingEverything) return;
            if (!userId) return;
            Alert.alert(
              "Export everything?",
              "We'll download all your recipes, meal log, weights, and plans to your device. Continue?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Continue",
                  onPress: () => {
                    void runExportEverything();
                  },
                },
              ],
            );
          }}
        />
        <BarcodeContributionsSection userId={userId} />
        <SettingsRow
          testID="settings-bundle-help-row"
          icon={HelpCircle}
          iconColor={t.accent}
          label="Help & information"
          sub="How it works, disclaimers, sources"
          onPress={() => {
            const base = getSupprWebBase();
            if (base) void Linking.openURL(`${base}/help`).catch(() => {});
            else void Linking.openURL("mailto:privacy@getsloe.com").catch(() => {});
          }}
        />
      </SettingsCard>

      {/* 2026-05-02 — MFP CSV bulk-import card. Closes the
          MFP-refugee history-bridge gap (P1 customer-lens). Mirrors the
          web Settings -> Privacy & Security entry and the onboarding
          data-bridges step card. The card carries its own chrome (icon,
          title, body, button) so it sits as a standalone sibling block
          rather than as a `SettingsRow`. See
          `docs/decisions/2026-05-02-mfp-csv-import.md`. */}
      <View style={{ marginTop: Spacing.md }}>
        <MobileMfpCsvImportCard surface="settings" />
      </View>

      {/* Legal */}
      <SectionHeading title="Legal" />
      <SettingsCard testID="settings-card-legal">
        <SettingsRow
          testID="settings-bundle-privacy-row"
          isFirst
          icon={FileText}
          iconColor={t.accent}
          label="Privacy policy"
          sub="How we use your data"
          onPress={() => openLegalPath("/privacy")}
        />
        <SettingsRow
          testID="settings-bundle-terms-row"
          icon={BookOpen}
          iconColor={t.accent}
          label="Terms of use"
          sub="Service agreement"
          onPress={() => openLegalPath("/terms")}
        />
      </SettingsCard>

      {/* Build — ENG-801. Dev-gated (`__DEV__` is false in release/TestFlight
          builds) so the build row never ships to a user-facing surface. A stale
          internal capture token (a one-off "F50" test-build marker) used to be
          appended here — it carried no meaning to a tester and read as garbage
          on the legitimate version string, so it was removed. The row now shows
          ONLY the real `v{version} · build {n}` a tester needs to report
          against. (Pinned by `settingsElevationAndMarker.test.ts`.) */}
      {__DEV__ ? (
        <>
          <SectionHeading title="Build" />
          <SettingsCard
            testID="settings-card-build"
            style={{ paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <Text
              testID="settings-build-marker"
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                fontVariant: ["tabular-nums"],
              }}
            >
              {`v${
                Constants.expoConfig?.version ?? "?"
              } · build ${
                (Constants as unknown as { nativeBuildVersion?: string })
                  .nativeBuildVersion ??
                Constants.expoConfig?.ios?.buildNumber ??
                "?"
              }`}
            </Text>
          </SettingsCard>
        </>
      ) : null}

      {/* Danger zone */}
      <SectionHeading title="Danger zone" />
      <SettingsCard testID="settings-card-danger">
        <SettingsRow
          testID="settings-bundle-reset-row"
          isFirst
          icon={RefreshCw}
          iconColor={t.amber}
          label="Reset or erase data"
          sub="New targets, or wipe log, library & plans"
          onPress={() => setResetModalOpen(true)}
        />
      </SettingsCard>

      {/* Delete account — Sloe DS (Figma 09 Settings `335:2`): a centered
          clay text affordance at the very bottom, not a destructive card
          row. Same two-step typed-"delete" confirm flow as before (now in
          `handleDeleteAccount`). testID `settings-bundle-delete-account-row`
          preserved (pinned by settingsBundleParity.test.ts). */}
      <Pressable
        testID="settings-bundle-delete-account-row"
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
        onPress={deleteAccount.handleDeleteAccount}
        style={{
          alignItems: "center",
          paddingVertical: 18,
          marginTop: 12,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: t.red }}>
          Delete account
        </Text>
      </Pressable>

      {/* Sign Out lives in the parent /(tabs)/settings.tsx as a single
          neutral row beneath this bundle. Sign Out is reversible
          (sign back in is a single tap), so red is reserved for
          irreversible actions like Delete Account. The bundle no
          longer renders its own destructive-bordered Sign Out (P1-5,
          `claude/settings-mobile-structural-fix` 2026-05-01). */}

      {/* Reset / erase modal */}
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
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setResetModalOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: Radius.full,
                  backgroundColor: t.amber + "18",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: Spacing.md,
                }}
              >
                <RefreshCw size={24} color={t.amber} strokeWidth={1.75} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                Refresh your plan
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 6,
                  maxWidth: 300,
                  lineHeight: 18,
                }}
              >
                Walk through setup again to update your weight, height, goals, and macros.
              </Text>
            </View>

            {/* Audit 2026-05-12 (premium-bar Phase 2) — replace the prior
                60-word paragraph with two scannable bullet rows so the
                user can compare options at a glance. Linear / Apple pattern:
                green check = kept, red cross = removed. */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: Radius.md,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: Spacing.lg,
                gap: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ color: t.green, fontWeight: "700", fontSize: 13, marginTop: 1 }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>Refresh my plan</Text> keeps your food log, weight history, recipes, plans, saves, and shopping lists.
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ color: t.red, fontWeight: "700", fontSize: 13, marginTop: 1 }}>✗</Text>
                <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>Erase everything</Text> wipes all of the above. Your account and subscription stay.
                </Text>
              </View>
            </View>

            {/* Refresh my plan — PRIMARY (Sloe button canon, 2026-06-12). The
                main (non-destructive) action in the reset modal: solid
                aubergine pill, white label + white sub-line, sitting visually
                above the red "Erase everything" so the safe path reads as the
                affirmative CTA and the destructive path stays red. */}
            <SupprButton
              variant="primary"
              onPress={() => handleRefreshPlan()}
              disabled={resetting}
              loading={resetting}
              accessibilityLabel="Refresh my plan"
              style={{ marginBottom: Spacing.sm }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  Refresh my plan
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    opacity: 0.8,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  Re-run setup — keeps recipes, plans, saves
                </Text>
              </View>
            </SupprButton>

            <Pressable
              onPress={() => {
                // 2026-05-12 (premium-bar audit DC9 type-confirm gate):
                // Replaced Alert.alert with a custom modal that requires
                // the user to type "RESET" before the destructive CTA
                // enables. Apple's pattern for irreversible destruction
                // (the iOS "Type DELETE to confirm" gate). The Alert
                // had no friction beyond the destructive-button style
                // — a misclick on "Erase everything" wiped everything.
                // P1-6 (2026-05-01) copy preserved: "Delete your data
                // and start fresh?" headline + the full wipe-list
                // (food log, journal, library saves, shopping lists,
                // imported recipes, synced activity). Categories list
                // is behaviour-pinned in `settingsBundleParity.test.ts`.
                setEraseConfirmInput("");
                setEraseConfirmOpen(true);
                setResetModalOpen(false);
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
              <Text style={{ color: t.red, fontWeight: "700", fontSize: 15 }}>
                Erase everything
              </Text>
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 11,
                  marginTop: 2,
                  textAlign: "center",
                  paddingHorizontal: 12,
                }}
              >
                Wipes all data and sends you through setup again
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setResetModalOpen(false)}
              style={{ paddingVertical: 14, alignItems: "center" }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 2026-05-12 (premium-bar audit DC9): Type-RESET-to-confirm modal
          for Erase Everything. Apple's pattern for irreversible
          destruction — friction proportional to consequence. The CTA
          is disabled until the user types "RESET" exactly. */}
      <Modal
        visible={eraseConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEraseConfirmOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: Spacing.xl,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: Radius.lg,
              paddingVertical: Spacing.xl,
              paddingHorizontal: Spacing.xl,
              width: "100%",
              maxWidth: 380,
              gap: Spacing.md,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                textAlign: "center",
              }}
            >
              Delete your data and start fresh?
            </Text>
            {/* 2026-05-12 (premium-bar audit DC9 polish): the prior
                paragraph body was a comma-separated list of what gets
                deleted vs what stays — easy to skim past, hard to
                reason about. Linear's pattern for destructive actions
                is scannable ✓/✗ bullets so the user can confirm at
                a glance "yes I'm OK with X going". Two columns: cleared
                (red ✗) and kept (green ✓). The "You can re-import"
                reassurance moves to a final caption row. */}
            <View style={{ gap: 6 }}>
              {[
                { label: "Food log", kept: false },
                { label: "Daily journal", kept: false },
                { label: "Library saves", kept: false },
                { label: "Shopping lists", kept: false },
                { label: "Imported recipes", kept: false },
                { label: "Synced activity", kept: false },
                { label: "Your account", kept: true },
                { label: "Subscription", kept: true },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      width: 14,
                      textAlign: "center",
                      color: row.kept ? Accent.success : t.red,
                    }}
                    accessibilityLabel={row.kept ? "Kept" : "Cleared"}
                  >
                    {row.kept ? "✓" : "✗"}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: row.kept ? colors.text : colors.textSecondary,
                      textDecorationLine: row.kept ? "none" : "line-through",
                    }}
                  >
                    {row.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
                textAlign: "center",
                lineHeight: 17,
                marginTop: Spacing.xs,
              }}
            >
              You can re-import from your export file anytime.
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
                textAlign: "center",
                marginTop: Spacing.xs,
              }}
            >
              Type <Text style={{ fontWeight: "700", color: t.red }}>RESET</Text> to confirm.
            </Text>
            <TextInput
              value={eraseConfirmInput}
              onChangeText={setEraseConfirmInput}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              placeholder="RESET"
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: eraseConfirmInput === "RESET" ? t.red : colors.cardBorder,
                borderRadius: Radius.md,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                fontWeight: "700",
                letterSpacing: 1,
                textAlign: "center",
                color: colors.text,
                backgroundColor: colors.background,
              }}
              testID="erase-confirm-input"
            />
            <Pressable
              onPress={() => {
                if (eraseConfirmInput !== "RESET") return;
                setEraseConfirmOpen(false);
                setEraseConfirmInput("");
                handleNukeEverything();
              }}
              disabled={eraseConfirmInput !== "RESET" || resetting}
              accessibilityRole="button"
              accessibilityLabel="Erase everything"
              testID="erase-confirm-cta"
              style={{
                backgroundColor: t.red,
                borderRadius: Radius.md,
                paddingVertical: 14,
                alignItems: "center",
                opacity: eraseConfirmInput !== "RESET" || resetting ? 0.35 : 1,
              }}
            >
              <Text style={{ color: colors.destructiveForeground, fontWeight: "700", fontSize: 15 }}>
                {resetting ? "Working..." : "Erase everything"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEraseConfirmOpen(false);
                setEraseConfirmInput("");
              }}
              style={{ paddingVertical: 10, alignItems: "center" }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Dashboard widgets picker */}
      <Modal
        visible={widgetPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWidgetPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setWidgetPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Dashboard Widgets
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
              }}
            >
              Choose which nutrients appear on your Today screen
            </Text>
            {(
              [
                { key: "protein", label: "Protein", color: mc.protein },
                { key: "carbs", label: "Carbs", color: mc.carbs },
                { key: "fat", label: "Fat", color: mc.fat },
                { key: "fiber", label: "Fiber", color: mc.fiber },
                { key: "sugar", label: "Sugar", color: mc.sugar },
                { key: "sodium", label: "Sodium", color: mc.sodium },
                { key: "water", label: "Water", color: mc.water },
              ] as const
            ).map(({ key, label, color }) => {
              const isActive = trackedMacros.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setTrackedMacros((prev) => {
                      const next = isActive
                        ? prev.filter((m) => m !== key)
                        : [...prev, key];
                      if (next.length === 0) return prev;
                      if (userId)
                        supabase
                          .from("profiles")
                          .update({ tracked_macros: next })
                          .eq("id", userId)
                          .then();
                      return next;
                    });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.cardBorder,
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: color,
                      marginRight: 12,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "500",
                      color: colors.text,
                    }}
                  >
                    {label}
                  </Text>
                  {isActive ? (
                    <CheckSquare
                      size={22}
                      color={accent.primary}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Square
                      size={22}
                      color={colors.textTertiary}
                      strokeWidth={1.75}
                    />
                  )}
                </Pressable>
              );
            })}
            {/* Done — GHOST (Sloe button canon, 2026-06-12). Inline picker
                dismiss action: transparent, no border, plum label. */}
            <SupprButton
              variant="ghost"
              onPress={() => setWidgetPickerOpen(false)}
              label="Done"
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </View>
      </Modal>

      {/* Caffeine target picker */}
      <Modal
        visible={caffeineTargetPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCaffeineTargetPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setCaffeineTargetPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Caffeine limit
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
              }}
            >
              EFSA and FDA both set 400 mg/day as the upper limit for healthy adults. Set your own comfortable ceiling.
            </Text>
            <TextInput
              accessibilityLabel="Caffeine limit in milligrams per day"
              keyboardType="number-pad"
              value={caffeineInput}
              onChangeText={setCaffeineInput}
              placeholder="400"
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: Radius.md,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.text,
              }}
            />
            <Text
              style={{
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 6,
              }}
            >
              Example: 400 mg ≈ 4 cups of coffee.
            </Text>
            {/* Save — GHOST (Sloe button canon, 2026-06-12). Inline picker
                confirm action: transparent, no border, plum label. */}
            <SupprButton
              variant="ghost"
              accessibilityLabel="Save caffeine limit"
              label="Save"
              style={{ marginTop: Spacing.lg }}
              onPress={async () => {
                const n = Math.max(
                  0,
                  Math.min(2000, Math.round(Number(caffeineInput))),
                );
                if (Number.isNaN(n)) {
                  setCaffeineInput(String(targetCaffeineMg));
                  return;
                }
                setTargetCaffeineMg(n);
                setCaffeineInput(String(n));
                if (userId) {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ target_caffeine_mg: n })
                    .eq("id", userId);
                  if (error) Alert.alert("Could not save", error.message);
                }
                setCaffeineTargetPickerOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Alcohol target picker */}
      <Modal
        visible={alcoholTargetPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAlcoholTargetPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setAlcoholTargetPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Alcohol limit (g/week)
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
              }}
            >
              Set 0 to hide the alcohol row. 14 g ethanol ≈ 1 US standard drink. 196 g/week = 14 UK units.
            </Text>
            <TextInput
              accessibilityLabel="Alcohol limit in grams per week"
              keyboardType="number-pad"
              value={alcoholInput}
              onChangeText={setAlcoholInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: Radius.md,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.text,
              }}
            />
            {/* Save — GHOST (Sloe button canon, 2026-06-12). Inline picker
                confirm action: transparent, no border, plum label. */}
            <SupprButton
              variant="ghost"
              accessibilityLabel="Save alcohol limit"
              label="Save"
              style={{ marginTop: Spacing.lg }}
              onPress={async () => {
                const n = Math.max(
                  0,
                  Math.min(2000, Math.round(Number(alcoholInput))),
                );
                if (Number.isNaN(n)) {
                  setAlcoholInput(String(targetAlcoholGWeekly));
                  return;
                }
                setTargetAlcoholGWeekly(n);
                setAlcoholInput(String(n));
                if (userId) {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ target_alcohol_g_weekly: n })
                    .eq("id", userId);
                  if (error) Alert.alert("Could not save", error.message);
                }
                setAlcoholTargetPickerOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Weekly recap push picker */}
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
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setWeeklyRecapPushPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Weekly recap
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
              }}
            >
              Get a one-tap summary of your week on{" "}
              {weekStartDay === "monday" ? "Sunday" : "Saturday"} evening. Off by choice — no reminder will be sent.
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
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Send weekly recap
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
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
                  setWeeklyRecapPushEnabled(next);
                  if (!userId) {
                    setWeeklyRecapPushEnabled(previous);
                    Alert.alert(
                      "Sign in required",
                      "Sign in to change this preference.",
                    );
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
                    // Server cron at /api/push/weekly-recap owns delivery
                    // since 2026-04-20; OFF still cancels any stale local
                    // schedule lingering in the OS queue.
                    if (!next) {
                      try {
                        await cancelWeeklyRecapPush();
                      } catch {
                        // captureException inside the helper already
                        // routes OS errors; never revert the DB toggle.
                      }
                    }
                    track(
                      AnalyticsEvents.weekly_recap_push_enabled_toggled,
                      { enabled: next },
                    );
                  })();
                }}
                trackColor={{ false: colors.border, true: accent.primary }}
              />
            </View>
            {/* Done — GHOST (Sloe button canon, 2026-06-12). Inline picker
                dismiss action: transparent, no border, plum label. */}
            <SupprButton
              variant="ghost"
              onPress={() => setWeeklyRecapPushPickerOpen(false)}
              label="Done"
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </View>
      </Modal>

      {/* Week start day picker */}
      <Modal
        visible={weekStartPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWeekStartPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setWeekStartPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: Spacing.lg,
              }}
            >
              Week starts on
            </Text>
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
                    try {
                      await saveWeekStartDay(supabase, userId, day);
                    } catch {
                      setWeekStartDay(previous);
                      Alert.alert(
                        "Could not save",
                        "We couldn't save your week-start preference. Please try again.",
                      );
                      return;
                    }
                    track(AnalyticsEvents.week_start_day_changed, {
                      from: previous,
                      to: day,
                    });
                  })();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "500",
                    color: colors.text,
                  }}
                >
                  {day === "monday" ? "Monday" : "Sunday"}
                </Text>
                {weekStartDay === day && (
                  <CheckCircle2
                    size={22}
                    color={accent.primary}
                    strokeWidth={1.75}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ENG-1177 — meal slot preset (classic / 4 / 6 meals). */}
      <Modal
        visible={mealSlotPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMealSlotPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setMealSlotPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: Spacing.lg,
              }}
            >
              Meal slots
            </Text>
            {MEAL_SLOT_PRESET_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                testID={`meal-slot-preset-${opt.id}`}
                onPress={() => {
                  const previous = mealSlotPreset;
                  if (previous === opt.id) {
                    setMealSlotPickerOpen(false);
                    return;
                  }
                  setMealSlotPreset(opt.id);
                  setMealSlotPickerOpen(false);
                  if (!userId) return;
                  void (async () => {
                    const { error } = await supabase
                      .from("profiles")
                      .update({ meal_slot_config: { preset: opt.id } })
                      .eq("id", userId);
                    if (error) {
                      setMealSlotPreset(previous);
                      Alert.alert(
                        "Could not save",
                        "We couldn't save your meal-slot preference. Please try again.",
                      );
                    }
                  })();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.cardBorder,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: colors.text }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {opt.description}
                  </Text>
                </View>
                {mealSlotPreset === opt.id ? (
                  <CheckCircle2 size={22} color={accent.primary} strokeWidth={1.75} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={pantryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPantryPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
              Pantry staples
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.lg }}>
              Ingredients you always keep on hand — we skip them when generating your shopping list.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.lg }}>
              {pantryStaples.map((name) => (
                <Pressable
                  key={name}
                  testID={`pantry-staple-chip-${name}`}
                  onPress={() => void savePantryStaples(pantryStaples.filter((s) => s !== name))}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.fillQuiet,
                  }}
                >
                  <Text style={{ fontSize: 13, color: colors.text }}>{name}</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>×</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                testID="pantry-staple-input"
                value={pantryInput}
                onChangeText={setPantryInput}
                placeholder="e.g. olive oil, salt"
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.lg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 15,
                }}
                onSubmitEditing={() => {
                  const next = pantryInput.trim();
                  if (!next) return;
                  if (pantryStaples.some((s) => s.toLowerCase() === next.toLowerCase())) {
                    setPantryInput("");
                    return;
                  }
                  void savePantryStaples([...pantryStaples, next]);
                  setPantryInput("");
                }}
              />
              <SupprButton
                label="Add"
                variant="primary"
                onPress={() => {
                  const next = pantryInput.trim();
                  if (!next) return;
                  if (pantryStaples.some((s) => s.toLowerCase() === next.toLowerCase())) {
                    setPantryInput("");
                    return;
                  }
                  void savePantryStaples([...pantryStaples, next]);
                  setPantryInput("");
                }}
              />
            </View>
            <Pressable
              onPress={() => setPantryPickerOpen(false)}
              style={{ marginTop: Spacing.lg, alignSelf: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: accent.primary }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Deficit summary window picker. Mirrors the week-start
          picker pattern + web Settings "Deficit summary"
          segmented control. Persists to
          `notification_prefs.weekSummaryMode`. */}
      <Modal
        visible={deficitWindowPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDeficitWindowPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => setDeficitWindowPickerOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: Spacing.xs,
              }}
            >
              Deficit summary
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
                lineHeight: 18,
              }}
            >
              On Today, when you have burn data: show averages for the last
              seven days ending on the day you view, or for the current
              calendar week (respecting your week start).
            </Text>
            {(
              [
                { value: "rolling", label: "Last 7 days" },
                { value: "calendar_week", label: "This week (Mon–Sun)" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.value}
                testID={`settings-bundle-deficit-window-option-${opt.value}`}
                accessibilityRole="button"
                accessibilityState={{
                  selected: weekSummaryMode === opt.value,
                }}
                onPress={() => {
                  setDeficitWindowPickerOpen(false);
                  void persistWeekSummaryMode(opt.value);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "500",
                    color: colors.text,
                  }}
                >
                  {opt.label}
                </Text>
                {weekSummaryMode === opt.value && (
                  <CheckCircle2
                    size={22}
                    color={accent.primary}
                    strokeWidth={1.75}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      {/* Cancel-flow export prompt (PR replaces #43, 2026-05-02).
          Closes journey-architect P1 — surfaces the data-export prompt
          AT the cancel touchpoint so users with active subscriptions
          aren't routed to RC's customerCenter without ever seeing the
          option to take their data with them first. Equal-weight CTAs,
          calm tone, no retention-via-friction. Web parity at
          `src/app/components/suppr/cancel-export-prompt-dialog.tsx`. */}
      <CancelExportPromptSheet
        visible={cancelPromptOpen}
        exporting={exportingCsv}
        onDismiss={() => setCancelPromptOpen(false)}
        onExport={() => {
          track(AnalyticsEvents.cancel_export_chosen, {
            source: "mobile",
            tier: profileData.userTier,
          });
          // Sheet stays open after the CSV runner returns so the user
          // can still tap "Continue to manage" or dismiss without a
          // second round-trip through Settings. Don't auto-dismiss on
          // export success.
          void runExportCsv();
        }}
        onContinueToManage={() => {
          track(AnalyticsEvents.cancel_proceeded, {
            source: "mobile",
            tier: profileData.userTier,
          });
          setCancelPromptOpen(false);
          void routeToCustomerCenter();
        }}
      />
      <DeleteAccountSheet
        visible={deleteAccount.open}
        onClose={() => deleteAccount.setOpen(false)}
        ledger={deleteAccount.ledger}
        loadingLedger={deleteAccount.loadingLedger}
        deleting={deleteAccount.deleting}
        exportingFirst={exportingEverything}
        onExportFirst={deleteAccount.exportFirst}
        onDeleteForever={deleteAccount.deleteForever}
      />
    </>
  );
}

export default SettingsBundleContent;
