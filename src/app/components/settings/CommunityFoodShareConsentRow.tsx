"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/browserClient";
import {
  readCommunityShareConsent,
  setCommunityShareConsent,
} from "@/lib/foodCorrection/communityShareConsent";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

export function CommunityFoodShareConsentRow({ userId }: { userId: string | null }) {
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const enabled = isFeatureEnabled("barcode_community_contribution");

  useEffect(() => {
    if (!userId || !enabled) {
      setLoading(false);
      return;
    }
    void readCommunityShareConsent(supabase, userId).then((value) => {
      setConsented(value.consented);
      setLoading(false);
    });
  }, [userId, enabled]);

  const onToggle = useCallback(async () => {
    if (!userId || busy) return;
    setBusy(true);
    const next = !consented;
    const result = await setCommunityShareConsent(supabase, userId, next);
    if (result.ok) setConsented(next);
    setBusy(false);
  }, [userId, busy, consented]);

  if (!enabled || !userId) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Community food database</p>
        <p className="text-xs text-muted-foreground">
          Allow optional barcode contributions after you log privately. Withdraw any time.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={consented}
        disabled={loading || busy}
        onClick={onToggle}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          consented ? "bg-primary" : "bg-muted",
          loading || busy ? "opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            consented ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
