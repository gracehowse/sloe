"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase/browserClient.ts";

export function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [status, setStatus] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.location.href = "/";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const validateEmail = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter an email address.");
      return null;
    }
    return trimmed;
  };

  const signUp = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (!password) {
      setStatus("error");
      setMessage("Enter a password.");
      return;
    }
    setStatus("working");
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Account created. Check your email to confirm, then sign in.");
  };

  const signIn = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (!password) {
      setStatus("error");
      setMessage("Enter your password.");
      return;
    }
    setStatus("working");
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("idle");
  };

  const sendMagicLink = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    setStatus("working");
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Check your email for a sign-in link.");
  };

  const sendPasswordReset = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    setStatus("working");
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Check your email for a password reset link.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6">
      <div className="w-full max-w-md">
        {/* Value proposition — above the form */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-lg shadow-violet-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Meal plans that hit your macros
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            Find recipes, plan your week, generate a shopping list, and track what you eat — all built around your calorie and protein targets.
          </p>
        </div>

        {/* Auth form */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
        <h2 className="text-lg font-semibold mb-1 text-slate-900 dark:text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          {mode === "signup"
            ? "Free to start. Set your targets and plan your first week."
            : "Sign in to continue."}
        </p>

        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage(null);
              setStatus("idle");
            }}
            className={`flex-1 px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${
              mode === "signup"
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMessage(null);
              setStatus("idle");
            }}
            className={`flex-1 px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${
              mode === "signin"
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            Sign in
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
          placeholder="you@domain.com"
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 mt-4">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
          placeholder={mode === "signup" ? "Create a password" : "Your password"}
        />

        <button
          type="button"
          onClick={mode === "signup" ? signUp : signIn}
          disabled={status === "working"}
          className="w-full mt-4 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {status === "working" ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => void sendPasswordReset()}
            disabled={status === "working"}
            className="mt-3 text-sm text-violet-700 dark:text-violet-300 hover:underline font-medium"
          >
            Forgot password?
          </button>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowMagicLink((v) => !v)}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
          >
            {showMagicLink ? "Hide magic link option" : "Use a magic link instead (existing accounts)"}
          </button>
          {showMagicLink && (
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={status === "working"}
              className="w-full mt-3 px-5 py-3.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Send magic link
            </button>
          )}
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          If you just created an account, you may need to confirm your email before signing in.
        </p>
        </div>
      </div>
    </div>
  );
}

