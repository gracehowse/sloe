"use client";

import { useEffect, useState } from "react";
import type { PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import {
  buildPersonalisedPlanPaywallSummary,
  shouldLeadPaywallWithPersonalisedPlan,
  type PersonalisedPlanPaywallSummary,
} from "../../src/lib/paywall/personalisedPlanSummary.ts";
import { PricingPersonalisedPlanCard } from "./PricingPersonalisedPlanCard.tsx";

// ENG-1470: was `createClient(...)` from `@supabase/supabase-js` (default
// localStorage session storage) — invisible to the real app's cookie-backed
// session (`createBrowserClient` from `@supabase/ssr`, same client
// `AuthSessionContext.tsx` uses), so this component silently never detected
// a real logged-in user's session. Now imports the shared cookie-backed
// client instead of instantiating its own.

/**
 * ENG-966 — load onboarding-derived targets and lead the web paywall
 * with the user's real plan when eligible.
 */
export function PricingPaywallHonesty({ paywallFrom }: { paywallFrom: PaywallViewedFrom }) {
  const [summary, setSummary] = useState<PersonalisedPlanPaywallSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const { data: row } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, goal, target_calories_source")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled || !row) return;

      const targetCalories = (row as { target_calories?: number | null }).target_calories;
      const targetCaloriesSource = (row as { target_calories_source?: string | null })
        .target_calories_source;

      if (
        !shouldLeadPaywallWithPersonalisedPlan({
          targetCalories,
          targetCaloriesSource,
          paywallFrom,
        })
      ) {
        return;
      }

      setSummary(
        buildPersonalisedPlanPaywallSummary({
          targetCalories: targetCalories!,
          targetProtein: (row as { target_protein?: number | null }).target_protein,
          goal: (row as { goal?: string | null }).goal,
        }),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [paywallFrom]);

  if (!summary) return null;

  return (
    <div className="mb-6">
      <div className="mb-4">
        <h2 className="text-2xl sm:text-3xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand">
          {summary.heroTitle}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">{summary.heroSubtitle}</p>
      </div>
      <PricingPersonalisedPlanCard summary={summary} />
    </div>
  );
}
