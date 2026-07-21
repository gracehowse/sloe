/**
 * Affordance on the Import recipe surface → /cookbook-import (ENG-1582).
 * Self-gates on `cookbook_import_enabled` (null when off).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { Icons } from "../ui/icons.ts";
import { SupprButton } from "../suppr/suppr-button.tsx";

export function ImportCookbookPdfEntry() {
  const router = useRouter();
  const [enabled] = useState(() => isFeatureEnabled("cookbook_import_enabled"));
  if (!enabled) return null;
  return (
    <div className="mt-4 rounded-[var(--radius-card-lg)] border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-[family-name:var(--font-headline)] text-[15px] text-foreground-brand">
          Import cookbook (PDF)
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          Digitise a whole book — review every recipe before saving to Library.
        </p>
      </div>
      <SupprButton
        variant="ghost"
        type="button"
        data-testid="import-cookbook-entry"
        onClick={() => router.push("/cookbook-import")}
      >
        <Icons.navPlan className="w-4 h-4" aria-hidden />
        From a PDF
      </SupprButton>
    </div>
  );
}
