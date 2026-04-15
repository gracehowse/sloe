"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import App from "../src/app/App.tsx";
import { AppLoadingSkeleton } from "../src/app/components/AppLoadingSkeleton.tsx";
import { supabase } from "../src/lib/supabase/browserClient.ts";
import { ProfileLoadErrorPanel, useHomeProfileGate } from "./HomeProfileGate.tsx";

function AuthedHome() {
  const { gate, errorMessage, retry } = useHomeProfileGate();

  if (gate === "loading") {
    return <AppLoadingSkeleton label="Loading your profile…" />;
  }

  if (gate === "error" && errorMessage) {
    return <ProfileLoadErrorPanel message={errorMessage} onRetry={retry} />;
  }

  if (gate === "onboarding") {
    return <AppLoadingSkeleton label="Redirecting…" />;
  }

  return (
    <Suspense fallback={<AppLoadingSkeleton label="Loading app…" />}>
      <App />
    </Suspense>
  );
}

export function HomePageClient({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setAuthed(Boolean(data.session?.user));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <AppLoadingSkeleton label="Starting Suppr…" />;
  }

  if (!authed) {
    return children;
  }

  return <AuthedHome />;
}
