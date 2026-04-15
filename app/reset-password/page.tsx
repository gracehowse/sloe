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
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
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
      </div>
    </div>
  );
}
