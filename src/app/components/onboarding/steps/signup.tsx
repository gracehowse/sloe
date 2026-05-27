"use client";

import * as React from "react";
import posthog from "posthog-js";
import { Button } from "@/app/components/ui/button";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { supabase } from "@/lib/supabase/browserClient";
import { useAuthSessionOptional } from "@/context/AuthSessionContext";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Signup — step 02. Real Supabase email signUp inline.
 *
 * Apple Sign-In on web is removed (Sign in with Apple JS isn't
 * configured for suppr-club.com and a non-functional button is a
 * trust-killer — Grace 2026-04-20). Future Google OAuth can be added
 * here without changing the architecture.
 *
 * When the visitor is already authed (e.g. they came from /login and
 * navigated here manually), the WebFlow shell auto-bumps past this
 * step — see the effect in `web-flow.tsx`.
 *
 * Password lives in component state ONLY; never written into
 * `OnboardingState` (which persists to localStorage). Email + name go
 * into onboarding state so the Reveal step can greet by name and the
 * persistence layer can hydrate `display_name`.
 */

export function SignupStep() {
  const { state, set, go } = useOnboarding();
  // Optional read so smoke / unit tests can render this step in
  // isolation without an AuthSessionProvider wrapper. Production
  // always has the provider mounted at the root layout.
  const { authedUserId, authEmail } = useAuthSessionOptional();
  const overline = useStepOverline();

  // Component-local password — never persisted.
  const [password, setPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // ENG-672 (2026-05-26) — confirm-email mode. When Supabase is
  // configured with email confirmations ON, `signUp` returns a `user`
  // but NO `session`. Pre-fix the step advanced anyway (`go(1)`),
  // walking the user into the rest of the flow unauthenticated; the
  // terminal step then bounced them to /onboarding, and any answer the
  // user had NOT yet given was lost. Now we DON'T advance — we surface
  // an honest "confirm your email" state and keep the user on Signup.
  // Their answers persist in localStorage, so when they confirm and the
  // email-redirect lands them back on /onboarding with a real session,
  // the auto-skip effect in `web-flow.tsx` carries them forward.
  const [confirmEmailSent, setConfirmEmailSent] = React.useState(false);

  // Already-authed branch (rare — usually the WebFlow shell auto-bumps
  // past this step). Show a friendly continue card instead of the form
  // so the visible state matches "you're already signed in".
  if (authedUserId) {
    return (
      <StepBody>
        <StepHeader
          overline={overline}
          title={`You're signed in${authEmail ? ` as ${authEmail}` : ""}`}
          subtitle="One tap to keep going — we'll pick up where the rest of onboarding starts."
        />
        <Button
          size="lg"
          className="w-full h-12 font-bold"
          onClick={() => go(1)}
        >
          Continue
        </Button>
      </StepBody>
    );
  }

  // ENG-672 (2026-05-26) — confirm-email interstitial. Honest about
  // where the user is: the account exists but isn't usable until they
  // click the link. We deliberately keep them on Signup rather than
  // advancing into the flow unauthenticated. Their answers are safe in
  // localStorage; the email-redirect lands them back on /onboarding
  // with a session, and the shell auto-advances from there.
  if (confirmEmailSent) {
    return (
      <StepBody>
        <StepHeader
          overline={overline}
          title="Check your email"
          subtitle={`We sent a confirmation link to ${state.email.trim()}. Open it to finish setting up — your answers are saved.`}
        />
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setConfirmEmailSent(false)}
            className="text-foreground/80 underline font-semibold"
          >
            try a different email
          </button>
          .
        </p>
      </StepBody>
    );
  }

  const trimmedEmail = state.email.trim();
  const trimmedName = state.name.trim();
  const canSubmit =
    !submitting &&
    trimmedName.length > 0 &&
    trimmedEmail.includes("@") &&
    password.length >= 8 &&
    acceptedTerms;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/onboarding`
              : undefined,
          data: { display_name: trimmedName },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.user) {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          try {
            posthog.identify(data.user.id, { email: trimmedEmail });
          } catch {
            /* ignore — analytics never blocks the user */
          }
        }
        track(AnalyticsEvents.user_signed_up, { method: "email", flow: "v2" });
        set({ authMethod: "email" });
        // ENG-672 (2026-05-26) — advance ONLY when a real session lands.
        //   - Confirmations OFF: `signUp` returns a `session` immediately;
        //     the AuthSessionContext subscriber flips `authedUserId` and
        //     the WebFlow shell's auto-skip effect carries the user past
        //     Signup. We do NOT call `go(1)` here — letting the session-
        //     driven effect own the advance keeps a single source of truth
        //     and avoids advancing a frame before auth state settles.
        //   - Confirmations ON: `signUp` returns a `user` but NO
        //     `session`. We must NOT advance — the user is still
        //     unauthenticated. Show the "check your email" state and keep
        //     them on Signup. Their answers persist in localStorage, so
        //     the email-redirect back to /onboarding resumes the flow with
        //     a real session.
        if (!data.session) {
          setConfirmEmailSent(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Create your account"
        subtitle="One account, same data on your phone and on the web."
      />

      <div className="flex flex-col gap-2.5">
        <LabelledField
          label="First name"
          value={state.name}
          onChange={(v) => set({ name: v })}
          placeholder="Grace"
          autoFocus
        />
        <LabelledField
          label="Email"
          value={state.email}
          onChange={(v) => set({ email: v })}
          placeholder="you@example.com"
          type="email"
        />
        <LabelledField
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          type="password"
        />
      </div>

      <label className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground leading-snug cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-pointer"
          aria-label="Agree to Terms of Service and Privacy Policy"
        />
        <span>
          I agree to Suppr&apos;s{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-foreground/80 underline"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-foreground/80 underline"
          >
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <Button
        size="lg"
        className="w-full h-12 mt-4 font-bold"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
      >
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      {error && (
        <p
          className="mt-3 text-[11px] text-destructive leading-snug"
          role="alert"
        >
          {error}{" "}
          {/already registered|already exists|user with this email/i.test(
            error,
          ) && (
            <a
              href="/login"
              className="underline font-semibold"
            >
              Sign in instead
            </a>
          )}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed text-center">
        Already have an account?{" "}
        <a href="/login" className="text-foreground/80 underline font-semibold">
          Sign in
        </a>
      </p>
    </StepBody>
  );
}

function LabelledField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  autoFocus?: boolean;
}) {
  return (
    <label className="block bg-card border border-border rounded-md px-3.5 py-2.5 transition-pm focus-within:border-primary">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent border-0 outline-none text-base font-medium text-foreground placeholder:text-muted-foreground/60"
      />
    </label>
  );
}
