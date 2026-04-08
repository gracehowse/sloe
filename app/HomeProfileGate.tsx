"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase/browserClient.ts";
import {
  isMissingProfilesTableError,
  isProfileRowComplete,
  isTransientProfileFetchError,
  type ProfileGateRow,
} from "../src/lib/client/homeProfileGate.ts";
import { AppLoadingSkeleton } from "../src/app/components/AppLoadingSkeleton.tsx";
import { Button } from "../src/app/components/ui/button.tsx";

type GateState = "loading" | "ready" | "onboarding" | "error";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useHomeProfileGate(): {
  gate: GateState;
  errorMessage: string | null;
  retry: () => void;
} {
  const [gate, setGate] = useState<GateState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    setGate("loading");
    setErrorMessage(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }

    const uid = session.user.id;
    const maxAttempts = 3;

    for (let i = 0; i < maxAttempts; i++) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, age, height_cm, weight_kg, sex, activity_level, goal",
        )
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        const msg = error.message ?? "";
        if (isMissingProfilesTableError(msg)) {
          if (typeof window !== "undefined") {
            window.location.href = "/onboarding";
          }
          setGate("onboarding");
          return;
        }
        if (isTransientProfileFetchError(msg) && i < maxAttempts - 1) {
          await sleep(400 * (i + 1));
          continue;
        }
        setErrorMessage(msg || "Could not load your profile.");
        setGate("error");
        return;
      }

      const row = profile as ProfileGateRow;
      if (!isProfileRowComplete(row)) {
        if (typeof window !== "undefined") {
          window.location.href = "/onboarding";
        }
        setGate("onboarding");
        return;
      }

      setGate("ready");
      return;
    }

    setErrorMessage("Could not reach the server. Check your connection and try again.");
    setGate("error");
  }, []);

  useEffect(() => {
    void run();
  }, [run, attempt]);

  const retry = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);

  return { gate, errorMessage, retry };
}

export function ProfileLoadErrorPanel(props: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">We couldn&apos;t load your profile</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">{props.message}</p>
      <Button type="button" onClick={props.onRetry}>
        Try again
      </Button>
      <p className="text-xs text-slate-500">
        If this keeps happening, confirm Supabase is up and <code className="text-xs">profiles</code> RLS allows your
        user.
      </p>
    </div>
  );
}
