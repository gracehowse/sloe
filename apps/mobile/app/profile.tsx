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
import { Check, Circle } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
  type DietaryPreferenceId,
} from "../../../src/constants/dietaryPreferences";
import { PROFILE_TARGETS_DIRTY_KEY } from "@/lib/profileTargetsDirtyFlag";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import { recordGoalHistory } from "../../../src/lib/nutrition/goalHistory";

export default function ProfileScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // /(tabs)/more was collapsed to a redirect → /(tabs)/settings (Group G
  // Batch D, 2026-04-29). Targeting the live destination directly avoids
  // the redirect chain when the user taps Back.
  const goBack = useSafeBack("/(tabs)/settings");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
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
    scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: Spacing.lg },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

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
    headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4 },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

    targetsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    targetTile: {
      width: "47%",
      borderRadius: Radius.md,
      borderWidth: 1,
      backgroundColor: colors.inputBg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: "center",
      gap: 4,
    },
    targetValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    targetLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },

    inputLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: Spacing.xs },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    inputGrid: { flexDirection: "row", gap: Spacing.md },
    inputHalf: { flex: 1, gap: Spacing.xs },

    saveRow: {
      flexDirection: "row",
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    cancelBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      alignItems: "center",
    },
    cancelBtnText: { color: colors.text, fontWeight: "600", fontSize: 16 },

    dietaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    dietaryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    dietaryChipActive: {
      borderColor: Accent.success + "80",
      backgroundColor: Accent.success + "15",
    },
    dietaryLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  }), [colors]);

  function TargetStat({ value, label, color }: { value: number; label: string; color: string }) {
    return (
      <View style={[styles.targetTile, { borderColor: color + "55" }]}>
        <Text style={[styles.targetValue, { color }]}>{value}</Text>
        <Text style={styles.targetLabel}>{label}</Text>
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
        "display_name, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, dietary, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace",
      )
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      const dn = data.display_name ?? "";
      setDisplayName(dn);
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
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="screen-profile"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 28 }} />
        </View>

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
            <TargetStat value={Number(calories) || 0} label="kcal" color={MacroColors.calories} />
            <TargetStat value={Number(protein) || 0} label="Protein" color={MacroColors.protein} />
            <TargetStat value={Number(carbs) || 0} label="Carbs" color={MacroColors.carbs} />
            <TargetStat value={Number(fat) || 0} label="Fat" color={MacroColors.fat} />
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
                paddingVertical: 10,
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
              <Circle size={14} color={Accent.warning} fill={Accent.warning} style={{ marginTop: 2 }} />
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

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Calories</Text>
              <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Protein (g)</Text>
              <TextInput value={protein} onChangeText={setProtein} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Carbs (g)</Text>
              <TextInput value={carbs} onChangeText={setCarbs} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Fat (g)</Text>
              <TextInput value={fat} onChangeText={setFat} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Fiber (g)</Text>
              <TextInput value={fiber} onChangeText={setFiber} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Water (ml)</Text>
              <TextInput value={water} onChangeText={setWater} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          {/* P1-1 + P1-2 (parity spec 2026-04-27) — Save is disabled
              while `!canSave` (mirrors web `Profile.tsx:257`); Cancel
              reverts every field to the last-loaded snapshot so the
              user has a one-tap undo. */}
          <View style={styles.saveRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel and revert target edits"
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveBtn,
                (!canSave || saving) && { opacity: 0.5 },
              ]}
              onPress={save}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityLabel="Save target edits"
              accessibilityState={{ disabled: !canSave || saving }}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Targets"}</Text>
            </Pressable>
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
                    <Check size={16} color={Accent.success} strokeWidth={2.5} />
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
        </View>
      </ScrollView>
    </View>
  );
}
