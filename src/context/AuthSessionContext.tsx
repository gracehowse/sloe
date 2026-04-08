import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase/browserClient.ts";

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
      setAuthedUserId(data.session?.user.id ?? null);
      setAuthEmail(data.session?.user.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthedUserId(session?.user.id ?? null);
      setAuthEmail(session?.user.email ?? null);
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
