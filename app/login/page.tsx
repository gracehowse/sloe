"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase/browserClient.ts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

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

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter an email address.");
      return;
    }
    setStatus("sending");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6">
      <div className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="mb-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
          Sign in to Platemate
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Use a magic link. No password needed.
        </p>

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

        <button
          type="button"
          onClick={sendMagicLink}
          disabled={status === "sending"}
          className="w-full mt-4 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </button>

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
          You must enable Email auth in Supabase Auth settings.
        </p>
      </div>
    </div>
  );
}

