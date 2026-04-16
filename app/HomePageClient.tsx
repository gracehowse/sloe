"use client";

import { Suspense, useEffect, useState } from "react";
import App from "../src/app/App.tsx";
import { AppLoadingSkeleton } from "../src/app/components/AppLoadingSkeleton.tsx";
import { supabase } from "../src/lib/supabase/browserClient.ts";
import { ProfileLoadErrorPanel, useHomeProfileGate } from "./HomeProfileGate.tsx";

function AuthedHome() {
  const { gate, errorMessage, retry } = useHomeProfileGate();

  if (gate === "loading") {
    return <AppLoadingSkeleton label="Loading your profile\u2026" />;
  }

  if (gate === "error" && errorMessage) {
    return <ProfileLoadErrorPanel message={errorMessage} onRetry={retry} />;
  }

  if (gate === "onboarding") {
    return <AppLoadingSkeleton label="Redirecting\u2026" />;
  }

  return (
    <Suspense fallback={<AppLoadingSkeleton label="Loading app\u2026" />}>
      <App />
    </Suspense>
  );
}

export function HomePageClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      // Not authed — middleware will redirect to /login,
      // but handle the edge case where middleware hasn't kicked in yet.
      if (!data.session?.user) {
        window.location.href = "/login";
        return;
      }
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        window.location.href = "/login";
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <AppLoadingSkeleton label="Starting Suppr\u2026" />;
  }

  return <AuthedHome />;
}
