"use client";

import * as React from "react";

import { isFeatureEnabled } from "@/lib/analytics/track";

/**
 * LogSheet loading skeleton — the 4-row shimmer shown while Recent / Saved /
 * Library results resolve. Extracted from `log-sheet.tsx` (ENG-1643,
 * screen-budget ratchet offset); behaviour is byte-identical. ENG-1611: text
 * rows load as text (no thumb) under the flag. Mirror of mobile
 * `LogSheetSkeletonList.tsx`.
 */
export function SkeletonList() {
  const textRows = isFeatureEnabled("ingredient_text_rows_v1");
  return (
    <div role="status" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center py-2">
          {textRows ? null : <div className="size-9 rounded-md bg-muted" aria-hidden />}
          <div className={textRows ? "flex-1 space-y-1.5" : "ml-2 flex-1 space-y-1.5"}>
            <div className="h-2.5 w-2/3 rounded bg-muted" aria-hidden />
            <div className="h-2 w-1/3 rounded bg-muted" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonList;
