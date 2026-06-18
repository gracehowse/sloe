"use client";

import { Cloud, Download, Shield } from "lucide-react";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";

/**
 * Supplementary trust row below the tier grid on `/pricing`.
 *
 * Pre–ENG-901 this block duplicated "Cancel anytime" messaging already
 * carried by `PaywallTrustStrip`. When `paywall_trust_inline_v1` is on
 * (default), the Figma `284:2` inline strip is the single trust surface
 * above the plan selector — hide this legacy marketing row to avoid drift.
 */
export function PricingLegacyTrustSignals() {
  if (isFeatureEnabled("paywall_trust_inline_v1")) {
    return null;
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4 text-[var(--macro-calories)]" />
        Cancel anytime
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Cloud className="h-4 w-4 text-primary" />
        Cloud sync across devices
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Download className="h-4 w-4 text-[var(--macro-fat)]" />
        Export your data anytime
      </div>
    </div>
  );
}
