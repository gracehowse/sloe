import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncProfileTimezone } from "../../../src/lib/profile/tzSync";

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
        }
        return;
      }

      clearTimeout(timeout);
      setSession(data.session);
      setLoading(false);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        void syncProfileTimezone(supabase, s.user.id);
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
