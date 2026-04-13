import { memo, useEffect, useMemo, useState } from "react";
import { Calculator, TrendingUp, Activity, User, Crown, Target, UtensilsCrossed } from "lucide-react";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { toast } from "sonner";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from "../../lib/units/imperial.ts";
import { Checkbox } from "./ui/checkbox.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

interface ProfileProps {
  userTier: "free" | "base" | "pro";
  displayName?: string | null;
  onUpgrade?: () => void;
  onOpenNutrition?: () => void;
}

export const Profile = memo(function Profile({ userTier, displayName, onUpgrade: _onUpgrade, onOpenNutrition }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<"targets" | "progress">("targets");
  const {
    nutritionTargets,
    setNutritionTargets,
    preferActivityAdjustedCalories,
    setPreferActivityAdjustedCalories,
    setProfileMeasurementSystem,
    nutritionByDay,
  } = useAppData();

  const loggingStats = useMemo(() => {
    const daysWithLogs = Object.keys(nutritionByDay).filter((k) => (nutritionByDay[k]?.length ?? 0) > 0);
    const totalMeals = daysWithLogs.reduce((acc, k) => acc + (nutritionByDay[k]?.length ?? 0), 0);
    const recentDayKeys = [...daysWithLogs].sort((a, b) => b.localeCompare(a)).slice(0, 7);
    return { daysWithLogs: daysWithLogs.length, totalMeals, recentDayKeys };
  }, [nutritionByDay]);
  const [saving, setSaving] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [manualTargets, setManualTargets] = useState(() => normalizeMacroTargets(nutritionTargets));
  const [activityAdjustPref, setActivityAdjustPref] = useState(preferActivityAdjustedCalories);

  // User stats
  const [age, setAge] = useState(28);
  const [weight, setWeight] = useState(75);
  const [height, setHeight] = useState(178);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  const [goal, setGoal] = useState<"cut" | "maintain" | "bulk">("maintain");
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("10");
  const [weightLb, setWeightLb] = useState("165");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!uid || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("sex, age, height_cm, weight_kg, activity_level, goal, measurement_system")
        .eq("id", uid)
        .maybeSingle();
      if (!profile || cancelled) return;

      if (profile.age) setAge(profile.age as number);
      if (profile.weight_kg) setWeight(profile.weight_kg as number);
      if (profile.height_cm) setHeight(profile.height_cm as number);
      if (profile.sex) setSex((profile.sex as "male" | "female") ?? "male");
      if (profile.activity_level) setActivityLevel(profile.activity_level as typeof activityLevel);
      if (profile.goal) setGoal(profile.goal as typeof goal);
      if (profile.measurement_system === "imperial" || profile.measurement_system === "metric") {
        setMeasurementSystem(profile.measurement_system);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActivityAdjustPref(preferActivityAdjustedCalories);
  }, [preferActivityAdjustedCalories]);

  useEffect(() => {
    const { feet, inches } = cmToFeetInches(height);
    setHeightFt(String(feet));
    setHeightIn(String(inches));
    setWeightLb(kgToLb(weight).toFixed(1));
  }, [measurementSystem, height, weight]);

  // Calculate BMR using Mifflin-St Jeor
  const calculateBMR = () => {
    if (sex === "male") {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  };

  // Activity multipliers
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  // Goal adjustments
  const goalAdjustments: Record<string, number> = {
    cut: -0.15,
    maintain: 0,
    bulk: 0.1,
  };

  const bmr = calculateBMR();
  const tdee = bmr * activityMultipliers[activityLevel];
  const targetCalories = Math.round(tdee * (1 + goalAdjustments[goal]));
  const proteinPerKg: Record<string, number> = { cut: 2.0, maintain: 1.6, bulk: 2.2 };
  const targetProtein = Math.round(weight * (proteinPerKg[goal] ?? 1.6));
  const targetFat = Math.round(targetCalories * 0.25 / 9); // 25% of calories from fat
  const targetCarbs = Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4);
  const targetFiber = Math.max(14, Math.min(45, Math.round((14 * targetCalories) / 1000)));
  const targetWaterMl = Math.min(4500, Math.max(1500, Math.round(weight * 33)));

  const displayTargets = normalizeMacroTargets(
    nutritionTargets?.calories && nutritionTargets?.protein
      ? nutritionTargets
      : {
          calories: targetCalories,
          protein: targetProtein,
          carbs: targetCarbs,
          fat: targetFat,
          fiber: targetFiber,
          waterMl: targetWaterMl,
        },
  );

  useEffect(() => {
    if (!isEditingTargets) {
      setManualTargets({ ...displayTargets });
    }
  }, [
    displayTargets.calories,
    displayTargets.protein,
    displayTargets.carbs,
    displayTargets.fat,
    displayTargets.fiber,
    displayTargets.waterMl,
    isEditingTargets,
  ]);

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="mb-1 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {displayName?.trim() ? displayName : "Your profile"}
            </h1>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm capitalize inline-flex items-center gap-1.5 font-semibold shadow-sm ${
                  userTier === "pro"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                    : userTier === "base"
                    ? "bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 text-violet-700 dark:text-violet-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {userTier === "pro" && <Crown className="w-3 h-3" />}
                {userTier} Plan
              </span>
            </div>
          </div>
        </div>
        {userTier === "free" ? null : null}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 mb-8">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("targets")}
            className={`pb-3 border-b-2 transition-colors font-medium ${
              activeTab === "targets"
                ? "border-violet-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Macro Calculator
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={`pb-3 border-b-2 transition-colors font-medium ${
              activeTab === "progress"
                ? "border-violet-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Progress Tracking
          </button>
        </div>
      </div>

      {activeTab === "targets" && (
        <div className="space-y-8">
          {/* Macro Calculator */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-slate-900 dark:text-white">Calculate Your Targets</h3>
            </div>

            <div className="mb-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Sex</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female")}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              {measurementSystem === "metric" ? (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (cm)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (ft)</label>
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
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Height (in)</label>
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
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Weight (lb)</label>
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
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mb-6">
              <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Activity Level</label>
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
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}
                  >
                    <p className="font-medium text-slate-900 dark:text-white">{level.label}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{level.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Goal</label>
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
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}
                  >
                    <p className="font-medium text-slate-900 dark:text-white">{goalOption.label}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{goalOption.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400">
              <p>
                BMR: {Math.round(bmr)} kcal · TDEE: {Math.round(tdee)} kcal
              </p>
              <p className="mt-1">Using Mifflin-St Jeor equation with activity multipliers</p>
            </div>
          </div>

          {/* Calculated Targets */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 px-6 py-4 border-b border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-slate-900 dark:text-white">Your Daily Targets</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.calories}
                    onChange={(e) => setManualTargets((p) => ({ ...p, calories: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.calories}</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Calories</p>
              </div>
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.protein}
                    onChange={(e) => setManualTargets((p) => ({ ...p, protein: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.protein}g</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Protein</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">2.2g per kg</p>
              </div>
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.carbs}
                    onChange={(e) => setManualTargets((p) => ({ ...p, carbs: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.carbs}g</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Carbs</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Remainder</p>
              </div>
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.fat}
                    onChange={(e) => setManualTargets((p) => ({ ...p, fat: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.fat}g</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Fat</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">25% of kcal</p>
              </div>
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.fiber}
                    onChange={(e) => setManualTargets((p) => ({ ...p, fiber: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.fiber}g</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Fiber</p>
              </div>
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.waterMl}
                    onChange={(e) => setManualTargets((p) => ({ ...p, waterMl: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayTargets.waterMl}</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">Water (ml)</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={activityAdjustPref}
                  onCheckedChange={(c) => setActivityAdjustPref(c === true)}
                  disabled={!isEditingTargets}
                  className="mt-0.5"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-slate-800 dark:text-slate-200 font-medium">Adjust calories for activity</span>
                  <span className="block mt-1">
                    When on, your daily calorie goal increases by the activity burn you log in the Tracker. Net goal = base target + activity burn for that day.
                  </span>
                </span>
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                All targets are customizable. Click &quot;Edit Targets&quot; to override these values with your own preferences.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {!isEditingTargets ? (
              <button
                type="button"
                onClick={() => setIsEditingTargets(true)}
                className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300 font-medium"
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
                  className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave || saving}
                  onClick={() => void saveProfile()}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-slate-900 dark:text-white">Weight</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Weight history and charts are not available yet. The number below is your{" "}
              <strong className="text-slate-800 dark:text-slate-200">profile weight</strong> from the Targets tab—it updates
              when you save your profile.
            </p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {measurementSystem === "imperial" ? `${weightLb} lb` : `${weight} kg`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Current (profile)</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Days with food logged</p>
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">{loggingStats.daysWithLogs}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Distinct days in your nutrition journal</p>
            </div>
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <UtensilsCrossed className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Total log entries</p>
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">{loggingStats.totalMeals}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Meals and snacks recorded across all days</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-slate-900 dark:text-white">Recent days</h3>
              {onOpenNutrition ? (
                <button
                  type="button"
                  onClick={onOpenNutrition}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all text-sm font-medium shrink-0"
                >
                  Open tracker
                </button>
              ) : null}
            </div>
            {loggingStats.recentDayKeys.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
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
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                    >
                      <span className="font-medium text-slate-900 dark:text-white">{label}</span>
                      <span className="text-slate-600 dark:text-slate-400">
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
