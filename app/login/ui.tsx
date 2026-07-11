"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";

export type LoginClientProps = {
  /** Default tab; `/signin` defaults to "signin" with `hideTabs` so
   *  there's no Sign Up tab visible (Sign Up flow lives at /signup). */
  initialMode?: "signin" | "signup";
  /** When true the Sign Up / Sign In tab strip is hidden and the user
   *  cannot switch mode inline. Used by `/signin` and `/signup`. */
  hideTabs?: boolean;
  /** Where to send the user after a successful sign-in event.
   *  Signup defaults to `/onboarding` so new accounts enter the v2
   *  profile flow instead of bypassing it via `/home`. */
  postSignInHref?: string;
};

// Debug audit 2026-05-04 (customer-lens #8): default flipped from
// "signup" → "signin". Canonical signup lives at /onboarding; this
// route is the signin destination from the landing's "Sign in" link.
export function LoginClient({
  initialMode = "signin",
  hideTabs = false,
  postSignInHref,
}: LoginClientProps) {
  const redirectAfterSignIn =
    postSignInHref ?? (initialMode === "signup" ? "/onboarding" : "/home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  // Sloe auth chooser (Figma `296:2`, 2026-06-08): the screen now opens on
  // a calm chooser — wordmark, positioning headline, Apple + email buttons,
  // terms fine-print — and the email/password form is PROGRESSIVELY
  // DISCLOSED. `view` toggles chooser ↔ email locally (no route change, no
  // architectural change — auth stop-zone respected). Every handler below
  // is unchanged; only the presentation/order moved.
  const [view, setView] = useState<"chooser" | "email">("chooser");
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
        window.location.href = redirectAfterSignIn;
      }
    });
    return () => subscription.unsubscribe();
  }, [redirectAfterSignIn]);

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
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
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
    // ENG-1512 — branch on the session, mirroring the onboarding signup
    // step (src/app/components/onboarding/steps/signup.tsx, ENG-672):
    //   - Confirmations OFF (supabase/config.toml enable_confirmations =
    //     false): signUp returns a live session and the SIGNED_IN
    //     listener above redirects. Silent success, same as signIn —
    //     telling the user to "check your email" here would be false.
    //   - Confirmations ON (no session): the confirmation email really
    //     was sent, so the copy below is honest.
    if (signUpData.session) {
      setStatus("idle");
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
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
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
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}` : undefined,
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

  // Dismiss / close — return to the public landing. Mirrors the mobile
  // chooser's close affordance (frame `296:2` top-right X). Uses a hard
  // nav so an already-mounted Supabase listener doesn't fight the back.
  const onClose = () => {
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <div
      className="min-h-screen flex flex-col px-5 sm:px-6 py-6"
      style={{ background: "var(--background)" }}
    >
      {/* Close X — top-right (frame 296:2). Always present; dismisses to
          the public landing. Hidden from a11y tree label-wise but keeps a
          name for screen readers. */}
      <div className="w-full max-w-md mx-auto flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
        {/* Brand + positioning — Sloe wordmark, then the two-line brand
            headline with italic "Still" (frame 296:2, keep exact), then the
            sync subtitle. */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center font-[family-name:var(--font-brand)] font-light tracking-tight text-foreground-brand lowercase"
            style={{ fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
            role="img"
            aria-label="Sloe"
          >
            sloe
          </div>
          <h1
            className="mt-7 font-[family-name:var(--font-newsreader)] font-medium text-foreground-brand"
            style={{ fontSize: 30, lineHeight: 1.18, letterSpacing: "-0.01em" }}
          >
            Cook what you love.
            <br />
            <span className="italic">Still</span> reach your goals.
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Create an account or log in — your recipes and plan sync everywhere.
          </p>
        </div>

        {view === "chooser" ? (
          /* ── Chooser (default) ──────────────────────────────────────
             Apple (near-black fill) + email (outline). Google is OMITTED
             per ENG-924 (Apple + email only; Supabase Apple provider is
             the only OAuth wired). "Continue with email" reveals the form
             below via progressive disclosure — no route/flow change. */
          <div className="mt-10">
            <button
              type="button"
              onClick={signInWithApple}
              disabled={status === "working"}
              className="w-full px-5 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              style={{
                minHeight: 56,
                background: "var(--foreground)",
                color: "var(--background)",
                border: "1px solid var(--foreground)",
              }}
              aria-label="Continue with Apple"
            >
              <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              Continue with Apple
            </button>

            <button
              type="button"
              onClick={() => { setView("email"); setMessage(null); setStatus("idle"); }}
              className="w-full mt-3 px-5 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2.5"
              style={{
                minHeight: 56,
                background: "var(--background)",
                color: "var(--foreground-brand)",
                border: "1.5px solid var(--border)",
              }}
              aria-label="Continue with email"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Continue with email
            </button>

            {/* Terms / Privacy fine print (frame 296:2). */}
            <p
              className="mt-8 text-xs text-center"
              style={{ color: "var(--muted-foreground)" }}
            >
              By continuing you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--muted-foreground)" }}>
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--muted-foreground)" }}>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        ) : (
          /* ── Email form (progressive disclosure) ────────────────────
             The full email/password surface, unchanged in behaviour. A
             back affordance returns to the chooser. The mode toggle stays
             available on /login (hideTabs=false). */
          <div className="mt-8">
            <button
              type="button"
              onClick={() => { setView("chooser"); setMessage(null); setStatus("idle"); }}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </button>

            <div className="text-center mb-5">
              <h2
                className="font-[family-name:var(--font-headline)] font-medium text-foreground-brand"
                style={{ fontSize: 28, lineHeight: 1.2, letterSpacing: "-0.02em" }}
              >
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {mode === "signup"
                  ? "Cook what you love. Still reach your goals."
                  : "Sign in to continue."}
              </p>
            </div>

            {/* The mode-switcher is hidden on /signin and /signup (hideTabs)
                — sign-up entry point is canonically /signup. Keeping the tab
                strip on /login lets a returning user flip to create-account
                without leaving the surface. */}
            {!hideTabs && (
              <div className="flex gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setMessage(null); setStatus("idle"); }}
                  className="flex-1 px-4 py-2 rounded-full border text-sm font-semibold transition-all"
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
                  className="flex-1 px-4 py-2 rounded-full border text-sm font-semibold transition-all"
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
              className="w-full px-4 py-3 rounded-[var(--radius-card)] transition-all outline-none"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
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
              className="w-full px-4 py-3 rounded-[var(--radius-card)] transition-all outline-none"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
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
              className="w-full mt-4 px-5 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                minHeight: 56,
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
              {status === "working" ? "Working…" : mode === "signup" ? "Create Account" : "Sign in"}
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
                className="text-sm font-medium hover:underline transition-colors"
                style={{ color: "var(--primary)" }}
              >
                {showMagicLink ? "Hide magic link option" : "Use a magic link instead (existing accounts)"}
              </button>
              {showMagicLink && (
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={status === "working"}
                  className="w-full mt-3 px-5 py-3.5 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {hideTabs && mode === "signin" && (
              <p
                className="mt-6 text-xs text-center"
                style={{ color: "var(--muted-foreground)" }}
              >
                New to Sloe?{" "}
                <a
                  href="/signup"
                  className="font-semibold underline"
                  style={{ color: "var(--primary)" }}
                >
                  Create your account
                </a>
              </p>
            )}

            {hideTabs && mode === "signup" && (
              <p
                className="mt-6 text-xs text-center"
                style={{ color: "var(--muted-foreground)" }}
              >
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-semibold underline"
                  style={{ color: "var(--primary)" }}
                >
                  Sign in
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
