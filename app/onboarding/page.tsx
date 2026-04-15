"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, CheckCircle2, Sparkles, User } from "lucide-react";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";
import {
  calculateTDEE,
  calculateBudget,
  calculateMacros,
  type PlanPace,
  type NutritionStrategy,
} from "../../src/lib/nutrition/tdee.ts";
import {
  DEFAULT_MACRO_TARGETS,
  normalizeMacroTargets,
  type ActivityLevel,
  type Goal,
  type MacroTargets,
  type Sex,
  type UserProfile,
} from "../../src/types/profile.ts";
import { saveLocalProfile } from "../../src/lib/profile/profileStorage.ts";
import { Checkbox } from "../../src/app/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { AppLoadingSkeleton } from "../../src/app/components/AppLoadingSkeleton.tsx";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from "../../src/lib/units/imperial.ts";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../src/constants/dietaryPreferences.ts";
import { ageFromIsoDateString, displayNameFromAuthUser } from "../../src/lib/profile/onboardingHydration.ts";

const ACTIVITY_LEVELS: Array<{ value: ActivityLevel; label: string; desc: string }> = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Light", desc: "1–3 days/week" },
  { value: "moderate", label: "Moderate", desc: "3–5 days/week" },
  { value: "active", label: "Active", desc: "6–7 days/week" },
  { value: "very_active", label: "Very Active", desc: "Hard training / 2× day" },
];

const GOALS: Array<{ value: Goal; label: string; desc: string }> = [
  { value: "cut", label: "Lose weight", desc: "Create a calorie deficit" },
  { value: "maintain", label: "Eat healthier", desc: "Balanced nutrition" },
  { value: "bulk", label: "Build muscle", desc: "Higher protein targets" },
];

