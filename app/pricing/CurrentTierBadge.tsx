"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../utils/supabase/publicConfig.ts";

const supabase = createClient(supabasePublicUrl(), supabasePublicAnonKey());

/**
 * Client component rendered inside each pricing tier card.
 * Checks auth + profile to display "Your current plan" badge and disable upgrade buttons.
 */
export function CurrentTierBadge({ tierName }: { tierName: string }) {
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_tier")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data?.user_tier) setCurrentTier(data.user_tier as string);
    })();
  }, []);

  if (!currentTier) return null;

  const isCurrentPlan =
    currentTier.toLowerCase() === tierName.toLowerCase() ||
    (tierName === "Free" && currentTier === "free");

  if (!isCurrentPlan) return null;

  return (
    <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold mt-2">
      Your current plan
    </span>
  );
}
