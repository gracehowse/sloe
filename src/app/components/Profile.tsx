import { memo, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { toast } from "sonner";
import { normalizeMacroTargets } from "../../types/profile.ts";
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
        .select("sex, age, height_cm, weight_kg, activity_level, goal, plan_pace, nutrition_strategy, measurement_system")
        .eq("id", uid)
        .maybeSingle();
      if (!profile || cancelled) return;

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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActivityAdjustPref(preferActivityAdjustedCalories);
  }, [preferActivityAdjustedCalories]);

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

  const displayTargets = normalizeMacroTargets(
    nutritionTargets?.calories && nutritionTargets?.protein
      ? nutritionTargets
      : computedTargets ?? {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          waterMl: 0,
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
      {/* Header: Avatar + Name + Tier Side by Side */}
      <div className="flex items-center gap-3.5 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-primary">G</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">
            {displayName?.trim() ? displayName : "Your profile"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {userTier === "pro"
              ? "Pro"
              : userTier === "base"
              ? "Base"
              : "Free"} · Joined recently
          </p>
        </div>
      </div>

      {/* Stat Pills — matches mobile (recipes / streak / score) */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 text-center p-3 rounded-xl bg-card border border-border">
          <p className="text-lg font-bold text-primary tabular-nums">42</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Recipes</p>
        </div>
        <div className="flex-1 text-center p-3 rounded-xl bg-card border border-border">
          <p className="text-lg font-bold text-success tabular-nums">7</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Streak</p>
        </div>
        <div className="flex-1 text-center p-3 rounded-xl bg-card border border-border">
          <p className="text-lg font-bold text-warning tabular-nums">92</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Score</p>
        </div>
      </div>

      {/* Settings Section */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Settings</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Daily Targets Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.calories className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Daily Targets</p>
              <p className="text-xs text-muted-foreground truncate">2,100 kcal • 150P / 250C / 65F</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Preferences Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.dinner className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Preferences</p>
              <p className="text-xs text-muted-foreground truncate">No restrictions</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Connected Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.link className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Connected</p>
              <p className="text-xs text-muted-foreground truncate">Apple Health, Instagram</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Notifications Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.time className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground truncate">Daily reminder at 7 PM</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Export Data Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.import className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Export Data</p>
              <p className="text-xs text-muted-foreground truncate">CSV download</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Help Row — matches mobile */}
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="primary" size="sm" className="w-7 h-7">
              <Icons.info className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Help</p>
              <p className="text-xs text-muted-foreground truncate">FAQs and support</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </div>

      {/* Creator Tools Section */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Creator Tools</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Published Recipes Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="sm" className="w-7 h-7">
              <Icons.edit className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Published Recipes</p>
              <p className="text-xs text-muted-foreground truncate">12 recipes • 891 total makes</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Analytics Row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="sm" className="w-7 h-7">
              <Icons.progress className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Analytics</p>
              <p className="text-xs text-muted-foreground truncate">Views, saves, engagement</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {/* Publish New Row */}
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <IconBox tone="success" size="sm" className="w-7 h-7">
              <Icons.add className="w-4 h-4" />
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Publish New</p>
              <p className="text-xs text-muted-foreground truncate">Share with the community</p>
            </div>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </div>

      {/* Legal Section — matches mobile */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Legal</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <span className="text-sm text-foreground">Terms of Service</span>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <span className="text-sm text-foreground">Privacy Policy</span>
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
        className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors mb-8"
      >
        Sign Out
      </button>

      {/* Tabs */}
      <div className="border-t border-border pt-8">
        <div className="flex gap-6 mb-8">
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
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
              <p>
                BMR: {computedTargets ? Math.round(computedTargets.bmr) : "—"} kcal · TDEE: {computedTargets ? Math.round(computedTargets.tdee) : "—"} kcal
              </p>
              <p className="mt-1">Using Mifflin-St Jeor equation with activity multipliers</p>
            </div>
          </div>

          {/* Calculated Targets */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-primary/10 px-6 py-4 border-b border-primary/30">
              <div className="flex items-center gap-2">
                <IconBox tone="primary" size="md">
                  <Icons.trendUp className="w-5 h-5" />
                </IconBox>
                <h3 className="text-foreground">Your Daily Targets</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="px-6 py-6 text-center">
                {isEditingTargets ? (
                  <input
                    type="number"
                    value={manualTargets.calories}
                    onChange={(e) => setManualTargets((p) => ({ ...p, calories: Number(e.target.value) }))}
                    className="w-full text-center text-3xl font-bold bg-transparent focus:outline-none"
                  />
                ) : (
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.calories}</p>
                )}
                <p className="text-sm text-muted-foreground">Calories</p>
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
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.protein}g</p>
                )}
                <p className="text-sm text-muted-foreground">Protein</p>
                <p className="text-xs text-muted-foreground mt-1">2.2g per kg</p>
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
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.carbs}g</p>
                )}
                <p className="text-sm text-muted-foreground">Carbs</p>
                <p className="text-xs text-muted-foreground mt-1">Remainder</p>
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
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.fat}g</p>
                )}
                <p className="text-sm text-muted-foreground">Fat</p>
                <p className="text-xs text-muted-foreground mt-1">25% of kcal</p>
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
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.fiber}g</p>
                )}
                <p className="text-sm text-muted-foreground">Fiber</p>
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
                  <p className="text-4xl font-bold text-foreground mb-2">{displayTargets.waterMl}</p>
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
                  className="flex-1 py-3 bg-primary text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
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
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <IconBox tone="success" size="sm">
                  <Icons.target className="w-5 h-5" />
                </IconBox>
                <p className="text-sm text-muted-foreground">Days with food logged</p>
              </div>
              <p className="text-4xl font-bold text-foreground">{loggingStats.daysWithLogs}</p>
              <p className="text-xs text-muted-foreground mt-2">Distinct days in your nutrition journal</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
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

          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-foreground">Recent days</h3>
              {onOpenNutrition ? (
                <button
                  type="button"
                  onClick={onOpenNutrition}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium shrink-0"
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
