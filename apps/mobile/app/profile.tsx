import { useMemo, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Check,
  Circle,
  User,
  ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import { MACRO_ICONS } from "@/lib/macroIconsLucide";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, MacroColorsDark, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { SupprButton } from "@/components/ui/SupprButton";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
  type DietaryPreferenceId,
} from "../../../src/constants/dietaryPreferences";
import { PROFILE_TARGETS_DIRTY_KEY } from "@/lib/profileTargetsDirtyFlag";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { recordGoalHistory } from "@suppr/nutrition-core/goalHistory";
import {
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
  type StreakByDay,
} from "@/lib/streakFreeze";
import { buildEditorialProfileBlock } from "@/lib/editorialProfileBlock";
import { useSavedLibraryRecipes, useSavesHeadCount } from "@/lib/recipes";
import { GoalPaceEditorSheet } from "@/components/recap/GoalPaceEditorSheet";
import { ProfileShowcaseReadView } from "@/components/profile/ProfileShowcaseReadView";
import { EditorialProfileBlock } from "@/components/profile/EditorialProfileBlock";
import { ProfileIdentityStrip } from "@/components/profile/ProfileIdentityStrip";

export default function ProfileScreen() {
  const colors = useThemeColors();
  // `accent` (aubergine) drives the loading spinner. The Save CTA + selected
  // dietary pills now use the static `accent.primarySolid` / `accent.primarySoft`
  // treatment tokens directly (Sloe, 2026-06-08). Macros keep `MacroColors`.
  const accent = useAccent(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  // One-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-
  // soft-elevation.md): the identity card AND the Daily Targets / Edit Targets /
  // Dietary Preferences cards all sit directly on the page ground, so they take the
  // SOFT lift, routed through the elevation system (was a hand-rolled
  // `Elevation.cardSoft` on the identity card + a flat hairline card on the rest).
  const cardElevation = useCardElevation({ variant: "soft" });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // /(tabs)/more was collapsed to a redirect → /(tabs)/settings (Group G
  // Batch D, 2026-04-29). Targeting the live destination directly avoids
  // the redirect chain when the user taps Back.
  const goBack = useSafeBack("/(tabs)/settings");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // §3.2 identity card + §3.7 body-stats entry row (settings.md). The new
  // editorial identity block + the body-stats row are net-new structure, so
  // both ship behind the `settings_redesign_v2` master gate (the old straight-
  // to-targets layout stays alive in the `else`). The body-stats row's
  // destination is itself gated by the existing `goal_editor` flag (matches
  // `targets.tsx` / web `Targets.tsx`): sheet when on, interim note when off.
  const settingsRedesignV2 = isFeatureEnabled("settings_redesign_v2");
  const profileShowcaseV1 = isFeatureEnabled("profile_showcase_v1");
  // ENG-1246 (Gap #16) — shared editorial Profile block (identity → streak dots
  // + best/freezes → milestones → recipe grid). Default-on; off → legacy strip.
  const editorialProfileV3 = isFeatureEnabled("sloe_v3_profile");
  const goalEditorEnabled = isFeatureEnabled("goal_editor");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  // §3.2 identity signals — tier pill (Pro only), "Joined …" label, and the
  // Recipes + Day-streak stats strip. Streak uses the same
  // `computeProtectedStreak` helper Today / Progress / Settings use (no
  // hand-rolled count — that was the trust-killer fixed in the 2026-05-04
  // settings audit). Recipe count: see the `recipeCount` derivation below.
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");
  const [streak, setStreak] = useState(0);
  const [daysLogged, setDaysLogged] = useState(0);
  // ENG-1246 — retain the streak-walk byDay + freeze ledger so the editorial
  // dot row + best/freezes line share the SAME inputs.
  const [streakByDay, setStreakByDay] = useState<StreakByDay>({});
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({ earnedAt: [], usedHistory: [] });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState(3);
  // ENG-1246 — saved-recipe ROWS via the canonical Library/Today/Plan hook.
  // GATED (M2): the heavy saves+authored batch runs only flag-ON; flag-OFF
  // passes null (hook → `[]`) and uses the cheap head-only `saves` count below.
  // n13: flag-ON `recipeCount` is the Library-consistent set (drops orphaned
  // saves, adds authored) — not the raw head-count.
  const { recipes: savedRecipes } = useSavedLibraryRecipes(editorialProfileV3 ? userId : null);
  const savesHeadCount = useSavesHeadCount(editorialProfileV3 ? null : userId);
  const recipeCount = editorialProfileV3 ? savedRecipes.length : savesHeadCount;
  // §3.7 body-stats entry row → GoalPaceEditorSheet (weight/height/goal/pace).
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const joinedLabel = useMemo(() => {
    const createdAt = session?.user?.created_at;
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diffDays < 7) return "Joined this week";
    if (diffDays < 30) return `Joined ${Math.max(1, Math.floor(diffDays / 7))}w ago`;
    if (diffDays < 365) return `Joined ${Math.max(1, Math.floor(diffDays / 30))}mo ago`;
    return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }, [session?.user?.created_at]);
  // Monogram initial — display name first, else email, else "S" (Sloe). The
  // §3.2 warm anchor must render even on a name-less fresh account (gap #12).
  const monogramInitial = useMemo(() => {
    const fromName = displayName.trim()[0];
    if (fromName) return fromName.toUpperCase();
    const fromEmail = session?.user?.email?.trim()[0];
    if (fromEmail) return fromEmail.toUpperCase();
    return "S";
  }, [displayName, session?.user?.email]);
  // ENG-1246 — editorial model from already-loaded data (no fetches/writes).
  const editorialModel = useMemo(
    () => buildEditorialProfileBlock({ byDay: streakByDay, freezeLedger, freezeBudgetMax }),
    [streakByDay, freezeLedger, freezeBudgetMax],
  );
  const editorialRecipes = useMemo(
    () => savedRecipes.map((r) => ({ id: r.id, title: r.title, image: r.image || null })),
    [savedRecipes],
  );
  const [calories, setCalories] = useState(String(NUTRITION_DEFAULTS.calories));
  const [protein, setProtein] = useState(String(NUTRITION_DEFAULTS.protein));
  const [carbs, setCarbs] = useState(String(NUTRITION_DEFAULTS.carbs));
  const [fat, setFat] = useState(String(NUTRITION_DEFAULTS.fat));
  const [fiber, setFiber] = useState(String(NUTRITION_DEFAULTS.fiber));
  const [water, setWater] = useState(String(NUTRITION_DEFAULTS.water));
  const [dietary, setDietary] = useState<DietaryPreferenceId[]>([]);
  // P1-2 (parity spec 2026-04-27) — snapshot the last-loaded values so
  // the Cancel button can revert without a Supabase round-trip. Updated
  // every time `loadProfile` fills the form. Web parity:
  // `Profile.tsx` uses `displayTargets` as the cancel anchor.
  const loadedSnapshotRef = useRef<{
    displayName: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    water: string;
    dietary: DietaryPreferenceId[];
  } | null>(null);

  // P1-1 + 5.2 (parity spec 2026-04-27) — Save guard mirrors web
  // `Profile.tsx:257-267` exactly: every numeric field must parse to a
  // finite number and `calories > 0`. Save button is disabled until the
  // guard passes. Pre-fix, mobile accepted any string including `0` and
  // empty (silently writing `null` to `target_calories`).
  const canSave = useMemo(() => {
    const c = Number(calories);
    return (
      Number.isFinite(c) &&
      c > 0 &&
      Number.isFinite(Number(protein)) &&
      Number.isFinite(Number(carbs)) &&
      Number.isFinite(Number(fat)) &&
      Number.isFinite(Number(fiber)) &&
      Number.isFinite(Number(water))
    );
  }, [calories, protein, carbs, fat, fiber, water]);

  const toggleDietary = useCallback((id: DietaryPreferenceId) => {
    setDietary((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: 120,
      // §3.1 — 24 (xl) between same-topic card sections; 32 (xxl) is reserved
      // for major-section breaks. The two targets cards + dietary card are one
      // topic, so 24 keeps them from floating apart (gap #10).
      gap: Spacing.xl,
    },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    // §3.2 identity card + stats strip moved to `ProfileIdentityStrip`
    // (ENG-1246) — the legacy kill-switch UI; the editorial block owns the
    // flag-ON path. Their styles live in that component now.

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
    },
    backBtn: { color: colors.text, fontSize: 28, fontWeight: "600" },
    // 2026-04-30 (visual-qa #5, ui-critic): drop the all-caps + tracked
    // accent-blue title — every other nav header is title-case neutral.
    // Aligns with Claude Design phone-top spec (24/700/-0.02em, fg).
    headerTitle: { ...Type.headline, color: colors.text },

    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: Radius.lg,
      borderWidth: cardElevation.useBorder ? 1 : 0,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
      ...(cardElevation.shadowStyle ?? {}),
    },
    // §2.3 — section/card titles read in Newsreader serif (Type.headline,
    // 17/500), matching the serif tile numerals on the same card. The prior
    // Inter 16/700 created a mixed register against the serif numbers (gap #7).
    cardTitle: { ...Type.headline, color: colors.text },

    targetsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    targetTile: {
      // DRIFT-03 + DRIFT-07 (2026-05-22): white card surface + macro-
      // coloured outline border (the Profile watch-face moment), with
      // an interior layout that matches `TodayDashboardMacroTiles`
      // (uppercase label top-left + icon top-right + big tabular
      // value). Beige token now reserved for chips / pills / inputs.
      width: "47%",
      borderRadius: Radius.md,
      borderWidth: 1,
      backgroundColor: colors.card,
      // On-scale inset-tile padding (gap #6): single Spacing.md token, never
      // token+2 arithmetic which produced an off-scale 10.
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    targetTileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    targetTileLabel: { ...Type.label, color: colors.textTertiary },
    // SLOE Phase 0: the Profile target-tile hero numerals read in Newsreader
    // serif. `Type.heroValue` is the dedicated serif sibling of `Type.macroValue`
    // (same 20/24 box) so the swap is drop-in; the unit stays sans (separate node).
    targetTileValue: { ...Type.heroValue, fontVariant: ["tabular-nums"] },
    targetTileUnit: { ...Type.caption, color: colors.textSecondary, marginLeft: Spacing.xs },
    // Legacy aliases kept for any future callers — match Today tokens.
    targetValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    targetLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },

    inputLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: Spacing.xs },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      // On-scale (gap #3): Spacing.md (16) → ~48pt cell, matching the card
      // padding rhythm + the 44pt min-row touch guidance. Prior literal 12 was
      // off the Spacing scale (4/8/16/20/24/32/40 — no 12) and read squat.
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 15,
    },
    // §3.7 — the Calories value is an editorial serif moment (Type.heroValue,
    // 24sp Newsreader) since it is the most important number the user touches
    // on this write surface (gap #2). Numeric keypad is preserved at the call
    // site; only the rendered value's type/size change.
    inputCalories: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      ...Type.heroValue,
      fontSize: 24,
      lineHeight: 28,
      fontVariant: ["tabular-nums"],
    },
    inputCaption: { ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    inputGrid: { flexDirection: "row", gap: Spacing.md },
    inputHalf: { flex: 1, gap: Spacing.xs },
    // §3.7 macro leading dot — small MacroColors cue before each macro input
    // label, tying the editable row to its tile colour without adding chrome.
    macroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xs },
    macroDot: { width: 8, height: 8, borderRadius: 4 },

    saveRow: {
      flexDirection: "row",
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },

    dietaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    dietaryChip: {
      flexDirection: "row",
      alignItems: "center",
      // On-scale chip padding (gap #5): sm (8) vertical, md (16) horizontal,
      // xs (4) gap — snapped off the prior off-scale 10/14/6 literals so the
      // chip row matches the filter-pill grammar + the input/card rhythm.
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    // Selected dietary preference — aubergine soft tint (Sloe treatment #7,
    // 2026-06-08). Selected preference pills carry an accent tint + aubergine
    // edge, matching the web Settings dietary chips and the filter-pill
    // grammar. (Sage stays reserved for success/status + nutrition-confidence
    // semantics, not selection state.)
    dietaryChipActive: {
      borderColor: accent.primarySolid + "80",
      backgroundColor: accent.primarySoft,
    },
    dietaryLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },

    // §3.7 body-stats entry row — leading User glyph, label + subtitle, trailing
    // ChevronRight. Standard list-row anatomy (≥44pt), sits below dietary prefs.
    bodyStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      minHeight: 44,
      paddingVertical: Spacing.sm,
    },
    bodyStatsLabel: { ...Type.body, color: colors.text },
    bodyStatsSubtitle: { ...Type.caption, color: colors.textSecondary, marginTop: 2 },
    // Styles now source the accent from the static `Accent.*` treatment tokens
    // (Save outline + selected dietary tint), so the StyleSheet only depends on
    // `colors`. `accent` (spinner) is read outside this memo.
  }), [colors, cardElevation]);

  function TargetStat({
    value,
    label,
    unit,
    color,
    Icon,
  }: {
    value: number;
    label: string;
    unit: string;
    color: string;
    Icon: LucideIcon;
  }) {
    // DRIFT-07 fix (2026-05-22): align Profile Daily Targets tile with
    // Today's macro tile visual language — uppercase label top-left,
    // macro icon top-right, big tabular value below. Profile keeps its
    // macro-coloured outline border (defended choice — the watch-face
    // moment). Difference from Today: no /denominator and no progress
    // bar, since this surface displays targets, not current vs target.
    return (
      // Canonical 2026-05-22 C9: target tile outline is neutral
      // `colors.border`, not macro-coloured. Macro identity comes from
      // the icon + label (the value tints the digit only). Profile is
      // a summary card, not a state-tracking screen — less chrome,
      // more premium. Icon + value keep the macro hue.
      <View style={[styles.targetTile, { borderColor: colors.border }]}>
        <View style={styles.targetTileHeader}>
          <Text style={styles.targetTileLabel}>{label}</Text>
          {/* §10.1 / settings.md §3.2 — section-tile icons read at 18–20pt for
              real presence. Prior 14pt floated as an afterthought (gap #8). */}
          <Icon size={18} color={color} strokeWidth={1.75} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text style={[styles.targetTileValue, { color }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.targetTileUnit}>{unit}</Text>
        </View>
      </View>
    );
  }

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    // Debug audit 2026-05-04 (code-quality #5): the body had no
    // try/catch. A rejected supabase select threw out of the callback
    // before `setLoading(false)` ran — the screen sat on the skeleton
    // and pull-to-refresh wasn't wired to clear it. Now: full-body
    // try/finally so loading always resolves.
    try {
    const { data } = await supabase
      .from("profiles")
      .select(
        "display_name, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, dietary, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace, user_tier, streak_freezes_earned_at, streak_freezes_used_history, streak_freeze_budget_max",
      )
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      const dn = data.display_name ?? "";
      setDisplayName(dn);
      // §3.2 tier pill — Pro is the only tier with a reward pill; Free/Base
      // render no pill (avoids "Free" reading as a penalty marker at the top).
      const tierRaw = (data as Record<string, unknown>).user_tier;
      const tier = typeof tierRaw === "string" ? tierRaw : null;
      setUserTier(tier === "free" || tier === "base" || tier === "pro" ? tier : "free");
      // §3.2 streak — canonical protected-streak helper (same path as Today /
      // Progress / Settings). Hydrate a byDay map from nutrition_entries + the
      // freeze ledger. Non-fatal on error (streak → 0). m4: the 400-day window
      // means "Best streak" is best-RECENT, not all-time (see computeBestStreak).
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
          earnedAt: (data as { streak_freezes_earned_at?: unknown }).streak_freezes_earned_at,
          usedHistory: (data as { streak_freezes_used_history?: unknown }).streak_freezes_used_history,
        });
        const budgetMaxRaw = (data as { streak_freeze_budget_max?: unknown }).streak_freeze_budget_max;
        const budgetMax =
          typeof budgetMaxRaw === "number" && Number.isFinite(budgetMaxRaw) && budgetMaxRaw >= 0
            ? budgetMaxRaw
            : 3;
        setStreak(computeProtectedStreak(byDay as never, ledger, budgetMax).streakLength);
        setDaysLogged(Object.keys(byDay).length);
        // ENG-1246 — keep the same inputs for the editorial dot row / milestones.
        setStreakByDay(byDay as StreakByDay);
        setFreezeLedger(ledger);
        setFreezeBudgetMax(budgetMax);
      } catch {
        setStreak(0);
      }
      const d = data as Record<string, unknown>;
      const resolved = resolveTargets(
        {
          target_calories: d.target_calories != null ? Number(d.target_calories) : null,
          target_protein: d.target_protein != null ? Number(d.target_protein) : null,
          target_carbs: d.target_carbs != null ? Number(d.target_carbs) : null,
          target_fat: d.target_fat != null ? Number(d.target_fat) : null,
          target_fiber_g: d.target_fiber_g != null ? Number(d.target_fiber_g) : null,
        },
        {
          weight_kg: d.weight_kg != null ? Number(d.weight_kg) : null,
          height_cm: d.height_cm != null ? Number(d.height_cm) : null,
          sex: typeof d.sex === "string" ? d.sex : null,
          activity_level: typeof d.activity_level === "string" ? d.activity_level : null,
          goal: typeof d.goal === "string" ? d.goal : null,
          dob: typeof d.dob === "string" ? d.dob : null,
          age: d.age != null ? Number(d.age) : null,
          plan_pace: typeof d.plan_pace === "string" ? d.plan_pace : null,
        },
      );
      const cal = String(resolved.calories);
      const pro = String(resolved.protein);
      const car = String(resolved.carbs);
      const fa = String(resolved.fat);
      const fi = String(resolved.fiber);
      setCalories(cal);
      setProtein(pro);
      setCarbs(car);
      setFat(fa);
      setFiber(fi);
      const tw = data.target_water_ml != null ? Number(data.target_water_ml) : NUTRITION_DEFAULTS.water;
      const waterStr = String(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : NUTRITION_DEFAULTS.water);
      setWater(waterStr);
      const diet = data.dietary ? normaliseDietaryFromProfile(data.dietary) : [];
      if (data.dietary) setDietary(diet);
      // Snapshot for Cancel — copy primitives + a fresh array clone so
      // that subsequent toggles don't mutate the snapshot.
      loadedSnapshotRef.current = {
        displayName: dn,
        calories: cal,
        protein: pro,
        carbs: car,
        fat: fa,
        fiber: fi,
        water: waterStr,
        dietary: [...diet],
      };
    }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[profile] load failed:", err instanceof Error ? err.message : err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadProfile();
    }, [loadProfile]),
  );

  const save = async () => {
    if (!userId) return;
    // P1-1 (parity spec 2026-04-27) — `canSave` is the integrity gate.
    // The Save button is disabled while `!canSave`, but defend against
    // the keyboard "return" path or programmatic invocation by checking
    // again here.
    if (!canSave) return;
    setSaving(true);
    const profileData: Record<string, unknown> = {
      id: userId,
      display_name: displayName.trim() || null,
      target_calories: Number(calories),
      target_protein: Number(protein),
      target_carbs: Number(carbs),
      target_fat: Number(fat),
      target_fiber_g: Number(fiber),
      target_water_ml: Number(water),
      dietary: dietary.length > 0 ? dietary : null,
      // A2 provenance (parity spec 2026-04-27 §5.3) — stamp `user` source
      // unconditionally on every successful save. Pre-fix, this was
      // gated on `nextCalories != null` (`Number(calories) || null`),
      // which silently dropped the stamp when a user typed `0` or
      // cleared the field — leaving `source` at the prior value
      // (`onboarding`/`recompute`) and breaking the Maintenance
      // Recalibrate 14-day suppression contract. The `canSave` guard
      // above already guarantees `calories > 0`, so the stamp is
      // honest. (migration 20260427110000)
      target_calories_set_at: new Date().toISOString(),
      target_calories_source: "user",
      target_fiber_source: "user",
    };
    // Use upsert so it works for both new and existing profiles
    const { error } = await supabase.from("profiles").upsert(profileData, { onConflict: "id" });
    if (error) {
      setSaving(false);
      console.error("[Profile] save error:", JSON.stringify(error));
      Alert.alert("Error", "Couldn't save. Changes are kept locally.");
      return;
    }

    // F-149 (2026-05-11) — record goal-shape into goal_history so past-day
    // reads can resolve "what target was in force on day D" without
    // falling through to live profile values. Fire-and-forget; failures
    // never block the save (helper internally try/catches).
    void recordGoalHistory(
      supabase as Parameters<typeof recordGoalHistory>[0],
      userId,
      {
        target_calories: Number(calories),
        target_protein_g: Number(protein),
        target_carbs_g: Number(carbs),
        target_fat_g: Number(fat),
        target_fiber_g: Number(fiber),
      },
      "settings_save",
    );

    // Sync-enforcer parity (2026-05-11): match web Settings.tsx which
    // fires this on every successful profile-target save.
    try {
      track(AnalyticsEvents.profile_targets_saved, { from: "profile_screen" });
    } catch {
      /* fire-and-forget analytics — never block */
    }
    // P0-2 (parity spec 2026-04-27 §5.5) — write a dirty flag so the
    // Today tab's `useFocusEffect` can re-read targets immediately on
    // next focus. Mobile has no `AppDataContext` setter equivalent to
    // web's `setNutritionTargets`; the AsyncStorage flag is the
    // sanctioned fallback (option b in the spec). Today's existing
    // per-focus `loadProfileTargets` already covers this; the flag is
    // forward-defensive against future short-circuiting and gives us a
    // single source of truth for "the user just edited targets". A
    // write failure here is non-fatal — the next Today focus will
    // still re-read targets via the unconditional `loadProfileTargets`
    // call.
    try {
      await AsyncStorage.setItem(PROFILE_TARGETS_DIRTY_KEY, "1");
    } catch {
      /* non-fatal — Today re-reads on focus regardless */
    }
    // Refresh the snapshot so a subsequent Cancel reverts to the
    // freshly-saved values, not the pre-edit baseline.
    loadedSnapshotRef.current = {
      displayName,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      water,
      dietary: [...dietary],
    };
    setSaving(false);
    // DC12 (2026-05-14, premium-bar audit) — low-emotion settings
    // confirmation. "Saved" was generic; "Targets updated" is the
    // specific outcome the user can verify against the field they
    // just touched. Web parity: any settings-save toast on web
    // should be similarly specific (Profile / Goals / Privacy
    // setting / etc.).
    Alert.alert("Targets updated", "Your targets have been updated.");
  };

  // P1-2 (parity spec 2026-04-27) — Cancel reverts every state value to
  // the last-loaded (or last-saved) snapshot. No Supabase round-trip;
  // the snapshot ref is updated on `loadProfile` and on successful
  // save. Web parity: `Profile.tsx` Cancel button restores
  // `manualTargets` to `displayTargets` and resets `activityAdjustPref`.
  const cancel = useCallback(() => {
    const snap = loadedSnapshotRef.current;
    if (!snap) return;
    setDisplayName(snap.displayName);
    setCalories(snap.calories);
    setProtein(snap.protein);
    setCarbs(snap.carbs);
    setFat(snap.fat);
    setFiber(snap.fiber);
    setWater(snap.water);
    setDietary([...snap.dietary]);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="screen-profile"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <PushScreenHeader title="Profile" onBack={goBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {editorialProfileV3 ? (
          // ENG-1246 (Gap #16) — the shared editorial block: identity → streak
          // dots + best/freezes → milestones → recipe grid. Editing still lives
          // on the Daily Targets / Edit Targets cards below (rendered in every
          // path). Takes precedence over the read-only showcase.
          <EditorialProfileBlock
            displayName={displayName}
            joinedLabel={joinedLabel}
            monogramInitial={monogramInitial}
            tierLabel={userTier === "pro" ? "Pro" : "Free"}
            isPro={userTier === "pro"}
            model={editorialModel}
            recipes={editorialRecipes}
            recipeCount={recipeCount}
            onOpenRecipe={(id) => router.push(`/recipe/${id}`)}
            onSeeAllRecipes={() => router.push("/(tabs)/library")}
          />
        ) : profileShowcaseV1 ? (
          <ProfileShowcaseReadView
            displayName={displayName}
            joinedLabel={joinedLabel}
            monogramInitial={monogramInitial}
            recipeCount={recipeCount}
            streakDays={streak}
            daysLogged={daysLogged}
            calories={calories}
            protein={protein}
            carbs={carbs}
            fat={fat}
          />
        ) : (
        <>
        {/* §3.2 identity card + stats strip — the legacy partial gap #16 UI,
            extracted to `ProfileIdentityStrip` (ENG-1246). Kill-switch path:
            the editorial block returns above; this renders only when both
            `sloe_v3_profile` and `profile_showcase_v1` are off. */}
        {settingsRedesignV2 ? (
          <ProfileIdentityStrip
            monogramInitial={monogramInitial}
            displayName={displayName}
            isPro={userTier === "pro"}
            joinedLabel={joinedLabel}
            recipeCount={recipeCount}
            streak={streak}
          />
        ) : null}

        {/* Current targets summary.
            Audit 2026-05-04 #29: previously the outer card border + 4
            inner coloured tile borders made for 6 visible borders in
            one region (cage-within-cage). The colour-coded numbers
            already carry macro identity, so drop the outer card
            border; keep the inner tile borders for the macro colour
            cue. */}
        <View style={[styles.card, { borderWidth: 0 }]}>
          <Text style={styles.cardTitle}>Daily Targets</Text>
          <View style={styles.targetsRow}>
            {/* 2026-04-30 (#17, design-system-enforcer): retoken to
                MacroColors.* so this surface honours the canonical macro
                colour map (carryover rule #3). Pre-fix had Protein=red
                (destructive), Carbs=blue (info), Fat=amber (warning) —
                breaks the across-app convention where Protein=blue,
                Carbs=amber, Fat=magenta. */}
            <TargetStat value={Number(calories) || 0} label="CALORIES" unit="kcal" color={mc.calories} Icon={MACRO_ICONS.calories} />
            <TargetStat value={Number(protein) || 0} label="PROTEIN" unit="g" color={mc.protein} Icon={MACRO_ICONS.protein} />
            <TargetStat value={Number(carbs) || 0} label="CARBS" unit="g" color={mc.carbs} Icon={MACRO_ICONS.carbs} />
            <TargetStat value={Number(fat) || 0} label="FAT" unit="g" color={mc.fat} Icon={MACRO_ICONS.fat} />
          </View>
          {/*
            E3 (2026-05-11 visual sweep): the Profile screen showed a
            user with 1132 kcal target (below the 1200 kcal safety
            floor we enforce in weeklyCheckin) with no warning. The
            weekly check-in modal explains the floor when it auto-
            corrects, but a user who manually entered a sub-floor
            target has no signal here that the number is below what
            we'd recommend. Show a one-line amber notice when the
            target is < 1200 kcal.
          */}
          {Number(calories) > 0 && Number(calories) < 1200 ? (
            <View
              style={{
                marginTop: Spacing.md,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.dense,
                borderRadius: Radius.md,
                backgroundColor: Accent.warning + "14",
                borderWidth: 1,
                borderColor: Accent.warning + "40",
                flexDirection: "row",
                gap: 8,
                alignItems: "flex-start",
              }}
              accessibilityRole="alert"
              accessibilityLabel={`Calorie target is below the 1,200 kcal safety floor we recommend.`}
            >
              <Circle size={14} color={Accent.warningSolid} fill={Accent.warning} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Below 1,200 kcal.</Text> This is under the safety floor we recommend for adults. Consider raising your target — or talk to a clinician if a lower target is medically necessary.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Edit form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Targets</Text>

          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.tabIconDefault}
            style={styles.input}
          />
          {/* gap #11 — disambiguate the two name concepts. This writes
              `profiles.display_name` (shared/household surfaces); the Today
              greeting personalises from the "Your name" field in Settings →
              Personal (`user_metadata.full_name`). Without this caption a user
              may reasonably expect editing here to change their greeting.
              See docs/decisions/2026-06-04-settings-your-name-greeting.md. */}
          <Text style={styles.inputCaption}>Shown on shared and household surfaces. To change the name in your Today greeting, use Settings → Personal.</Text>

          {/* §3.7 — Calories is the editorial serif moment (the most important
              number the user touches here). Full-width, Type.heroValue 24sp,
              with a "kcal / day" caption beneath. Numeric keypad preserved. */}
          <Text style={styles.inputLabel}>Calories</Text>
          <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" style={styles.inputCalories} placeholderTextColor={colors.tabIconDefault} />
          <Text style={styles.inputCaption}>kcal / day</Text>

          {/* §3.7 — macro inputs carry a small MacroColors leading dot so the
              editable row ties back to its read-back tile colour. */}
          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: mc.protein }]} />
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Protein (g)</Text>
              </View>
              <TextInput value={protein} onChangeText={setProtein} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: mc.carbs }]} />
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Carbs (g)</Text>
              </View>
              <TextInput value={carbs} onChangeText={setCarbs} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: mc.fat }]} />
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Fat (g)</Text>
              </View>
              <TextInput value={fat} onChangeText={setFat} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: mc.fiber }]} />
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Fiber (g)</Text>
              </View>
              <TextInput value={fiber} onChangeText={setFiber} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: mc.water }]} />
                <Text style={[styles.inputLabel, { marginTop: 0 }]}>Water (ml)</Text>
              </View>
              <TextInput value={water} onChangeText={setWater} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf} />
          </View>

          {/* P1-1 + P1-2 (parity spec 2026-04-27) — Save is disabled
              while `!canSave` (mirrors web `Profile.tsx:257`); Cancel
              reverts every field to the last-loaded snapshot so the
              user has a one-tap undo. */}
          <View style={styles.saveRow}>
            {/* Cancel — ghost (button-system canon, 2026-06-12): the
                secondary / dismiss action that reverts edits. */}
            <SupprButton
              variant="ghost"
              onPress={cancel}
              accessibilityLabel="Cancel and revert target edits"
              disabled={saving}
              label="Cancel"
              style={{ flex: 1 }}
            />
            {/* Save Targets — primary (the screen's one main commit).
                SupprButton owns the loading spinner + disabled dim. */}
            <SupprButton
              variant="primary"
              onPress={save}
              disabled={!canSave}
              loading={saving}
              accessibilityLabel="Save target edits"
              label="Save Targets"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Dietary Preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dietary Preferences</Text>
          <View style={styles.dietaryGrid}>
            {DIETARY_PREFERENCE_ENTRIES.map((pref) => {
              const active = dietary.includes(pref.id);
              return (
                <Pressable
                  key={pref.id}
                  style={[styles.dietaryChip, active && styles.dietaryChipActive]}
                  onPress={() => toggleDietary(pref.id)}
                >
                  {active ? (
                    <Check size={16} color={accent.primarySolid} strokeWidth={2.5} />
                  ) : (
                    <Circle
                      size={16}
                      color={colors.textTertiary}
                      strokeWidth={1.75}
                    />
                  )}
                  <Text style={[styles.dietaryLabel, active && { color: colors.text }]}>
                    {pref.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* §3.7 body-stats entry row (settings.md, gap #4). Mobile /profile
              previously had NO path to body stats / units (web Profile.tsx edits
              weight/height/sex/age/activity/goal/pace). This row makes the path
              visible. Destination is gated by the existing `goal_editor` flag
              (parity with targets.tsx / web Targets.tsx): the GoalPaceEditorSheet
              when on, an interim note when off (so it is never a dead row). The
              row itself is net-new structure → behind `settings_redesign_v2`.
              NOTE: a Metric/Imperial units control (settings_units_row) is NOT
              added here — per settings.md §3.8 the Units row lives on the
              Settings → Display card, not on /profile, and editing it from this
              surface (which has no body-stat inputs visible) would mislead.
              Tracked as a deferral (see structured output). */}
          {settingsRedesignV2 ? (
            <Pressable
              style={styles.bodyStatsRow}
              onPress={() => {
                if (goalEditorEnabled) {
                  setGoalEditorOpen(true);
                } else {
                  Alert.alert(
                    "Body stats & goal",
                    "Update your height, weight, age, and activity level during your next target review.",
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit body stats and goal: height, weight, age, activity level"
            >
              <User size={20} color={Accent.success} strokeWidth={1.75} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.bodyStatsLabel}>Body stats &amp; goal</Text>
                <Text style={styles.bodyStatsSubtitle}>Height, weight, age, activity level</Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.75} />
            </Pressable>
          ) : null}
        </View>
        </>
        )}
      </ScrollView>

      {/* §3.7 — GoalPaceEditorSheet is the mobile body-stats edit path. On save,
          reload this screen's targets so the recomputed calories + macro tiles
          update in place (mirrors targets.tsx's onSaved → refetch). Only mounted
          when the redesign block is on AND a userId exists. */}
      {settingsRedesignV2 && userId ? (
        <GoalPaceEditorSheet
          visible={goalEditorOpen}
          onClose={() => setGoalEditorOpen(false)}
          userId={userId}
          onSaved={() => {
            setGoalEditorOpen(false);
            void loadProfile();
          }}
        />
      ) : null}
    </View>
  );
}
