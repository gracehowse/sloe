"use client";

/**
 * LogSheetBarcodeFreePromise (web) — the loud "Scan a barcode" CTA + the
 * "free forever" reassurance line under the LogSheet input methods. Extracted
 * from `log-sheet.tsx` (ENG-1303) so that flagship sheet stays under its
 * line-count pin while the v3 method-grid wiring lands. Presentation-only;
 * the host owns whether it shows (`showBarcodeFreePromise && barcode?.onOpen`).
 * Mirror of the mobile inline block in `LogSheet.tsx`.
 */

import { ScanBarcode } from "lucide-react";
import {
  BARCODE_FREE_FOREVER_DETAIL,
  BARCODE_FREE_FOREVER_HEADLINE,
  BARCODE_LOUD_CTA_LABEL,
} from "../../../lib/nutrition/barcodeFreePromise.ts";

export function LogSheetBarcodeFreePromise({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mx-3 mt-2 flex w-[calc(100%-1.5rem)] flex-col gap-1.5">
      <button
        type="button"
        data-testid="log-sheet-loud-barcode-cta"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent-primary-soft-strong)] bg-primary/10 px-4 py-3 text-[15px] font-semibold text-primary-solid hover:bg-primary/15 transition-colors"
      >
        <ScanBarcode width={18} height={18} className="shrink-0" aria-hidden />
        <span>{BARCODE_LOUD_CTA_LABEL}</span>
      </button>
      <p
        data-testid="log-sheet-barcode-free-promise"
        className="text-center text-[11px] text-foreground-secondary leading-snug"
      >
        {BARCODE_FREE_FOREVER_HEADLINE} {BARCODE_FREE_FOREVER_DETAIL}
      </p>
    </div>
  );
}
