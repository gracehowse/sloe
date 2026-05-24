"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLoadingSkeleton } from "@/app/components/AppLoadingSkeleton";
import { supabase } from "@/lib/supabase/browserClient";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
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
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md">
        {/* Brand mark above the card — matches /login, /signup, /signin.
            Neutral `--brand-mark-*` tokens per the 2026-05-19 brand
            decision (not indigo primary). DRIFT-01 fix 2026-05-22. */}
        <div className="text-center mb-6 sm:mb-8">
          {/* Canonical brand mark — paper-on-paper drop-cap. */}
          <div
            className="inline-flex items-center justify-center mb-4 font-extrabold"
            style={{
              color: "var(--brand-mark-ring)",
              fontSize: 32,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
            aria-label="Suppr"
          >
            S
          </div>
        </div>

      <div
        className="rounded-2xl p-8"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
        }}
      >
        <h1 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Reset password
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Choose a new password for your account.
        </p>

        <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl transition-all outline-none"
          style={{
            background: "var(--input-background)",
            border: "2px solid var(--border)",
            color: "var(--foreground)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--ring)";
            e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--ring) 20%, transparent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
          placeholder="At least 8 characters"
        />

        <label className="block text-sm font-medium mb-2 mt-4" style={{ color: "var(--foreground)" }}>
          Confirm password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-4 py-3 rounded-xl transition-all outline-none"
          style={{
            background: "var(--input-background)",
            border: "2px solid var(--border)",
            color: "var(--foreground)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--ring)";
            e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--ring) 20%, transparent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
          placeholder="Re-enter password"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={working}
          className="w-full mt-6 px-5 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 30%, transparent)",
          }}
        >
          {working ? "Saving…" : "Update password"}
        </button>

        {/*
         * ENG-86 (audit 2026-04-30): users who landed here in error
         * (wrong link, didn't actually request a reset) had no exit —
         * no header, no logo, no link out. The "Back to sign in" link
         * gives them the obvious way back without typing the URL.
         * Muted styling so it doesn't compete with the primary CTA.
         */}
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-sm underline-offset-2 hover:underline transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
