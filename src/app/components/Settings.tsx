"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { STORAGE_KEY } from "../../context/appData/persistence.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../constants/dietaryPreferences.ts";
import { buildLocalDataExport, downloadJsonFile } from "../../lib/client/exportSupprLocalData.ts";
import { normalizeWeekSummaryMode } from "../../lib/nutrition/weekSummaryWindow.ts";
import type { NotificationPrefs } from "../../types/notifications.ts";

const THEME_OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const WIDGET_MACRO_OPTIONS = [
  { key: "protein", label: "Protein", color: "#5B8DEF" },
  { key: "carbs", label: "Carbs", color: "#F5A623" },
  { key: "fat", label: "Fat", color: "#E05C5C" },
  { key: "fiber", label: "Fiber", color: "#22c55e" },
  { key: "sugar", label: "Sugar", color: "#D87FE8" },
  { key: "sodium", label: "Sodium", color: "#7FB5E8" },
  { key: "water", label: "Water", color: "#4FC3F7" },
] as const;

/** Human-readable labels for notification toggle keys, matching mobile. */
const NOTIFICATION_LABELS: Record<string, string> = {
  showMealTimestamps: "Show meal timestamps",
  newRecipes: "New recipes from people you follow",
  mealReminders: "Meal plan ready",
  weeklyReport: "Weekly summary",
  creatorUpdates: "Your recipe publish updates",
};

interface SettingsProps {
  userTier: "free" | "base" | "pro";
  authEmail?: string | null;
  /** When true (e.g. user tapped header Upgrade), scroll promo into view once */
  scrollToPromoOnOpen?: boolean;
  onScrollToPromoConsumed?: () => void;
}

const LOCAL_CLEAR_KEYS = [
  STORAGE_KEY,
  "suppr-profile-v2",
  "suppr-collections-v1",
  "suppr-recent-foods-v1",
];

