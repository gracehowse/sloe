"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";

export type LoginClientProps = {
  /** Default tab; `/signin` defaults to "signin" with `hideTabs` so
   *  there's no Sign Up tab visible (Sign Up flow lives at /onboarding). */
  initialMode?: "signin" | "signup";
  /** When true the Sign Up / Sign In tab strip is hidden and the user
   *  cannot switch mode inline. Used by `/signin` (sign-in only) so the
   *  account-creation entry point stays canonically at /onboarding. */
  hideTabs?: boolean;
};

// Debug audit 2026-05-04 (customer-lens #8): default flipped from
// "signup" → "signin". Canonical signup lives at /onboarding; this
// route is the signin destination from the landing's "Sign in" link.
export function LoginClient({ initialMode = "signin", hideTabs = false }: LoginClientProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [status, setStatus] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  // Positive assent to Terms + Privacy is required at account creation
  // (browsewrap / implicit assent is unenforceable in California under
  // Nguyen v. Barnes & Noble, 763 F.3d 1171). The box defaults to
  // unchecked — never pre-check.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only redirect on an explicit SIGNED_IN event (user just
      // submitted the form, Apple OAuth just came back, magic link
      // completed, etc.). INITIAL_SESSION fires synchronously on
      // mount if a session cookie already exists — if we redirected
      // on that, an already-authed user arriving at /login (e.g.
      // because they clicked "Sign in" on the landing out of habit)
      // would get involuntarily shipped to /home, and if their
      // profile isn't onboarding_complete they'd then bounce to
      // /onboarding. That chain read as "the landing keeps
      // redirecting" (Grace 2026-04-20).
      if (event === "SIGNED_IN" && session?.user) {
        // Dashboard lives at /home; / is the marketing landing.
        window.location.href = "/home";
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
    if (!acceptedTerms) {
      setStatus("error");
      setMessage("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setStatus("working");
    setMessage(null);
    const { data: signUpData, error } = await supabase.auth.signUp({
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
    if (signUpData.user) {
      posthog.identify(signUpData.user.id, { email: trimmed });
      track(AnalyticsEvents.user_signed_up, { method: "email" });
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
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    if (signInData.user) {
      posthog.identify(signInData.user.id, { email: trimmed });
      track(AnalyticsEvents.user_signed_in, { method: "email" });
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

  const signInWithApple = async () => {
    if (typeof window === "undefined") return;
    setStatus("working");
    setMessage(null);
    track(AnalyticsEvents.user_signed_in, { method: "apple_oauth_started" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md">
        {/* 2026-05-14 (premium-sweep-v2 row 5.1 + 5.2): brand mark
            updated from generic clipboard-with-checkmark SVG to the
            Suppr "S" wordmark tile (same mark used in the landing
            top-bar + mobile Welcome). Brand consistency at the first
            auth touchpoint. Page-level H1 + subtitle removed because
            the card directly below carries the same content ("Welcome
            back / Sign in to continue.") — two competing headlines for
            the same surface. */}
        <div className="text-center mb-6 sm:mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 text-white font-extrabold text-2xl"
            style={{
              background: "var(--primary)",
              boxShadow: "0 8px 24px color-mix(in srgb, var(--primary) 25%, transparent)",
              letterSpacing: "-0.02em",
            }}
            aria-label="Suppr"
          >
            S
          </div>
        </div>

        {/* Auth form */}
        <div
          className="rounded-2xl p-5 sm:p-8"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p
            className="text-sm mb-5"
            style={{ color: "var(--muted-foreground)" }}
          >
            {mode === "signup"
              ? "Free to start. Set your targets and plan your first week."
              : "Sign in to continue."}
          </p>

          {/* The mode-switcher is hidden on /signin — sign-up entry
              point is canonically at /onboarding (which runs the v2
              flow with auth inline). Keeping a "Sign up" tab here
              would split the sign-up surface and re-create the
              duplicate-account-creation bug. */}
          {!hideTabs && (
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => { setMode("signup"); setMessage(null); setStatus("idle"); }}
                className="flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition-all"
                style={mode === "signup" ? {
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  borderColor: "var(--primary)",
                } : {
                  background: "var(--card)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                }}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => { setMode("signin"); setMessage(null); setStatus("idle"); }}
                className="flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition-all"
                style={mode === "signin" ? {
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  borderColor: "var(--primary)",
                } : {
                  background: "var(--card)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                }}
              >
                Sign in
              </button>
            </div>
          )}

          {/* Apple OAuth — F-141 (2026-05-10): web parity for the
              mobile Apple sign-in flow. Supabase Auth's Apple provider
              is enabled (verified `auth.identities` count > 0); the
              callback at /auth/callback/route.ts is PKCE-correct.
              Position is above email/password as the primary OAuth
              option, matching mobile login.tsx hierarchy. */}
          <button
            type="button"
            onClick={signInWithApple}
            disabled={status === "working"}
            className="w-full mb-4 px-5 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              // Apple HIG requires black-on-white in light mode and
              // white-on-black in dark mode. Tokens carry the inversion
              // — see `--apple-bg` / `--apple-fg` / `--apple-border` in
              // src/styles/theme.css (added 2026-05-17, T4.10).
              background: "var(--apple-bg)",
              color: "var(--apple-fg)",
              border: "1px solid var(--apple-border)",
            }}
            aria-label="Continue with Apple"
          >
            <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            Continue with Apple
          </button>

          <div className="flex items-center gap-3 mb-4" aria-hidden="true">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            placeholder="you@domain.com"
          />

          <label
            className="block text-sm font-medium mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            Password
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
            placeholder={mode === "signup" ? "Create a password" : "Your password"}
          />

          {mode === "signup" && (
            <label className="mt-4 flex items-start gap-2 text-xs cursor-pointer" style={{ color: "var(--muted-foreground)" }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                aria-label="Agree to Terms of Service and Privacy Policy"
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--primary)" }}>
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--primary)" }}>
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={mode === "signup" ? signUp : signIn}
            disabled={status === "working" || (mode === "signup" && !acceptedTerms)}
            className="w-full mt-4 px-5 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 6px 24px color-mix(in srgb, var(--primary) 40%, transparent)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 16px color-mix(in srgb, var(--primary) 30%, transparent)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {status === "working" ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>

          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => void sendPasswordReset()}
              disabled={status === "working"}
              className="mt-3 text-sm font-medium hover:underline"
              style={{ color: "var(--primary)" }}
            >
              Forgot password?
            </button>
          ) : null}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowMagicLink((v) => !v)}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              {showMagicLink ? "Hide magic link option" : "Use a magic link instead (existing accounts)"}
            </button>
            {showMagicLink && (
              <button
                type="button"
                onClick={sendMagicLink}
                disabled={status === "working"}
                className="w-full mt-3 px-5 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                Send magic link
              </button>
            )}
          </div>

          {message && (
            <p
              className="mt-4 text-sm"
              style={{
                color: status === "error" ? "var(--destructive)" : "var(--muted-foreground)",
              }}
            >
              {message}
            </p>
          )}

          {/* Cross-link to the canonical Sign Up entry point. Only
              shown on /signin (hideTabs) so the legacy /login page —
              which still has Sign Up / Sign In tabs — doesn't get a
              redundant nudge. */}
          {hideTabs && mode === "signin" && (
            <p
              className="mt-6 text-xs text-center"
              style={{ color: "var(--muted-foreground)" }}
            >
              New to Suppr?{" "}
              <a
                href="/onboarding"
                className="font-semibold underline"
                style={{ color: "var(--primary)" }}
              >
                Create your account
              </a>
            </p>
          )}

          <p
            className="mt-6 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            If you just created an account, you may need to confirm your email before signing in.
          </p>
        </div>
      </div>
    </div>
  );
}
