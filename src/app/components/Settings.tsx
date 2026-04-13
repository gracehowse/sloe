"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, User, Bell, Shield, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { STORAGE_KEY } from "../../context/appData/persistence.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../constants/dietaryPreferences.ts";
import { buildLocalDataExport, downloadJsonFile } from "../../lib/client/exportPlatemateLocalData.ts";

interface SettingsProps {
  userTier: "free" | "base" | "pro";
  authEmail?: string | null;
  /** When true (e.g. user tapped header Upgrade), scroll promo into view once */
  scrollToPromoOnOpen?: boolean;
  onScrollToPromoConsumed?: () => void;
}

const LOCAL_CLEAR_KEYS = [
  STORAGE_KEY,
  "platemate-profile-v2",
  "platemate-collections-v1",
  "platemate-recent-foods-v1",
];

export const Settings = memo(function Settings({ userTier, authEmail, scrollToPromoOnOpen, onScrollToPromoConsumed }: SettingsProps) {
  const { signOut, profileDisplayName, redeemPromoCode, notificationPrefs, setNotificationPrefs } = useAppData();
  const promoSectionRef = useRef<HTMLDivElement>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  // Stripe checkout is now handled via /pricing page


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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("dietary, measurement_system")
        .eq("id", uid)
        .maybeSingle();
      if (!profile || cancelled) return;
      if (profile.dietary) setDietary(normaliseDietaryFromProfile(profile.dietary));
      if (profile.measurement_system === "metric" || profile.measurement_system === "imperial") {
        setMeasurementSystem(profile.measurement_system);
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
    free: { name: "Free", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    base: { name: "Base", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    pro: { name: "Pro", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  };
  const currentTier = tierLabels[userTier] ?? tierLabels.free;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 rounded-xl">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Settings</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Current plan */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Your plan</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentTier.color}`}>
              {currentTier.name}
            </span>
            {authEmail && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{authEmail}</span>
            )}
          </div>
          {userTier !== "pro" && (
            <Link
              href="/pricing"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              View plans
            </Link>
          )}
        </div>
      </div>

      {/* Promo code (e.g. testing / partner access) */}
      <div
        ref={promoSectionRef}
        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg scroll-mt-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Promo code</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Redeem a code to upgrade your plan (one use per account per code).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. PLATEMATE_PRO"
            autoComplete="off"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
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
                    not_deployed: "Promo codes aren’t available in this build yet.",
                  };
                  toast.error(messages[result.error] ?? "Could not redeem code.");
                }
              } finally {
                setPromoSubmitting(false);
              }
            }}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {promoSubmitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Account</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={authEmail ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Display Name</label>
            <input
              type="text"
              value={profileDisplayName ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleChangePassword()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all text-sm font-medium"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={signOut}
              className="ml-auto px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-700 dark:text-red-300 rounded-lg transition-all text-sm font-semibold border border-red-200/60 dark:border-red-900/40"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Preferences</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Measurement System</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setMeasurementSystem("metric"); void savePref({ measurement_system: "metric" }); }}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "metric"
                    ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                Metric (g, kg, ml)
              </button>
              <button
                onClick={() => { setMeasurementSystem("imperial"); void savePref({ measurement_system: "imperial" }); }}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "imperial"
                    ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                Imperial (oz, lb, cups)
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Restrictions</label>
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
                      ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                      : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 text-slate-700 dark:text-slate-300"
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
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Notifications</h3>
        </div>
        <div className="space-y-4">
          {Object.entries(notifications).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between cursor-pointer group">
              <span className="text-slate-700 dark:text-slate-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-violet-600 transition-all peer-focus:ring-2 peer-focus:ring-violet-500/50"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Subscription plans are hidden for now. */}

      {/* Privacy */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Privacy & Security</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Download includes nutrition snapshots, library saves, collections, and profile data stored on this device.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              try {
                const data = buildLocalDataExport();
                downloadJsonFile(`platemate-export-${new Date().toISOString().slice(0, 10)}.json`, data);
                toast.success("Download started.");
              } catch {
                toast.error("Could not build export.");
              }
            }}
            className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300"
          >
            Download your data (JSON)
          </button>
          <Link
            href="/privacy"
            className="block w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300"
          >
            Privacy policy
          </Link>
          <Link
            href="/help"
            className="block w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300"
          >
            Help
          </Link>
          <Link
            href="/terms"
            className="block w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300"
          >
            Terms of service
          </Link>
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "This will sign you out and remove Platemate data stored on this device. Continue?",
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
        </div>
      </div>
    </div>
  );
});