export const Settings = memo(function Settings({ userTier, authEmail, scrollToPromoOnOpen, onScrollToPromoConsumed }: SettingsProps) {
  const {
    signOut,
    profileDisplayName,
    redeemPromoCode,
    notificationPrefs,
    setNotificationPrefs,
    preferActivityAdjustedCalories,
    setPreferActivityAdjustedCalories,
    targetCaffeineMg,
    setTargetCaffeineMg,
    targetAlcoholGWeekly,
    setTargetAlcoholGWeekly,
  } = useAppData();
  const { theme, setTheme } = useTheme();
  const promoSectionRef = useRef<HTMLDivElement>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  useEffect(() => {
    if (!scrollToPromoOnOpen) return;
    const id = requestAnimationFrame(() => {
      promoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollToPromoConsumed?.();
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToPromoOnOpen, onScrollToPromoConsumed]);
  const notifications = notificationPrefs;
  const setNotifications = setNotificationPrefs;

  const [dietary, setDietary] = useState<string[]>([]);
  const [measurementSystem, setMeasurementSystem] = useState("metric");
  const [trackedMacros, setTrackedMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [caffeineInput, setCaffeineInput] = useState<string>(String(targetCaffeineMg));
  const [alcoholInput, setAlcoholInput] = useState<string>(String(targetAlcoholGWeekly));

  // Keep inputs in sync when the context value changes (e.g. after initial load).
  useEffect(() => {
    setCaffeineInput(String(targetCaffeineMg));
  }, [targetCaffeineMg]);
  useEffect(() => {
    setAlcoholInput(String(targetAlcoholGWeekly));
  }, [targetAlcoholGWeekly]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("dietary, measurement_system, tracked_macros, week_start_day")
        .eq("id", uid)
        .maybeSingle();
      if (!profile || cancelled) return;
      if (profile.dietary) setDietary(normaliseDietaryFromProfile(profile.dietary));
      if (profile.measurement_system === "metric" || profile.measurement_system === "imperial") {
        setMeasurementSystem(profile.measurement_system);
      }
      if (profile.tracked_macros && Array.isArray(profile.tracked_macros) && profile.tracked_macros.length > 0) {
        setTrackedMacros(profile.tracked_macros as string[]);
      }
      if (profile.week_start_day === "monday" || profile.week_start_day === "sunday") {
        setWeekStartDay(profile.week_start_day);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const savePref = useCallback(async (updates: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { error } = await supabase.from("profiles").update(updates).eq("id", uid);
    if (error) toast.error("Failed to save preference");
  }, []);

  const handleChangePassword = useCallback(async () => {
    if (!authEmail) { toast.error("No email on this account"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent — check your inbox.");
  }, [authEmail]);

  const tierLabels: Record<string, { name: string; color: string }> = {
    free: { name: "Free", color: "bg-muted text-muted-foreground" },
    base: { name: "Base", color: "bg-success/10 text-success" },
    pro: { name: "Pro", color: "bg-primary/10 text-primary" },
  };
  const currentTier = tierLabels[userTier] ?? tierLabels.free;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/30 rounded-xl">
            <Icons.settings className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-foreground bg-clip-text text-transparent">Settings</h1>
        </div>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Current plan */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Icons.sparkles className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Your plan</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentTier.color}`}>
              {currentTier.name}
            </span>
            {authEmail && (
              <span className="text-sm text-muted-foreground">{authEmail}</span>
            )}
          </div>
          {userTier !== "pro" && (
            <Link
              href="/pricing"
              className="text-sm font-medium text-success hover:text-success/80"
            >
              View plans
            </Link>
          )}
        </div>
      </div>

      {/* Promo code (e.g. testing / partner access) */}
      <div
        ref={promoSectionRef}
        className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg scroll-mt-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Icons.ticket className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Promo code</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Redeem a code to upgrade your plan (one use per account per code).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. SUPPR_PRO"
            autoComplete="off"
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            disabled={promoSubmitting || !promoCode.trim()}
            onClick={async () => {
              setPromoSubmitting(true);
              try {
                const result = await redeemPromoCode(promoCode);
                if (result.ok) {
                  if (result.alreadyRedeemed) {
                    toast.success(`Plan confirmed: ${result.tier} (this code was already applied to your account).`);
                  } else {
                    toast.success(`Plan updated: ${result.tier}`);
                  }
                  setPromoCode("");
                } else {
                  const messages: Record<string, string> = {
                    not_authenticated: "Sign in to redeem a code.",
                    invalid_code: "Enter a promo code.",
                    invalid_or_expired: "That code is not valid or has expired.",
                    already_redeemed: "You have already redeemed this code.",
                    rpc_error: result.message ?? "Could not redeem code.",
                    not_deployed: "Promo codes aren't available in this build yet.",
                  };
                  toast.error(messages[result.error] ?? "Could not redeem code.");
                }
              } finally {
                setPromoSubmitting(false);
              }
            }}
            className="px-6 py-2.5 rounded-xl bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {promoSubmitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Icons.user className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Account</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={authEmail ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">Display Name</label>
            <input
              type="text"
              value={profileDisplayName ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleChangePassword()}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all text-sm font-medium"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={signOut}
              className="ml-auto px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-all text-sm font-semibold border border-destructive/30"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Icons.settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Preferences</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Measurement System</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setMeasurementSystem("metric"); void savePref({ measurement_system: "metric" }); }}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "metric"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30"
                }`}
              >
                Metric (g, kg, ml)
              </button>
              <button
                onClick={() => { setMeasurementSystem("imperial"); void savePref({ measurement_system: "imperial" }); }}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "imperial"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30"
                }`}
              >
                Imperial (oz, lb, cups)
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Burn / deficit summary</label>
            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
              On the nutrition tracker, when you expand your calorie ring: show averages for the last seven days ending on the day you view, or for the current calendar week (Monday–Sunday).
            </p>
            <div className="flex gap-3">
              {(
                [
                  { mode: "rolling" as const, label: "Rolling (last 7 days)" },
                  { mode: "calendar_week" as const, label: "This week" },
                ] as const
              ).map(({ mode, label }) => {
                const active = normalizeWeekSummaryMode(notifications.weekSummaryMode) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNotifications({ ...notifications, weekSummaryMode: mode })}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Activity toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <label className="block text-sm font-medium text-foreground">Adjust goal for activity</label>
              <p className="text-xs text-muted-foreground mt-1">
                Adds bonus calories when you burn more than your estimated maintenance
              </p>
            </div>
            <label className="relative cursor-pointer">
              <input
                type="checkbox"
                checked={preferActivityAdjustedCalories}
                onChange={(e) => {
                  const v = e.target.checked;
                  setPreferActivityAdjustedCalories(v);
                  void savePref({ prefer_activity_adjusted_calories: v });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted rounded-full peer-checked:bg-primary transition-all peer-focus:ring-2 peer-focus:ring-primary/50"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
            </label>
          </div>

          {/* Theme picker */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Theme</label>
            <div className="flex gap-0 rounded-xl border-2 border-border overflow-hidden">
              {THEME_OPTIONS.map((opt) => {
                const isActive = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`flex-1 px-4 py-3 transition-all text-sm font-semibold ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Week start picker */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Week starts on</label>
            <div className="flex gap-3">
              {(["monday", "sunday"] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setWeekStartDay(day);
                    void savePref({ week_start_day: day });
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                    weekStartDay === day
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30 text-foreground"
                  }`}
                >
                  {day === "monday" ? "Monday" : "Sunday"}
                </button>
              ))}
            </div>
          </div>

          {/* Hydration & stimulant limits (Batch 2.5) */}
          <div>
            <label className="block mb-1 text-sm font-medium text-foreground">Hydration & stimulants</label>
            <p className="text-xs text-muted-foreground mb-3">
              Caffeine limit is the FDA guideline for healthy adults. Set alcohol to 0 to hide the row.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="caffeine-target">
                  Caffeine limit (mg/day)
                </label>
                <input
                  id="caffeine-target"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2000}
                  step={10}
                  value={caffeineInput}
                  onChange={(e) => setCaffeineInput(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(0, Math.min(2000, Math.round(Number(caffeineInput))));
                    if (Number.isNaN(n)) {
                      setCaffeineInput(String(targetCaffeineMg));
                      return;
                    }
                    setCaffeineInput(String(n));
                    if (n === targetCaffeineMg) return;
                    setTargetCaffeineMg(n);
                    void savePref({ target_caffeine_mg: n });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="alcohol-target">
                  Alcohol limit (g/week, 0 = hide)
                </label>
                <input
                  id="alcohol-target"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2000}
                  step={1}
                  value={alcoholInput}
                  onChange={(e) => setAlcoholInput(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(0, Math.min(2000, Math.round(Number(alcoholInput))));
                    if (Number.isNaN(n)) {
                      setAlcoholInput(String(targetAlcoholGWeekly));
                      return;
                    }
                    setAlcoholInput(String(n));
                    if (n === targetAlcoholGWeekly) return;
                    setTargetAlcoholGWeekly(n);
                    void savePref({ target_alcohol_g_weekly: n });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Reference: 14g ethanol ≈ 1 US standard drink (or ~1.75 UK units). 196g/week = 14 UK units.
            </p>
          </div>

          {/* Dashboard widgets (tracked macros) */}
          <div>
            <label className="block mb-1 text-sm font-medium text-foreground">Dashboard Widgets</label>
            <p className="text-xs text-muted-foreground mb-3">
              Choose which nutrients appear on your Today screen
            </p>
            <div className="space-y-2">
              {WIDGET_MACRO_OPTIONS.map(({ key, label, color }) => {
                const isActive = trackedMacros.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 cursor-pointer group px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="flex-1 text-sm text-foreground">{label}</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => {
                        setTrackedMacros((prev) => {
                          const next = isActive
                            ? prev.filter((m) => m !== key)
                            : [...prev, key];
                          if (next.length === 0) return prev;
                          void savePref({ tracked_macros: next });
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Dietary Restrictions</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_PREFERENCE_ENTRIES.map((diet) => (
                <button
                  key={diet.id}
                  onClick={() => {
                    const next = dietary.includes(diet.id) ? dietary.filter(d => d !== diet.id) : [...dietary, diet.id];
                    setDietary(next);
                    void savePref({ dietary: next.length > 0 ? next : null });
                  }}
                  className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                    dietary.includes(diet.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30 text-foreground"
                  }`}
                >
                  {diet.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Icons.notifications className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Notifications</h3>
        </div>
        <div className="space-y-4">
          {(Object.entries(notifications) as [keyof NotificationPrefs, NotificationPrefs[keyof NotificationPrefs]][])
            .filter((e): e is [keyof NotificationPrefs, boolean] => typeof e[1] === "boolean")
            .map(([key, value]) => (
            <label key={key} className="flex items-center justify-between cursor-pointer group">
              <span className="text-foreground">
                {NOTIFICATION_LABELS[key] ?? key}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer-checked:bg-primary transition-all peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Subscription plans are hidden for now. */}

      {/* Privacy */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Icons.shield className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-foreground">Privacy & Security</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Download includes nutrition snapshots, library saves, collections, and profile data stored on this device.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                try {
                  const localData = buildLocalDataExport();

                  const { data: session } = await supabase.auth.getSession();
                  const uid = session.session?.user.id;

                  let profile: Record<string, unknown> | null = null;
                  let nutritionEntries: unknown[] = [];
                  let saves: unknown[] = [];

                  if (uid) {
                    const [profileRes, entriesRes, savesRes] = await Promise.all([
                      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
                      supabase.from("nutrition_entries").select("*").eq("user_id", uid),
                      supabase.from("saves").select("recipe_id").eq("user_id", uid),
                    ]);
                    profile = profileRes.data ?? null;
                    nutritionEntries = entriesRes.data ?? [];
                    saves = savesRes.data ?? [];
                  }

                  const exportData = {
                    ...localData,
                    profile,
                    nutritionEntries,
                    saves,
                    exportedAt: new Date().toISOString(),
                  };

                  downloadJsonFile(`suppr-export-${new Date().toISOString().slice(0, 10)}.json`, exportData);
                  toast.success("Download started.");
                } catch {
                  toast.error("Could not build export.");
                }
              })();
            }}
            className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Download your data (JSON)
          </button>
          <Link
            href="/privacy"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Privacy policy
          </Link>
          <Link
            href="/help"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Help
          </Link>
          <Link
            href="/terms"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Terms of service
          </Link>
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "This will sign you out and remove Suppr data stored on this device. Continue?",
                )
              ) {
                return;
              }
              for (const k of LOCAL_CLEAR_KEYS) {
                try {
                  localStorage.removeItem(k);
                } catch {
                  /* ignore */
                }
              }
              void signOut().then(() => {
                toast.success("Local data cleared. Signed out.");
                window.location.href = "/login";
              });
            }}
            className="w-full text-left px-4 py-3 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-all text-red-600 dark:text-red-400"
          >
            Delete local data &amp; sign out
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "This will permanently delete your account and all associated data. This action cannot be undone. Continue?",
                )
              ) {
                return;
              }
              if (
                !window.confirm(
                  "Are you sure? Your recipes, logs, meal plans, and profile will be permanently deleted.",
                )
              ) {
                return;
              }
              void (async () => {
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData?.session?.access_token;
                  const res = await fetch("/api/account/delete", {
                    method: "DELETE",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  const json = await res.json();
                  if (json.ok) {
                    for (const k of LOCAL_CLEAR_KEYS) {
                      try { localStorage.removeItem(k); } catch { /* ignore */ }
                    }
                    toast.success("Account deleted.");
                    window.location.href = "/login";
                  } else {
                    toast.error(json.error || "Account deletion failed. Please try again.");
                  }
                } catch {
                  toast.error("Account deletion failed. Please try again.");
                }
              })();
            }}
            className="w-full text-left px-4 py-3 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-all text-red-700 dark:text-red-300 font-medium"
          >
            Delete my account permanently
          </button>
        </div>
      </div>
    </div>
  );
});
