"use client";

/**
 * ImplausibleMacrosNotice (ENG-1420) — inline warning + "save anyway"
 * acknowledgement shown inside the Create/Edit custom-food dialog when the
 * server rejects the macros as implausible (HTTP 422). Presentational only:
 * the parent owns the block/acknowledge state and re-submits with
 * `acknowledgeImplausible: true` when ticked. Mirrors the mobile
 * `apps/mobile/components/ImplausibleMacrosNotice.tsx`.
 */

/** Identical copy on web + mobile (parity-pinned). Mirrors the message
 *  `/api/custom-foods` returns and the barcode-contribution wording. */
export const IMPLAUSIBLE_MACROS_COPY =
  "Macro values don't pass a basic sanity check. Please double-check the numbers.";

export type ImplausibleMacrosNoticeProps = {
  /** Whether the server has flagged the current macros (dialog stays open). */
  open: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
};

export function ImplausibleMacrosNotice({
  open,
  acknowledged,
  onAcknowledgedChange,
}: ImplausibleMacrosNoticeProps) {
  if (!open) return null;
  return (
    <div
      className="grid gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
      role="alert"
      aria-live="polite"
      data-testid="custom-food-implausible-warning"
    >
      <p className="text-xs leading-relaxed text-warning-solid">{IMPLAUSIBLE_MACROS_COPY}</p>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)}
          data-testid="custom-food-implausible-ack"
          className="h-4 w-4"
        />
        These numbers are correct — save anyway
      </label>
    </div>
  );
}

export default ImplausibleMacrosNotice;
