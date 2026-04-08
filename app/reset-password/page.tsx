"use client";

import { useEffect, useState } from "react";
import { AppLoadingSkeleton } from "@/app/components/AppLoadingSkeleton";
import { supabase } from "@/lib/supabase/browserClient";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    // Supabase will set a recovery session on this page after the user clicks the email link.
    // If it didn't, don't block the user, but show a helpful message.
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  const submit = async () => {
    if (!password || password.length < 8) {
      toast.error("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated. You can now sign in.");
      window.location.href = "/login";
    } finally {
      setWorking(false);
    }
  };

  if (!ready) {
    return <AppLoadingSkeleton label="Preparing password reset…" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6">
      <div className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="mb-2 text-slate-900 dark:text-white">Reset password</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          Choose a new password for your account.
        </p>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
          placeholder="At least 8 characters"
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 mt-4">
          Confirm password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
          placeholder="Re-enter password"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={working}
          className="w-full mt-6 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {working ? "Saving…" : "Update password"}
        </button>
      </div>
    </div>
  );
}

