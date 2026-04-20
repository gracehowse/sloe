import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import posthog from "posthog-js";
import { supabase } from "../lib/supabase/browserClient.ts";
import { syncProfileTimezone } from "../lib/profile/tzSync.ts";

export interface AuthSessionValue {
  authedUserId: string | null;
  authEmail: string | null;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

/**
 * Supabase session only (user id + email). Profile tier / display name stay in {@link AppDataProvider}.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const userId = data.session?.user.id ?? null;
      const email = data.session?.user.email ?? null;
      setAuthedUserId(userId);
      setAuthEmail(email);
      // Stitch any pre-login anonymous events to this user on page load.
      if (userId && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.identify(userId, email ? { email } : undefined);
      }
      // Write IANA tz into profiles so the weekly recap push fires at
      // the user's local 18:00 (T12, 2026-04-20). Fire-and-forget;
      // syncProfileTimezone swallows errors.
      if (userId) void syncProfileTimezone(supabase, userId);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      const email = session?.user.email ?? null;
      setAuthedUserId(userId);
      setAuthEmail(email);
      if (userId && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.identify(userId, email ? { email } : undefined);
      } else if (!userId && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        // User signed out — reset to prevent cross-user contamination.
        posthog.reset();
      }
      if (userId) void syncProfileTimezone(supabase, userId);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ authedUserId, authEmail }), [authedUserId, authEmail]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }
  return ctx;
}

/**
 * Non-throwing variant for surfaces that may be rendered outside an
 * AuthSessionProvider — primarily isolated unit tests of components
 * that read auth defensively (e.g. v2 onboarding's Signup step
 * smoke-render at tests/unit/onboardingV2Steps.test.tsx). Production
 * always has the provider mounted at the root layout, so a null
 * return here unambiguously means "rendered without provider, treat
 * as anonymous".
 */
export function useAuthSessionOptional(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  return ctx ?? { authedUserId: null, authEmail: null };
}
