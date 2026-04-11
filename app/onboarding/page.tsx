"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, CheckCircle2, Sparkles, User } from "lucide-react";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";
import { calculateMacroTargets } from "../../src/lib/macros/calculateTargets.ts";
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

const ACTIVITY_LEVELS: Array<{ value: ActivityLevel; label: string; desc: string }> = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Light", desc: "1–3 days/week" },
  { value: "moderate", label: "Moderate", desc: "3–5 days/week" },
  { value: "active", label: "Active", desc: "6–7 days/week" },
  { value: "very_active", label: "Very Active", desc: "Hard training / 2× day" },
];

const GOALS: Array<{ value: Goal; label: string; desc: string }> = [
  { value: "cut", label: "Cut", desc: "Fat loss (−15%)" },
  { value: "maintain", label: "Maintain", desc: "Maintain (0%)" },
  { value: "bulk", label: "Build", desc: "Lean gain (+10%)" },
];

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
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
  const [dietary, setDietary] = useState<string[]>([]);
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");

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
          "display_name, avatar_url, user_tier, sex, age, height_cm, weight_kg, activity_level, goal, dietary, measurement_system, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories",
        )
        .eq("id", uid)
        .maybeSingle();

      if (!cancelled && profile && !profileError) {
        setDisplayName(profile.display_name ?? "");
        if (profile.sex) setSex(profile.sex as Sex);
        if (profile.age) setAge(String(profile.age));
        if (profile.height_cm) setHeightCm(String(profile.height_cm));
        if (profile.weight_kg) setWeightKg(String(profile.weight_kg));
        if (profile.activity_level) setActivityLevel(profile.activity_level as ActivityLevel);
        if (profile.goal) setGoal(profile.goal as Goal);
        if (Array.isArray(profile.dietary)) setDietary(profile.dietary as string[]);
        if (profile.measurement_system) setMeasurementSystem(profile.measurement_system as "metric" | "imperial");
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
      }
      if (!cancelled && profileError) {
        // DB may not be configured yet — proceed silently with local-only mode.
        console.warn("Profile load skipped:", profileError.message);
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
    return calculateMacroTargets({ sex, age: a, heightCm: h, weightKg: w, activityLevel, goal });
  }, [sex, age, heightCm, weightKg, activityLevel, goal]);

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
          dietary: profile.dietary,
          measurement_system: profile.measurementSystem,
          target_calories: targets.calories,
          target_protein: targets.protein,
          target_carbs: targets.carbs,
          target_fat: targets.fat,
          target_fiber_g: targets.fiber,
          target_water_ml: targets.waterMl,
          prefer_activity_adjusted_calories: preferActivityAdjustedCalories,
        },
        { onConflict: "id" },
      );

    if (upsertError) {
      // Profile save failed (DB not configured or migration not applied).
      // Don’t block the user — local profile is already saved above.
      console.warn("Profile upsert failed:", upsertError.message);
      toast.warning("Profile saved on this device. Cloud sync will activate when the database is ready.");
    }

    setSaving(false);
    track(AnalyticsEvents.onboarding_completed);
    window.location.href = "/";
  };

  if (loading) {
    return <AppLoadingSkeleton label="Loading your profile…" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Welcome to Platemate
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
              Tell us about your goals so we can build meal plans that hit your calorie and protein targets. Takes about 60 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? "Saving…" : "Finish setup"}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200/60 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-slate-900 dark:text-white">Profile</h3>
            </div>

            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Display name (optional)
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Grace"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />

            <div className="mt-5">
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Units</label>
              <select
                value={measurementSystem}
                onChange={(e) => setMeasurementSystem(e.target.value as "metric" | "imperial")}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="metric">Metric (cm, kg)</option>
                <option value="imperial">Imperial (ft/in, lb)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sex
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Age
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              {measurementSystem === "metric" ? (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        Height (ft)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={heightFt}
                        onChange={(e) => setHeightFt(e.target.value)}
                        onBlur={() => {
                          const ft = Number(heightFt);
                          const inch = Number(heightIn);
                          if (Number.isFinite(ft) && Number.isFinite(inch) && inch >= 0 && inch < 12) {
                            setHeightCm(String(Math.round(feetInchesToCm(ft, inch))));
                          }
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        Height (in)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={11}
                        value={heightIn}
                        onChange={(e) => setHeightIn(e.target.value)}
                        onBlur={() => {
                          const ft = Number(heightFt);
                          const inch = Number(heightIn);
                          if (Number.isFinite(ft) && Number.isFinite(inch) && inch >= 0 && inch < 12) {
                            setHeightCm(String(Math.round(feetInchesToCm(ft, inch))));
                          }
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Weight (lb)
                    </label>
                    <input
                      type="number"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      onBlur={() => {
                        const lb = Number(weightLb.replace(",", "."));
                        if (Number.isFinite(lb) && lb > 0) {
                          setWeightKg(String(Number(lbToKg(lb).toFixed(1))));
                        }
                      }}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-5">
              <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Activity level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACTIVITY_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setActivityLevel(lvl.value)}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      activityLevel === lvl.value
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <p className="font-medium text-slate-900 dark:text-white">{lvl.label}</p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{lvl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Goal
              </label>
              <div className="grid grid-cols-3 gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${
                      goal === g.value
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}
                  >
                    <p className="font-medium text-slate-900 dark:text-white">{g.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Dietary preferences (optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {DIETARY_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40"
                  >
                    <Checkbox
                      checked={dietary.includes(opt)}
                      onCheckedChange={() => toggleDietary(opt)}
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200 capitalize">
                      {opt.replace("-", " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Targets */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-slate-900 dark:text-white">Macro targets</h3>
            </div>

            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setTargetsMode("auto")}
                className={`px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${
                  targetsMode === "auto"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                Auto-calculate
              </button>
              <button
                type="button"
                onClick={() => setTargetsMode("manual")}
                className={`px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${
                  targetsMode === "manual"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
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
                      {(
                        [
                          ["Calories", `${computedTargets.calories}`],
                          ["Protein", `${computedTargets.protein}g`],
                          ["Carbs", `${computedTargets.carbs}g`],
                          ["Fat", `${computedTargets.fat}g`],
                          ["Fiber", `${computedTargets.fiber}g`],
                          ["Water", `${computedTargets.waterMl} ml`],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">
                    Enter your age, height, and weight to calculate targets.
                  </p>
                )}
              </div>
            )}

            {targetsMode === "manual" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(
                  [
                    ["Calories", "calories"],
                    ["Protein (g)", "protein"],
                    ["Carbs (g)", "carbs"],
                    ["Fat (g)", "fat"],
                    ["Fiber (g)", "fiber"],
                    ["Water (ml)", "waterMl"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key}>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={manualTargets[key]}
                      onChange={(e) =>
                        setManualTargets((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
                      }
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Activity &amp; devices</p>
              <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                <Checkbox
                  checked={preferActivityAdjustedCalories}
                  onCheckedChange={(c) => setPreferActivityAdjustedCalories(c === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-slate-900 dark:text-white font-medium">Adjust calories for activity</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Your daily calorie goal increases based on activity you log. Enter your workout burn in the Tracker and your net goal adjusts automatically.
                  </span>
                </span>
              </label>
            </div>

          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You can edit your targets anytime in Profile.
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? "Saving…" : "Finish setup"}
          </button>
        </div>
      </div>
    </div>
  );
}

