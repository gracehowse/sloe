import { useEffect, useState } from "react";

import { AppleHealthCard, type AppleHealthCardStatus } from "@/components/AppleHealthCard";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { isHealthSyncAvailable } from "@/lib/healthSync";
import { supabase } from "@/lib/supabase";

/**
 * AppleHealthCardHost — Progress-tab wrapper for the Apple Health card.
 *
 * Lives on the Progress screen because the four metrics live in
 * `profiles.{steps_by_day, activity_burn_by_day, basal_burn_by_day,
 * weight_kg}` and we don't want to plumb them through the mega-host's
 * render. This host reads only what the card needs on focus and maps
 * `syncHealthData` crash/denial state to the card's status prop.
 *
 * Extracted verbatim from `app/(tabs)/progress.tsx` (ENG-1525 — line-budget
 * offset for the hierarchy-v1 host wiring); behaviour unchanged.
 */
export function AppleHealthCardHost({
  userId,
  stepsToday,
  latestWeightKg,
  useImperial,
}: {
  userId: string;
  stepsToday: number | null;
  latestWeightKg: number | null;
  useImperial: boolean;
}) {
  const [status, setStatus] = useState<AppleHealthCardStatus>("loading");
  const [active, setActive] = useState<number | null>(null);
  const [resting, setResting] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const todayKey = dateKeyFromDate(new Date()); // ENG-1540: local day key — burn maps are local-keyed (healthSync); UTC misses today after ~5pm local in the Americas
    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("activity_burn_by_day, basal_burn_by_day")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
        const act = (profile?.activity_burn_by_day ?? {}) as Record<string, number>;
        const bas = (profile?.basal_burn_by_day ?? {}) as Record<string, number>;
        const a = typeof act[todayKey] === "number" ? act[todayKey] : null;
        const r = typeof bas[todayKey] === "number" ? bas[todayKey] : null;
        setActive(a);
        setResting(r);
        // Denial heuristic: HealthKit is available but none of the
        // four metrics came back. The design brief specifies a
        // dedicated denied footer in that case.
        if (!isHealthSyncAvailable() || (stepsToday == null && a == null && r == null && latestWeightKg == null)) {
          setStatus(!isHealthSyncAvailable() ? "denied" : "ready");
        } else {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };

  }, [userId, reloadKey, stepsToday, latestWeightKg]);

  return (
    <AppleHealthCard
      status={status}
      steps={stepsToday}
      activeEnergyKcal={active}
      restingBurnKcal={resting}
      weightKg={latestWeightKg}
      useImperial={useImperial}
      onRetry={() => setReloadKey((k) => k + 1)}
    />
  );
}
