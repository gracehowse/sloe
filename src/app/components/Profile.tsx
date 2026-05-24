import { memo, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { toast } from "sonner";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { computeProtectedStreak, readFreezeLedger, type FreezeLedger } from "../../lib/nutrition/streakFreeze.ts";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from "../../lib/units/imperial.ts";
import { Checkbox } from "./ui/checkbox.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  calculateBMR,
  calculateTDEE,
  calculateBudget,
  calculateMacros,
  type PlanPace,
  type NutritionStrategy,
} from "../../lib/nutrition/tdee.ts";
import { DIETARY_PREFERENCE_ENTRIES, normaliseDietaryFromProfile } from "../../constants/dietaryPreferences.ts";
// Household summary for the "People" row (renamed from "Everything
// else" 2026-05-02) — 2026-04-20 Claude
// Design prototype port. Uses the shared client so the count and
// sharing-preset subtitle stay in lockstep with what the bar and the
// settings page read. The row hides itself when the user isn't in a
// household (prototype behaviour; see `screens-mobile.jsx` L723).
import { getMyHousehold } from "../../lib/household/householdClient.ts";
import {
  presetFromShareLunch,
  sharingPresetShortLabel,
} from "../../lib/household/sharingGrid.ts";
import {
  parseSharingStateJson,
  sharingStorageKey,
} from "../../lib/household/sharingGridStorage.ts";

interface ProfileProps {
  userTier: "free" | "base" | "pro";
  displayName?: string | null;
  onUpgrade?: () => void;
  onOpenNutrition?: () => void;
}

