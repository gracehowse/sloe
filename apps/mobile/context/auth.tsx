import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncProfileTimezone } from "../../../src/lib/profile/tzSync";
import { setUser as sentrySetUser, clearUser as sentryClearUser } from "@/lib/errorTracking";
import { identify as posthogIdentify, reset as posthogReset } from "@/lib/analytics";
import { clearUserScopedAsyncStorage } from "@/lib/clearUserScopedStorage";

/**
 * P1-13 (2026-04-25): keep Sentry + PostHog user context in sync with
 * the Supabase session. Without this, crashes lack a user id (harder
 * to triage per-user issues) and PostHog funnels stay anonymous until
 * an event manually identifies. Idempotent — safe to call on every
 * auth state change.
 *
 * 2026-05-15: also pass `email` to PostHog's identify so person-
 * properties are populated. Without this, any feature flag that
 * targets by `email` (e.g. allowlists for staged rollouts) silently
 * evaluates to OFF on mobile because the SDK has no email to compare.
 * Web has been doing this since src/context/AuthSessionContext.tsx;
 * mobile was the divergence. Surfaced while wiring Maestro validation
 * for `today_log_usual_row_v2` — the gracemturner test account was
 * targeted by email but the flag stayed off in the sim.
 */
function syncObservabilityUser(session: Session | null): void {
  const uid = session?.user?.id;
  const email = session?.user?.email;
  if (uid) {
    try {
      sentrySetUser(uid);
    } catch { /* swallow — observability must never break auth */ }
    try {
      posthogIdentify(uid, email ? { email } : undefined);
    } catch { /* swallow */ }
  } else {
    try {
      sentryClearUser();
    } catch { /* swallow */ }
    try {
      posthogReset();
    } catch { /* swallow */ }
  }
}

type AuthState = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Initial session load with timeout — prevents infinite spinner
    // if the Supabase call hangs (e.g., slow network on simulator).
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 10000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;

      // E2E test seam: when running under Maestro/Detox, skip the login UI by
      // signing in with env credentials. Requires explicit opt-in via
      // EXPO_PUBLIC_E2E_AUTH_ENABLED — never set in production .env.
      if (
        !data.session &&
        process.env.EXPO_PUBLIC_E2E_AUTH_ENABLED === "true" &&
        process.env.EXPO_PUBLIC_E2E_EMAIL &&
        process.env.EXPO_PUBLIC_E2E_PASSWORD
      ) {
        const { data: signIn } = await supabase.auth.signInWithPassword({
          email: process.env.EXPO_PUBLIC_E2E_EMAIL,
          password: process.env.EXPO_PUBLIC_E2E_PASSWORD,
        });
        if (!cancelled) {
          clearTimeout(timeout);
          setSession(signIn.session ?? null);
          setLoading(false);
          // P1-13: also stamp identity on the E2E auto-sign-in path so
          // Maestro / Detox runs surface a consistent user id in any
          // observability noise they generate.
          syncObservabilityUser(signIn.session ?? null);
        }
        return;
      }

      clearTimeout(timeout);
      setSession(data.session);
      setLoading(false);
      // P1-13: stamp Sentry + PostHog with the user id so crashes and
      // funnels carry context from the first frame.
      syncObservabilityUser(data.session);
      // Write IANA tz into profiles so the weekly recap push fires at
      // the user's local 18:00 (T12, 2026-04-20). Fire-and-forget.
      if (data.session?.user?.id) {
        void syncProfileTimezone(supabase, data.session.user.id);
      }
    }).catch(() => {
      if (!cancelled) {
        clearTimeout(timeout);
        setLoading(false);
      }
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // P1-13: keep observability identity in sync with auth state.
      // Covers SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED.
      syncObservabilityUser(s);
      if (s?.user?.id) {
        void syncProfileTimezone(supabase, s.user.id);
      }
      // 2026-05-05 (audit Y02) — clear non-profile AsyncStorage keys
      // when the user signs out so the next sign-in (potentially as a
      // different user on the same device) starts with an empty
      // cached_user_tier, fresh push-prompt-dismissed state, fresh
      // HealthKit-written-IDs in memory, etc. Fire-and-forget — sign-
      // out must complete even if the wipe fails.
      if (event === "SIGNED_OUT") {
        void clearUserScopedAsyncStorage();
      }
    });

    // Proactive token refresh when app comes to foreground
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            // Check if token expires within 5 minutes — force refresh
            const expiresAt = data.session.expires_at ?? 0;
            const fiveMinFromNow = Math.floor(Date.now() / 1000) + 300;
            if (expiresAt < fiveMinFromNow) {
              supabase.auth.refreshSession().catch(() => {});
            }
            // Re-sync tz on foreground — the user may have travelled
            // or crossed a DST boundary since last launch.
            if (data.session.user?.id) {
              void syncProfileTimezone(supabase, data.session.user.id);
            }
          }
        });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
