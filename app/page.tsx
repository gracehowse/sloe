"use client";

import App from "../src/app/App.tsx";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase/browserClient.ts";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkedProfile, setCheckedProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setAuthed(Boolean(data.session?.user));
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
      setUserId(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setCheckedProfile(false);
      return;
    }
    if (!userId) {
      // Avoid getting stuck if auth state is inconsistent.
      const t = setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    (async () => {
      // Prefer Supabase profile; fall back to local profile.
      const uid = userId;
      if (!uid || cancelled) {
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, age, height_cm, weight_kg, sex, activity_level, goal")
        .eq("id", uid)
        .maybeSingle();

      // If Supabase profile table isn't reachable yet, fall back to local profile
      // so users aren't stuck on a loading screen.
      if (error) {
        // If profiles is temporarily unavailable, send user to onboarding to unblock.
        if (typeof window !== "undefined") {
          window.location.href = "/onboarding";
        }
        return;
      }

      const dbComplete = Boolean(
        profile?.target_calories &&
          profile?.target_protein &&
          profile?.target_carbs &&
          profile?.target_fat &&
          profile?.age &&
          profile?.height_cm &&
          profile?.weight_kg &&
          profile?.sex &&
          profile?.activity_level &&
          profile?.goal,
      );

      if (!dbComplete && typeof window !== "undefined") {
        window.location.href = "/onboarding";
        return;
      }

      if (!cancelled) {
        setCheckedProfile(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, userId]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-600 dark:text-slate-300">
        Loading…
      </div>
    );
  }

  if (!authed) {
    // lightweight gate for now (Phase 0). We'll add public marketing pages later.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (!checkedProfile) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-600 dark:text-slate-300">
        Loading your profile…
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-slate-600 dark:text-slate-300">
          Loading…
        </div>
      }
    >
      <App />
    </Suspense>
  );
}

