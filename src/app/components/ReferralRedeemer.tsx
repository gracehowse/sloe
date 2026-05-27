"use client";

/**
 * ENG-5 — ReferralRedeemer
 *
 * Side-effect-only component. Mounted inside App.tsx. When:
 *   - The user is authenticated (userId is non-null), AND
 *   - A `suppr_ref` cookie exists (set by /i/[code] landing page OR
 *     passed through /signup?ref=<code>)
 *
 * …it calls POST /api/referral/redeem exactly once, fires the
 * `referral.install_attributed` + (on success) event, and clears the
 * cookie so it never re-fires.
 *
 * The component renders nothing. It lives in the component tree so
 * React can manage its lifecycle with the auth state.
 */

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

function readReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)suppr_ref=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function clearReferralCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "suppr_ref=; path=/; max-age=0; SameSite=Lax";
}

type Props = { userId: string | null };

export function ReferralRedeemer({ userId }: Props) {
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!userId || attemptedRef.current) return;

    const code = readReferralCode();
    if (!code) return;

    attemptedRef.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/referral/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });
        const data = (await res.json()) as { ok: boolean; reason?: string; referrerId?: string };

        if (data.ok) {
          track(AnalyticsEvents.referral_install_attributed, {
            referrerId: data.referrerId,
            refereeId: userId,
            code,
          });
          clearReferralCookie();
        } else if (
          data.reason === "already_redeemed" ||
          data.reason === "code_not_found" ||
          data.reason === "self_referral" ||
          data.reason === "code_flagged"
        ) {
          // Definitive failure — clear cookie so we don't re-attempt.
          clearReferralCookie();
        }
        // On transient errors (5xx, network) we leave the cookie so
        // the next page load retries automatically.
      } catch {
        // Network failure — leave cookie for next page load.
        attemptedRef.current = false;
      }
    })();
  }, [userId]);

  return null;
}
