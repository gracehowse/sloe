"use client";

import { useState } from "react";
import { ChevronDown, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../src/context/AppDataContext.tsx";
import { PROMO_CODE_PLACEHOLDER } from "../../src/lib/copy/promo.ts";

/**
 * Promo-code redemption surface for `/pricing` (D9 Option 3, task W1).
 *
 * Replaces the footnote that used to point users back to Settings. The
 * block starts collapsed so the FAQ area stays visually clean; tapping
 * the trigger reveals the input + Apply button. Calls the shared
 * `redeemPromoCode` from `AppDataContext`, which is the same code path
 * used by the Settings promo card today (Settings copy will be removed
 * in task S2 once this surface is live).
 *
 * Error-message table is kept character-identical to the Settings
 * implementation (`src/app/components/Settings.tsx`) so the two
 * surfaces cannot drift while both exist during the S2 handover.
 */
export function PromoCodeBlock() {
  const { redeemPromoCode } = useAppData();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    setSubmitting(true);
    try {
      const result = await redeemPromoCode(code);
      if (result.ok) {
        if (result.alreadyRedeemed) {
          toast.success(
            `Plan confirmed: ${result.tier} (this code was already applied to your account).`,
          );
        } else {
          toast.success(`Plan updated: ${result.tier}`);
        }
        setCode("");
      } else {
        // Keep in lockstep with `Settings.tsx` — every string here must
        // exist on the Settings surface too until S2 removes it. The
        // `not_authenticated` branch matches OD3: `/pricing` is public,
        // so anon visitors see "Sign in to redeem".
        const messages: Record<string, string> = {
          not_authenticated: "Sign in to redeem a code.",
          invalid_code: "Enter a promo code.",
          invalid_or_expired: "That code is not valid or has expired.",
          already_redeemed: "You have already redeemed this code.",
          rpc_error: result.message ?? "Could not redeem code.",
          not_deployed: "Promo codes aren't available in this build yet.",
        };
        toast.error(messages[result.error] ?? "Could not redeem code.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-12 max-w-2xl mx-auto">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="promo-code-panel"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mx-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Ticket className="w-4 h-4" aria-hidden="true" />
        Have a promo code?
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div
          id="promo-code-panel"
          className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <p className="text-sm text-muted-foreground mb-4">
            Redeem a code to upgrade your plan (one use per account per code).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={PROMO_CODE_PLACEHOLDER}
              autoComplete="off"
              aria-label="Promo code"
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              disabled={submitting || !code.trim()}
              onClick={handleApply}
              className="px-6 py-2.5 rounded-xl bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
