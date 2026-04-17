import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        clearTimeout(timeout);
        setSession(data.session);
        setLoading(false);
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