export const Profile = memo(function Profile({ userTier, displayName, onUpgrade, onOpenNutrition }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<"targets" | "progress">("targets");
  const {
    nutritionTargets,
    setNutritionTargets,
    preferActivityAdjustedCalories,
    setPreferActivityAdjustedCalories,
    setProfileMeasurementSystem,
    nutritionByDay,
    savedRecipesForLibrary,
    // Goals & Targets surface (Pass 6 mobile parity, 2026-04-18) —
    // shown as quick-glance rows beneath Daily Targets so users can
    // see current Caffeine + Alcohol limits without leaving Profile.
    targetCaffeineMg,
    targetAlcoholGWeekly,
  } = useAppData();
  // Local mirrors of two profile fields not in AppDataContext —
  // weekStartDay and trackedMacros (a.k.a. Dashboard Widgets) — so we
  // can show their current values in the new Profile rows. Same DB
  // columns Settings.tsx reads.
  const [profileWeekStartDay, setProfileWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [profileTrackedMacros, setProfileTrackedMacros] = useState<string[]>([
    "protein",
    "carbs",
    "fat",
  ]);
  /** Household summary for the "People → Household" row. `null` means
   * "not in a household" → row hidden. */
  const [householdSummary, setHouseholdSummary] = useState<
    | { memberCount: number; subtitle: string }
    | null
  >(null);

  const loggingStats = useMemo(() => {
    const daysWithLogs = Object.keys(nutritionByDay).filter((k) => (nutritionByDay[k]?.length ?? 0) > 0);
    const totalMeals = daysWithLogs.reduce((acc, k) => acc + (nutritionByDay[k]?.length ?? 0), 0);
    const recentDayKeys = [...daysWithLogs].sort((a, b) => b.localeCompare(a)).slice(0, 7);
    return { daysWithLogs: daysWithLogs.length, totalMeals, recentDayKeys };
  }, [nutritionByDay]);

  // Numbers audit 2026-05-04 #4: Profile streak must apply freezes. Today,
  // Progress, and Weekly Recap all render `computeProtectedStreak` (with
  // ledger). Profile was using the raw `computeLoggingStreak`, so right
  // after a freeze auto-applied to a missed day Today read "26-day streak"
  // while Profile read "25-day streak" for the same user at the same
  // moment. Now both surfaces compute the same number.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({ earnedAt: [], usedHistory: [] });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const streakDays = useMemo(
    () => computeProtectedStreak(nutritionByDay as never, freezeLedger, freezeBudgetMax).streakLength,
    [nutritionByDay, freezeLedger, freezeBudgetMax],
  );
  const recipeCount = savedRecipesForLibrary?.length ?? 0;
  // Dynamic profile metadata
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [notificationPref, setNotificationPref] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [manualTargets, setManualTargets] = useState(() => normalizeMacroTargets(nutritionTargets));
  const [activityAdjustPref, setActivityAdjustPref] = useState(preferActivityAdjustedCalories);

  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [sex, setSex] = useState<"male" | "female" | "unspecified">("female");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  const [goal, setGoal] = useState<"cut" | "maintain" | "bulk">("maintain");
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [nutritionStrategy, setNutritionStrategy] = useState<NutritionStrategy>("balanced");
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightLb, setWeightLb] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!uid || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "sex, age, height_cm, weight_kg, activity_level, goal, plan_pace, nutrition_strategy, measurement_system, dietary, notification_prefs, week_start_day, tracked_macros, streak_freezes_earned_at, streak_freezes_used_history, streak_freeze_budget_max",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!profile || cancelled) return;

      // Numbers audit 2026-05-04 #4: hydrate streak-freeze state so the
      // protected streak helper sees the same ledger Today + Progress
      // already see.
      const ledger = readFreezeLedger({
        earnedAt: (profile as { streak_freezes_earned_at?: unknown }).streak_freezes_earned_at,
        usedHistory: (profile as { streak_freezes_used_history?: unknown }).streak_freezes_used_history,
      });
      setFreezeLedger(ledger);
      const budget = (profile as { streak_freeze_budget_max?: unknown }).streak_freeze_budget_max;
      if (typeof budget === "number" && Number.isFinite(budget) && budget >= 0) {
        setFreezeBudgetMax(budget);
      }

      // Goals & Targets parity rows (Pass 6, 2026-04-18). Same DB
      // shape Settings.tsx reads.
      const wsd = (profile as { week_start_day?: unknown }).week_start_day;
      if (wsd === "monday" || wsd === "sunday") setProfileWeekStartDay(wsd);
      const tm = (profile as { tracked_macros?: unknown }).tracked_macros;
      if (Array.isArray(tm) && tm.length > 0) {
        setProfileTrackedMacros(tm.filter((x): x is string => typeof x === "string"));
      }

      setAge(profile.age as number | null);
      setWeight(profile.weight_kg as number | null);
      setHeight(profile.height_cm as number | null);
      if (profile.sex) setSex(profile.sex as "male" | "female" | "unspecified");
      if (profile.activity_level) setActivityLevel(profile.activity_level as typeof activityLevel);
      if (profile.goal) setGoal(profile.goal as typeof goal);
      if (profile.plan_pace) setPlanPace(profile.plan_pace as PlanPace);
      if (profile.nutrition_strategy) setNutritionStrategy(profile.nutrition_strategy as NutritionStrategy);
      if (profile.measurement_system === "imperial" || profile.measurement_system === "metric") {
        setMeasurementSystem(profile.measurement_system);
      }
      const dietaryIds = normaliseDietaryFromProfile(profile.dietary);
      if (dietaryIds.length > 0) {
        setDietaryRestrictions(
          dietaryIds.map((id) => DIETARY_PREFERENCE_ENTRIES.find((e) => e.id === id)?.label ?? id),
        );
      }
      // Notification prefs
      if (profile.notification_prefs && typeof profile.notification_prefs === "object") {
        const np = profile.notification_prefs as Record<string, unknown>;
        if (np.reminder_time) setNotificationPref(String(np.reminder_time));
      }
      // Join date from auth user
      const createdAt = data.session?.user?.created_at;
      if (createdAt) setJoinedAt(createdAt);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActivityAdjustPref(preferActivityAdjustedCalories);
  }, [preferActivityAdjustedCalories]);

  // Load household summary for the Household row. Failing this load
  // just hides the row — never block the rest of the page.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: authData } = await supabase.auth.getSession();
      const uid = authData.session?.user.id ?? null;
      if (!uid || cancelled) return;
      try {
        const { data: hh } = await getMyHousehold(supabase as any, uid);
        if (cancelled) return;
        if (!hh?.household) {
          setHouseholdSummary(null);
          return;
        }
        let preset = presetFromShareLunch(Boolean(hh.household.shareLunch));
        try {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem(sharingStorageKey(hh.household.id));
            const parsed = parseSharingStateJson(raw);
            if (parsed) preset = parsed.preset;
          }
        } catch {
          // Ignore — fall back to the derived preset.
        }
        const count = hh.members.length;
        setHouseholdSummary({
          memberCount: count,
          subtitle: `${count} ${count === 1 ? "person" : "people"} · ${sharingPresetShortLabel(preset)}`,
        });
      } catch {
        if (!cancelled) setHouseholdSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (height != null) {
      const { feet, inches } = cmToFeetInches(height);
      setHeightFt(String(feet));
      setHeightIn(String(inches));
    }
    if (weight != null) {
      setWeightLb(kgToLb(weight).toFixed(1));
    }
  }, [measurementSystem, height, weight]);

  const hasBodyStats = age != null && weight != null && height != null;

  const computedTargets = useMemo(() => {
    if (!hasBodyStats) return null;
    const bmr = calculateBMR(sex, weight, height, age);
    const tdee = calculateTDEE(sex, weight, height, age, activityLevel);
    const calories = calculateBudget(tdee, planPace, goal);
    const macros = calculateMacros(calories, nutritionStrategy, weight);
    const waterMl = Math.min(4500, Math.max(1500, Math.round(weight * 33)));
    return { bmr, tdee, calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber, waterMl };
  }, [hasBodyStats, sex, weight, height, age, activityLevel, planPace, goal, nutritionStrategy]);

  const displayTargets = useMemo(() => {
    const raw =
      nutritionTargets?.calories && nutritionTargets?.protein
        ? nutritionTargets
        : computedTargets ?? {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            waterMl: 0,
          };
    return normalizeMacroTargets(raw);
  }, [nutritionTargets, computedTargets]);

  useEffect(() => {
    if (!isEditingTargets) {
      setManualTargets({ ...displayTargets });
    }
  }, [displayTargets, isEditingTargets]);

  const canSave = useMemo(() => {
    return (
      Number.isFinite(manualTargets.calories) &&
      Number.isFinite(manualTargets.protein) &&
      Number.isFinite(manualTargets.carbs) &&
      Number.isFinite(manualTargets.fat) &&
      Number.isFinite(manualTargets.fiber) &&
      Number.isFinite(manualTargets.waterMl) &&
      manualTargets.calories > 0
    );
  }, [manualTargets]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!uid) {
        toast.error("Please sign in again.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: uid,
            sex,
            age,
            height_cm: height,
            weight_kg: weight,
            activity_level: activityLevel,
            goal,
            measurement_system: measurementSystem,
            target_calories: manualTargets.calories,
            // A2 provenance — web manual macro/calorie save. `canSave` already
            // guards manualTargets.calories > 0, so stamping is honest here.
            // (migration 20260427110000)
            target_calories_set_at: new Date().toISOString(),
            target_calories_source: "user",
            target_protein: manualTargets.protein,
            target_carbs: manualTargets.carbs,
            target_fat: manualTargets.fat,
            target_fiber_g: manualTargets.fiber,
            target_water_ml: manualTargets.waterMl,
            prefer_activity_adjusted_calories: activityAdjustPref,
          },
          { onConflict: "id" },
        );

      if (error) {
        toast.error(error.message);
        return;
      }

      setNutritionTargets(normalizeMacroTargets(manualTargets));
      setPreferActivityAdjustedCalories(activityAdjustPref);
      setProfileMeasurementSystem(measurementSystem);
      setIsEditingTargets(false);
      toast.success("Saved profile");
      track(AnalyticsEvents.profile_targets_saved, { activityAdjusted: activityAdjustPref });
    } finally {
      setSaving(false);
    }
  };

  // Prototype port (2026-04-20, web parity with mobile commit 26a63bf)
  // — helpers for the phone-top header + profile card. Kept inline to
  // mirror mobile's structure 1:1; `displayName`, `userTier`, and
  // `joinedAt` are the same sources the old inline block used.
  const avatarInitial = (displayName?.[0] ?? "P").toUpperCase();
  // PR-01 (audit 2026-04-28): legacy `userTier === "base"` rows
  // display as "Free" — the user has no active paid entitlement
  // post-collapse.
  const tierLabel = userTier === "pro" ? "Pro" : "Free";
  // Ink avatar — matches mobile `GradientAvatar` default (premium chrome).
  const joinedLabel = joinedAt
    ? (() => {
        const d = new Date(joinedAt);
        const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (diffDays < 7) return "Joined this week";
        if (diffDays < 30) return `Joined ${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `Joined ${Math.floor(diffDays / 30)}mo ago`;
        return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
      })()
    : "Joined recently";

  return (
    <div className="product-shell py-pm-5">
      {/* Phone-top header — prototype port (2026-04-20, web parity
          with mobile More commit 26a63bf): ACCOUNT overline + large
          "More" title + round avatar-initial button on the right.
          Replaces the old inline "avatar + name row". The display-name
          + tier + joined-at details that used to live in that header
          now render inside the profile card immediately below, which
          mirrors the mobile More tab layout one-to-one. Tab is still
          the same route (`?view=profile`) — only the header presentation
          changed; no router / nav changes. */}
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Account
          </p>
          <h1 className="text-[28px] font-bold text-foreground -tracking-[0.02em] mt-0.5 leading-tight font-serif">
            More
          </h1>
        </div>
        <button
          type="button"
          aria-label="Your profile"
          className="shrink-0 w-10 h-10 rounded-full grid place-items-center text-[13px] font-bold bg-primary text-primary-foreground"
        >
          {avatarInitial}
        </button>
      </div>

      {/* Profile card — 52×52 gradient avatar + display-name +
          tier·joined subline + tier pill. Matches the mobile profile
          card (`apps/mobile/app/(tabs)/more.tsx` ~L451) including the
          subtle tier-coloured pill on the right. */}
      <div className="flex items-center gap-3.5 mb-4 rounded-xl border border-border bg-card p-3.5 card-elevated">
        <div
          className="w-[52px] h-[52px] rounded-full grid place-items-center text-lg font-bold bg-primary text-primary-foreground shrink-0"
        >
          {avatarInitial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground leading-tight truncate">
            {displayName?.trim() ? displayName : "Your profile"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {tierLabel} tier &middot; {joinedLabel}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
            userTier === "pro"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {tierLabel}
        </span>
      </div>

      {/* P1-20 web parity (TestFlight `AHS6xzy…` / `AA63DQ7xd…`,
          2026-04-21+): Score pill removed — tester rejected it twice
          ("doesn't mean anything, remove"). Mobile parity:
          `apps/mobile/app/(tabs)/more.tsx`. Recipes + Streak stay. */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 text-center p-3 rounded-xl bg-card border border-border card-elevated">
          <p className="text-lg font-bold text-primary tabular-nums">{recipeCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Recipes</p>
        </div>
        <div className="flex-1 text-center p-3 rounded-xl bg-card border border-border card-elevated">
          <p className="text-lg font-bold text-success tabular-nums">{streakDays}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Streak</p>
        </div>
      </div>

      {/* Upgrade banner — shown to free + base users (mobile parity:
          `apps/mobile/app/(tabs)/more.tsx` 416). Pro users see no
          banner. The CTA navigates to the canonical /pricing route via
          the parent's `onUpgrade` handler when provided, else falls
          back to a direct URL push. */}
      {userTier !== "pro" ? (
        <button
          type="button"
          onClick={() => {
            if (onUpgrade) onUpgrade();
            else if (typeof window !== "undefined") window.location.href = "/pricing?from=settings";
          }}
          className="w-full flex items-center gap-3 mb-4 p-3.5 rounded-xl border bg-primary/10 border-primary/30 hover:bg-primary/15 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Upgrade to Pro"
        >
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-primary/20 shrink-0">
            <Icons.premium className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-foreground">Upgrade to Pro</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Multi-day plans, adaptive TDEE, and AI logging
            </span>
          </span>
          <Icons.forward className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      ) : null}

      {/* P1-20 web parity (2026-04-25): Suppr Score info popover
          removed alongside the Score pill. */}

      {/* People — prototype "More → Household" row. Renders only when
          the user is in a household (mirrors mobile `(tabs)/more.tsx`
          and `screens-mobile.jsx` L723). The row hands off to
          `?view=household-settings` which mounts the prototype
          HouseholdSettingsPage.

          2026-05-02 — section was "Everything else" until a single
          Household row made the catch-all label feel arbitrary (user
          feedback). Renamed to "People" to describe the row that
          lives here today. Mobile mirror in
          `apps/mobile/components/settings/SettingsBundleContent.tsx`. */}
      {householdSummary ? (
        <div className="mb-4">
          <h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">
            People
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden card-elevated">
            <a
              href="/home?view=household-settings"
              data-testid="profile-household-row"
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <IconBox tone="primary" size="md" className="rounded-[10px]">
                <Icons.users className="w-4 h-4" />
              </IconBox>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Household</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {householdSummary.subtitle}
                </p>
              </div>
              <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          </div>
        </div>
      ) : null}

      {/* Settings Section — sentence-case heading (prototype parity,
          2026-04-20 mobile commit 26a63bf). Previous uppercase overline
          was replaced across every group on this page so it matches
          the mobile "More" treatment. */}
      <div className="mb-4">
        <h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">Settings</h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden card-elevated">
          {/* Daily Targets Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.calories className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Daily Targets</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{(() => { const t = normalizeMacroTargets(nutritionTargets); return `${t.calories.toLocaleString()} kcal • ${t.protein}P / ${t.carbs}C / ${t.fat}F`; })()}</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Goals & Targets parity rows (Pass 6, 2026-04-18) — mobile
              has a dedicated "Goals & Targets" section with these as
              separate rows so values are scannable at a glance. We
              expose them inside Settings on web (rather than create a
              new section) to avoid disturbing the existing IA. Each
              row navigates to /?view=settings where the editor lives. */}

          {/* Dashboard Widgets — which macros render as tiles on Today */}
          <a
            href="/home?view=settings"
            className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.layoutGrid className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Dashboard Widgets</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {profileTrackedMacros.length > 0
                  ? profileTrackedMacros.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")
                  : "Defaults"}
              </p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>

          {/* Week starts on */}
          <a
            href="/home?view=settings"
            className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.plan className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Week starts on</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {profileWeekStartDay === "monday" ? "Monday" : "Sunday"}
              </p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>

          {/* Caffeine limit */}
          <a
            href="/home?view=settings"
            className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.energy className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Caffeine limit</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {targetCaffeineMg} mg/day · FDA guideline is 400 mg
              </p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>

          {/* Alcohol limit */}
          <a
            href="/home?view=settings"
            className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.water className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Alcohol limit</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {targetAlcoholGWeekly > 0
                  ? `${targetAlcoholGWeekly} g/week`
                  : "Off · set a target to show the row"}
              </p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>

          {/* Preferences Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.dinner className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Preferences</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "No restrictions"}</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Connected Row — non-interactive on web */}
          <div
            className="flex items-center gap-4 px-4 py-3 border-b border-border opacity-60"
          >
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.link className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Apple Health</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Syncs steps, weight, and activity on iOS. Not available on web.</p>
            </div>
          </div>

          {/* Notifications Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.time className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Notifications</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{notificationPref ? `Daily reminder at ${notificationPref}` : "Off"}</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Export Data Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.import className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Export Data</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">CSV download</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Help Row — matches mobile */}
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="md" className="rounded-[10px]">
              <Icons.info className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Help</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">FAQs and support</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </div>

      {/* Creator Tools Section — sentence-case heading (prototype parity). */}
      <div className="mb-4">
        <h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">Creator tools</h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden card-elevated">
          {/* Published Recipes Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="md" className="rounded-[10px]">
              <Icons.edit className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Published Recipes</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{recipeCount} recipes saved</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Analytics Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="md" className="rounded-[10px]">
              <Icons.progress className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Analytics</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">Views, saves, engagement</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Publish New Row */}
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="md" className="rounded-[10px]">
              <Icons.add className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Publish New</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">Share with the community</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </div>

      {/* Legal Section — sentence-case heading (prototype parity). */}
      <div className="mb-4">
        <h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">Legal</h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden card-elevated">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <span className="text-[13px] font-semibold text-foreground">Terms of Service</span>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <span className="text-[13px] font-semibold text-foreground">Privacy Policy</span>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
          </div>
        </div>
      </div>

      {/* Sign Out — matches mobile */}
      <button
        type="button"
        onClick={() => {
          void supabase.auth.signOut();
          toast.success("Signed out");
        }}
        className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors mb-4"
      >
        Sign Out
      </button>

      {/* Tabs */}
      <div className="border-t border-border pt-8">
        <div className="flex gap-6 mb-4">
          <button
            onClick={() => setActiveTab("targets")}
            className={`pb-3 border-b-2 transition-colors font-medium ${
              activeTab === "targets"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Macro Calculator
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={`pb-3 border-b-2 transition-colors font-medium ${
              activeTab === "progress"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Progress Tracking
          </button>
        </div>
      </div>

      {activeTab === "targets" && (
        <div className="space-y-8">
          {/* Macro Calculator */}
          <div className="bg-card border border-border rounded-xl p-4 card-elevated">
            <div className="flex items-center gap-2 mb-6">
              <IconBox tone="primary" size="md">
                <Icons.target className="w-5 h-5" />
              </IconBox>
              <h3 className="text-foreground">Calculate Your Targets</h3>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-foreground">Units</label>
              <select
                value={measurementSystem}
                onChange={(e) => setMeasurementSystem(e.target.value as "metric" | "imperial")}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="metric">Metric (cm, kg)</option>
                <option value="imperial">Imperial (ft/in, lb)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">Age</label>
                <input
                  type="number"
                  value={age ?? ""}
                  placeholder="e.g. 28"
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">Sex</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female" | "unspecified")}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unspecified">Prefer not to say</option>
                </select>
              </div>
              {measurementSystem === "metric" ? (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-foreground">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weight ?? ""}
                      placeholder="e.g. 65"
                      onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-foreground">Height (cm)</label>
                    <input
                      type="number"
                      value={height ?? ""}
                      placeholder="e.g. 170"
                      onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-foreground">Height (ft)</label>
                      <input
                        type="number"
                        min={0}
                        value={heightFt}
                        onChange={(e) => setHeightFt(e.target.value)}
                        onBlur={() => {
                          const ft = Number(heightFt);
                          const inch = Number(heightIn);
                          if (Number.isFinite(ft) && Number.isFinite(inch) && inch >= 0 && inch < 12) {
                            setHeight(Math.round(feetInchesToCm(ft, inch)));
                          }
                        }}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-foreground">Height (in)</label>
                      <input
                        type="number"
                        min={0}
                        value={heightIn}
                        onChange={(e) => setHeightIn(e.target.value)}
                        onBlur={() => {
                          const ft = Number(heightFt);
                          const inch = Number(heightIn);
                          if (Number.isFinite(ft) && Number.isFinite(inch) && inch >= 0 && inch < 12) {
                            setHeight(Math.round(feetInchesToCm(ft, inch)));
                          }
                        }}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-2 text-sm font-medium text-foreground">Weight (lb)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      onBlur={() => {
                        const lb = Number(weightLb.replace(",", "."));
                        if (Number.isFinite(lb) && lb > 0) {
                          setWeight(Math.round(lbToKg(lb) * 10) / 10);
                        }
                      }}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mb-6">
              <label className="block mb-3 text-sm font-medium text-foreground">Activity Level</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
                  { value: "light", label: "Light", desc: "1-3 days/week" },
                  { value: "moderate", label: "Moderate", desc: "3-5 days/week" },
                  { value: "active", label: "Active", desc: "6-7 days/week" },
                  { value: "very_active", label: "Very Active", desc: "2x per day" },
                ].map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setActivityLevel(level.value as typeof activityLevel)}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      activityLevel === level.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-medium text-foreground">{level.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{level.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-3 text-sm font-medium text-foreground">Goal</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "cut", label: "Lose weight", desc: "Deficit" },
                  { value: "maintain", label: "Eat healthier", desc: "Maintain" },
                  { value: "bulk", label: "Build muscle", desc: "Surplus" },
                ].map((goalOption) => (
                  <button
                    key={goalOption.value}
                    onClick={() => setGoal(goalOption.value as typeof goal)}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${
                      goal === goalOption.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-medium text-foreground">{goalOption.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{goalOption.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground">
              {/* ENG-534 (2026-05-16): BMR/TDEE are HIGH-class derived
                  body-stats. `ph-mask` makes PostHog session-replay
                  render the value spans as grey blocks. See
                  `docs/operations/session-replay-masking-audit.md`. */}
              <p>
                BMR: <span className="ph-mask">{computedTargets ? Math.round(computedTargets.bmr) : "—"} kcal</span> · TDEE: <span className="ph-mask">{computedTargets ? Math.round(computedTargets.tdee) : "—"} kcal</span>
              </p>
              <p className="mt-1">Using Mifflin-St Jeor equation with activity multipliers</p>
            </div>
          </div>

          {/* Calculated Targets */}
          <div className="bg-card border border-border rounded-xl overflow-hidden card-elevated">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <IconBox tone="primary" size="sm">
                <Icons.trendUp className="w-4 h-4" />
              </IconBox>
              <h3 className="text-sm font-semibold text-foreground">Your Daily Targets</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.calories}
                    onChange={(e) => setManualTargets((p) => ({ ...p, calories: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.calories}</p>
                )}
                <p className="text-sm text-muted-foreground">Calories</p>
              </div>
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.protein}
                    onChange={(e) => setManualTargets((p) => ({ ...p, protein: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.protein}g</p>
                )}
                <p className="text-sm text-muted-foreground">Protein</p>
                <p className="text-xs text-muted-foreground mt-1">2.2g per kg</p>
              </div>
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.carbs}
                    onChange={(e) => setManualTargets((p) => ({ ...p, carbs: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.carbs}g</p>
                )}
                <p className="text-sm text-muted-foreground">Carbs</p>
                <p className="text-xs text-muted-foreground mt-1">Remainder</p>
              </div>
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.fat}
                    onChange={(e) => setManualTargets((p) => ({ ...p, fat: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.fat}g</p>
                )}
                <p className="text-sm text-muted-foreground">Fat</p>
                <p className="text-xs text-muted-foreground mt-1">25% of kcal</p>
              </div>
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.fiber}
                    onChange={(e) => setManualTargets((p) => ({ ...p, fiber: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.fiber}g</p>
                )}
                <p className="text-sm text-muted-foreground">Fiber</p>
              </div>
              <div className="px-4 py-4 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.waterMl}
                    onChange={(e) => setManualTargets((p) => ({ ...p, waterMl: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-[22px] font-bold text-foreground mb-1">{displayTargets.waterMl}</p>
                )}
                <p className="text-sm text-muted-foreground">Water (ml)</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-muted space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={activityAdjustPref}
                  onCheckedChange={(c) => setActivityAdjustPref(c === true)}
                  disabled={!isEditingTargets}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Adjust calories for activity</span>
                  <span className="block mt-1">
                    When on, your daily calorie goal increases by the activity burn you log in the Tracker. Net goal = base target + activity burn for that day.
                  </span>
                </span>
              </label>
              <p className="text-sm text-muted-foreground">
                All targets are customizable. Click &quot;Edit Targets&quot; to override these values with your own preferences.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {!isEditingTargets ? (
              <button
                type="button"
                onClick={() => setIsEditingTargets(true)}
                className="flex-1 py-3 border-2 border-border rounded-xl hover:bg-muted/60 transition-all text-foreground font-medium"
              >
                Edit Targets Manually
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTargets(false);
                    setManualTargets({ ...displayTargets });
                    setActivityAdjustPref(preferActivityAdjustedCalories);
                  }}
                  className="flex-1 py-3 border-2 border-border rounded-xl hover:bg-muted/60 transition-all text-foreground font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave || saving}
                  onClick={() => void saveProfile()}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "progress" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-4 card-elevated">
            <div className="flex items-center gap-2 mb-3">
              <IconBox tone="primary" size="md">
                <Icons.activity className="w-5 h-5" />
              </IconBox>
              <h3 className="text-foreground">Weight</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Weight history and charts are not available yet. The number below is your{" "}
              <strong className="text-foreground">profile weight</strong> from the Targets tab—it updates
              when you save your profile.
            </p>
            <div className="rounded-xl bg-muted border border-border p-4 text-center">
              <p className="text-3xl font-bold text-foreground">
                {measurementSystem === "imperial" ? `${weightLb} lb` : `${weight} kg`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Current (profile)</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-4 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <IconBox tone="success" size="sm">
                  <Icons.target className="w-5 h-5" />
                </IconBox>
                <p className="text-sm text-muted-foreground">Days with food logged</p>
              </div>
              <p className="text-4xl font-bold text-foreground">{loggingStats.daysWithLogs}</p>
              <p className="text-xs text-muted-foreground mt-2">Distinct days in your nutrition journal</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <IconBox tone="primary" size="sm">
                  <Icons.dinner className="w-5 h-5" />
                </IconBox>
                <p className="text-sm text-muted-foreground">Total log entries</p>
              </div>
              <p className="text-4xl font-bold text-foreground">{loggingStats.totalMeals}</p>
              <p className="text-xs text-muted-foreground mt-2">Meals and snacks recorded across all days</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 card-elevated">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-foreground">Recent days</h3>
              {onOpenNutrition ? (
                <button
                  type="button"
                  onClick={onOpenNutrition}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all text-sm font-medium shrink-0"
                >
                  Open tracker
                </button>
              ) : null}
            </div>
            {loggingStats.recentDayKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No nutrition log yet. Use Nutrition to add food—counts here update from your real journal (stored on this
                device and synced when cloud sync is available).
              </p>
            ) : (
              <ul className="space-y-2">
                {loggingStats.recentDayKeys.map((key) => {
                  const n = nutritionByDay[key]?.length ?? 0;
                  const label = (() => {
                    try {
                      const [y, mo, d] = key.split("-").map(Number);
                      const dt = new Date(y, mo - 1, d);
                      return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                    } catch {
                      return key;
                    }
                  })();
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-sm"
                    >
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground">
                        {n} {n === 1 ? "entry" : "entries"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