function coerceInt(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

export default function OnboardingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string>("");
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState<string>("28");
  const [heightCm, setHeightCm] = useState<string>("170");
  const [weightKg, setWeightKg] = useState<string>("65");
  /** Display-only for imperial inputs (synced from cm/kg). */
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("7");
  const [weightLb, setWeightLb] = useState("143");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [nutritionStrategy, setNutritionStrategy] = useState<NutritionStrategy>("balanced");
  const [dietary, setDietary] = useState<string[]>([]);
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [goalWeightKg, setGoalWeightKg] = useState<string>("");

  const [targetsMode, setTargetsMode] = useState<"auto" | "manual">("auto");
  const [manualTargets, setManualTargets] = useState<MacroTargets>({ ...DEFAULT_MACRO_TARGETS });
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);

  useEffect(() => {
    const cm = coerceInt(heightCm) ?? 170;
    const kg = Number(weightKg.replace(",", "."));
    const safeKg = Number.isFinite(kg) && kg > 0 ? kg : 65;
    const { feet, inches } = cmToFeetInches(cm);
    setHeightFt(String(feet));
    setHeightIn(String(inches));
    setWeightLb(kgToLb(safeKg).toFixed(1));
  }, [measurementSystem, heightCm, weightKg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (cancelled) return;
      if (!uid) {
        window.location.href = "/login";
        return;
      }
      setUserId(uid);

      // Try to hydrate from saved profile if available.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "display_name, avatar_url, user_tier, sex, age, dob, height_cm, weight_kg, goal_weight_kg, activity_level, goal, plan_pace, nutrition_strategy, dietary, measurement_system, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories",
        )
        .eq("id", uid)
        .maybeSingle();

      if (!cancelled && profile && !profileError) {
        const ms = profile.measurement_system === "imperial" ? "imperial" : "metric";
        if (profile.measurement_system) setMeasurementSystem(ms);
        const nameFromProfile = (profile.display_name ?? "").trim();
        setDisplayName(nameFromProfile || displayNameFromAuthUser(data.session?.user ?? null));
        if (profile.sex) setSex(profile.sex as Sex);
        const ageNum =
          profile.age != null && Number(profile.age) > 0
            ? Number(profile.age)
            : ageFromIsoDateString(profile.dob as string | null | undefined);
        if (ageNum != null) setAge(String(ageNum));
        if (profile.height_cm) setHeightCm(String(profile.height_cm));
        if (profile.weight_kg) setWeightKg(String(profile.weight_kg));
        if (profile.activity_level) setActivityLevel(profile.activity_level as ActivityLevel);
        if (profile.goal) setGoal(profile.goal as Goal);
        if (profile.plan_pace) setPlanPace(profile.plan_pace as PlanPace);
        if (profile.nutrition_strategy) setNutritionStrategy(profile.nutrition_strategy as NutritionStrategy);
        if (Array.isArray(profile.dietary)) {
          setDietary(normaliseDietaryFromProfile(profile.dietary));
        }
        if (profile.goal_weight_kg != null && Number(profile.goal_weight_kg) > 0) {
          const gk = Number(profile.goal_weight_kg);
          setGoalWeightKg(ms === "imperial" ? kgToLb(gk).toFixed(1) : String(Math.round(gk * 10) / 10));
        }
        if (
          profile.target_calories &&
          profile.target_protein &&
          profile.target_carbs &&
          profile.target_fat
        ) {
          setTargetsMode("manual");
          setManualTargets(
            normalizeMacroTargets({
              calories: profile.target_calories,
              protein: profile.target_protein,
              carbs: profile.target_carbs,
              fat: profile.target_fat,
              fiber: profile.target_fiber_g ?? undefined,
              waterMl: profile.target_water_ml ?? undefined,
            }),
          );
        }
        if (profile.prefer_activity_adjusted_calories !== null && profile.prefer_activity_adjusted_calories !== undefined) {
          setPreferActivityAdjustedCalories(Boolean(profile.prefer_activity_adjusted_calories));
        }
      } else if (!cancelled && !profile && !profileError) {
        setDisplayName(displayNameFromAuthUser(data.session?.user ?? null));
      }
      if (!cancelled && profileError) {
        // DB may not be configured yet — still pre-fill from auth when possible.
        console.warn("Profile load skipped:", profileError.message);
        setDisplayName(displayNameFromAuthUser(data.session?.user ?? null));
      }

      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const computedTargets = useMemo(() => {
    const a = coerceInt(age);
    const h = coerceInt(heightCm);
    const w = coerceInt(weightKg);
    if (!a || !h || !w) return null;
    const tdee = calculateTDEE(sex, w, h, a, activityLevel);
    const calories = calculateBudget(tdee, planPace, goal);
    const macros = calculateMacros(calories, nutritionStrategy, w);
    const waterMl = Math.min(4500, Math.max(1500, Math.round(w * 33)));
    return { calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber, waterMl };
  }, [sex, age, heightCm, weightKg, activityLevel, goal, planPace, nutritionStrategy]);

  const finalTargets = targetsMode === "auto" ? computedTargets : manualTargets;

  const toggleDietary = (key: string) => {
    setDietary((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const onSave = async () => {
    setError(null);
    if (!userId) return;
    const a = coerceInt(age);
    const h = coerceInt(heightCm);
    const w = coerceInt(weightKg);
    if (!a || !h || !w) {
      setError("Please enter valid age, height, and weight.");
      return;
    }
    if (!finalTargets) {
      setError("Please set your macro targets.");
      return;
    }
    setSaving(true);

    const targets = normalizeMacroTargets(finalTargets);
    const profile: UserProfile = {
      id: userId,
      displayName: displayName.trim() ? displayName.trim() : null,
      avatarUrl: null,
      userTier: "free",
      dietary,
      measurementSystem,
      age: a,
      heightCm: h,
      weightKg: w,
      sex,
      activityLevel,
      goal,
      targets,
      preferActivityAdjustedCalories,
    };

    // Save locally so the UX works even if profile sync is unavailable.
    saveLocalProfile(profile);

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: profile.displayName,
          user_tier: profile.userTier,
          sex: profile.sex,
          age: profile.age,
          height_cm: profile.heightCm,
          weight_kg: profile.weightKg,
          activity_level: profile.activityLevel,
          goal: profile.goal,
          goal_weight_kg: goal === "cut" && goalWeightKg ? (measurementSystem === "imperial" ? Math.round(Number(goalWeightKg) / 2.20462 * 10) / 10 : Number(goalWeightKg)) || null : null,
          plan_pace: planPace,
          nutrition_strategy: nutritionStrategy,
          dietary: profile.dietary,
          measurement_system: profile.measurementSystem,
          target_calories: targets.calories,
          target_protein: targets.protein,
          target_carbs: targets.carbs,
          target_fat: targets.fat,
          target_fiber_g: targets.fiber,
          target_water_ml: targets.waterMl,
          prefer_activity_adjusted_calories: preferActivityAdjustedCalories,
          onboarding_completed: true,
        },
        { onConflict: "id" },
      );

    if (upsertError) {
      // Profile save failed (DB not configured or migration not applied).
      // Don't block the user — local profile is already saved above.
      console.warn("Profile upsert failed:", upsertError.message);
      toast.warning("Profile saved on this device. Cloud sync will activate when the database is ready.");
    }

    setSaving(false);
    track(AnalyticsEvents.onboarding_completed);
    window.location.href = "/?view=discover";
  };

  const [wizardStep, setWizardStep] = useState(0);
  const WIZARD_STEPS = ["About you", "Goal & Activity", "Plan & Strategy", "Review targets"];
  const wizardProgress = ((wizardStep + 1) / WIZARD_STEPS.length) * 100;

  const canAdvance = (() => {
    switch (wizardStep) {
      case 0: return coerceInt(age) && coerceInt(heightCm) && coerceInt(weightKg);
      default: return true;
    }
  })();

  if (loading) {
    return <AppLoadingSkeleton label="Loading your profile…" />;
  }

  const inputCls = "w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50";
  const cardCls = "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg";
  const selBtnCls = (active: boolean) =>
    `p-4 border-2 rounded-xl text-left transition-all ${
      active
        ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20"
        : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Welcome to Suppr
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Step {wizardStep + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[wizardStep]}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
            style={{ width: `${wizardProgress}%` }}
          />
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200/60 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: About you */}
        {wizardStep === 0 && (
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-slate-900 dark:text-white font-semibold">About you</h3>
            </div>

            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Display name (optional)
            </label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Grace" className={inputCls} />

            <div className="mt-5">
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Units</label>
              <select value={measurementSystem} onChange={(e) => setMeasurementSystem(e.target.value as "metric" | "imperial")} className={inputCls}>
                <option value="metric">Metric (cm, kg)</option>
                <option value="imperial">Imperial (ft/in, lb)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Biological sex
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">Used for BMR calculation only</span>
                </label>
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={inputCls}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="unspecified">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Age</label>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} />
              </div>
              {measurementSystem === "metric" ? (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (cm)</label>
                    <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Weight (kg)</label>
                    <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputCls} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (ft)</label>
                      <input type="number" min={0} value={heightFt} onChange={(e) => { setHeightFt(e.target.value); const ft = Number(e.target.value); const inch = Number(heightIn); if (Number.isFinite(ft) && Number.isFinite(inch)) setHeightCm(String(Math.round(feetInchesToCm(ft, inch)))); }} className={inputCls} />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (in)</label>
                      <input type="number" min={0} max={11} value={heightIn} onChange={(e) => { setHeightIn(e.target.value); const ft = Number(heightFt); const inch = Number(e.target.value); if (Number.isFinite(ft) && Number.isFinite(inch)) setHeightCm(String(Math.round(feetInchesToCm(ft, inch)))); }} className={inputCls} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Weight (lb)</label>
                    <input type="number" value={weightLb} onChange={(e) => { setWeightLb(e.target.value); const lb = Number(e.target.value.replace(",", ".")); if (Number.isFinite(lb) && lb > 0) setWeightKg(String(Number(lbToKg(lb).toFixed(1)))); }} className={inputCls} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Goal & Activity */}
        {wizardStep === 1 && (
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-slate-900 dark:text-white font-semibold">Goal & Activity</h3>
            </div>

            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">What's your goal?</label>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {GOALS.map((g) => (
                <button key={g.value} type="button" onClick={() => setGoal(g.value)} className={`${selBtnCls(goal === g.value)} text-center`}>
                  <p className="font-medium text-slate-900 dark:text-white">{g.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{g.desc}</p>
                </button>
              ))}
            </div>

            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Activity level</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {ACTIVITY_LEVELS.map((lvl) => (
                <button key={lvl.value} type="button" onClick={() => setActivityLevel(lvl.value)} className={selBtnCls(activityLevel === lvl.value)}>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <p className="font-medium text-slate-900 dark:text-white">{lvl.label}</p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{lvl.desc}</p>
                </button>
              ))}
            </div>

            {goal === "cut" && (
              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Goal weight {measurementSystem === "imperial" ? "(lb)" : "(kg)"}
                </label>
                <input
                  type="number"
                  value={goalWeightKg}
                  onChange={(e) => setGoalWeightKg(e.target.value)}
                  placeholder={measurementSystem === "imperial" ? "130" : "60"}
                  className={inputCls}
                />
              </div>
            )}

            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary preferences (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              {DIETARY_PREFERENCE_ENTRIES.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40">
                  <Checkbox checked={dietary.includes(opt.id)} onCheckedChange={() => toggleDietary(opt.id)} />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Plan & Strategy */}
        {wizardStep === 2 && (
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-slate-900 dark:text-white font-semibold">Plan & Strategy</h3>
            </div>

            {(goal === "cut" || goal === "bulk") && (
              <div className="mb-6">
                <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {goal === "cut" ? "Weight loss pace" : "Muscle gain pace"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "relaxed" as const, label: "Relaxed", desc: goal === "cut" ? "~0.25 kg/week" : "Lean bulk" },
                    { value: "steady" as const, label: "Steady", desc: goal === "cut" ? "~0.5 kg/week" : "Standard bulk" },
                    { value: "accelerated" as const, label: "Accelerated", desc: goal === "cut" ? "~0.75 kg/week" : "Aggressive bulk" },
                    { value: "vigorous" as const, label: "Vigorous", desc: goal === "cut" ? "~1 kg/week" : "Max surplus" },
                  ]).map((p) => (
                    <button key={p.value} type="button" onClick={() => setPlanPace(p.value)} className={selBtnCls(planPace === p.value)}>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">{p.label}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Nutrition strategy</label>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {([
                { value: "balanced" as const, label: "Balanced", desc: "Even macro split" },
                { value: "high_protein" as const, label: "High Protein", desc: "Prioritise protein targets" },
                { value: "high_satisfaction" as const, label: "High Satisfaction", desc: "Focus on filling meals" },
                { value: "low_carb" as const, label: "Low Carb", desc: "Reduce carb intake" },
              ]).map((s) => (
                <button key={s.value} type="button" onClick={() => setNutritionStrategy(s.value)} className={selBtnCls(nutritionStrategy === s.value)}>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{s.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 cursor-pointer">
              <Checkbox checked={preferActivityAdjustedCalories} onCheckedChange={(c) => setPreferActivityAdjustedCalories(c === true)} className="mt-0.5" />
              <span>
                <span className="text-slate-900 dark:text-white font-medium">Adjust calories for activity</span>
                <span className="block text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Your daily calorie goal increases based on activity you log.
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Step 4: Review targets */}
        {wizardStep === 3 && (
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-slate-900 dark:text-white font-semibold">Your targets</h3>
            </div>

            <div className="flex gap-2 mb-5">
              <button type="button" onClick={() => setTargetsMode("auto")} className={`px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${targetsMode === "auto" ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
                Auto-calculate
              </button>
              <button type="button" onClick={() => setTargetsMode("manual")} className={`px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${targetsMode === "manual" ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
                Set manually
              </button>
            </div>

            {targetsMode === "auto" && (
              <div className="rounded-2xl p-5 bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200/50 dark:border-violet-800/50">
                {computedTargets ? (
                  <>
                    <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      Calculated using Mifflin–St Jeor
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {([
                        ["Calories", `${computedTargets.calories}`],
                        ["Protein", `${computedTargets.protein}g`],
                        ["Carbs", `${computedTargets.carbs}g`],
                        ["Fat", `${computedTargets.fat}g`],
                        ["Fiber", `${computedTargets.fiber}g`],
                        ["Water", `${computedTargets.waterMl} ml`],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">
                    Go back to step 1 and enter your age, height, and weight.
                  </p>
                )}
              </div>
            )}

            {targetsMode === "manual" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {([
                  ["Calories", "calories"],
                  ["Protein (g)", "protein"],
                  ["Carbs (g)", "carbs"],
                  ["Fat (g)", "fat"],
                  ["Fiber (g)", "fiber"],
                  ["Water (ml)", "waterMl"],
                ] as const).map(([label, key]) => (
                  <div key={key}>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
                    <input type="number" value={manualTargets[key]} onChange={(e) => setManualTargets((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))} className={inputCls} />
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-5">
              You can edit your targets anytime in Profile.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {wizardStep > 0 ? (
            <button type="button" onClick={() => setWizardStep((s) => s - 1)} className="px-5 py-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">
              Back
            </button>
          ) : (
            <div />
          )}
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canAdvance && setWizardStep((s) => s + 1)}
              disabled={!canAdvance}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {saving ? "Saving…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

