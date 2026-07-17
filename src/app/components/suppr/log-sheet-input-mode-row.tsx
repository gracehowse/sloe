"use client";

/**
 * InputModeRow (web) — the row of logging-method affordances at the head of
 * the LogSheet browse tab. Extracted from `log-sheet.tsx` (ENG-1252) to keep
 * that flagship sheet trending toward the 400-line target as new surface lands
 * here. Mirror of the mobile `LogSheetInputModeRow`.
 *
 * Two renders, gated on `sloe_v3_log` (ENG-1303, default-ON):
 *   - FLAG ON  → the v3 method-grid TILE grammar: equal-width rounded tiles on
 *     the secondary surface (Photo / Voice / Describe / Quick add), a
 *     frost lock badge in place of the "PRO" text pill on locked AI methods.
 *   - FLAG OFF → the legacy circular input chips (Voice / Photo / Quick add)
 *     with the "PRO" text pill — the kill-switch path, byte-for-byte
 *     the pre-ENG-1303 render.
 *
 * ENG-1532 (`component_grammar_dedup`, default-ON) — one barcode entry point:
 * the flag drops the Scan tile/chip from BOTH renders so the loud
 * "Scan barcode" CTA (`log-sheet-loud-barcode-cta`) is the single scanner
 * entry. OFF = today's render with the Scan tile leading each set,
 * byte-intact. Keep in sync with the mobile `LogSheetInputModeRow.tsx`.
 *
 * AI methods (Voice / Photo) are Pro-gated and render a lock badge (or the
 * legacy PRO pill) when `locked`. ENG-1252 adds an optional one-line
 * discoverability tooltip ("AI logging — available with Pro.") under the FIRST
 * rendered + locked AI method; the host owns whether it shows via
 * `aiMethodTooltipVisible` (gate: `@/lib/today/aiMethodTooltip`). The row stays
 * tier-agnostic — it only adds the bubble to a method it already shows as
 * locked, and never twice. Describe is a first-class method that expands the
 * inline describe flow via the host-owned `onDescribe` callback (the host
 * paywalls it when locked, exactly as it does for the collapsed describe entry).
 */

import { Camera, Lock, Mic, PencilLine, ScanBarcode, type LucideIcon } from "lucide-react";
import type { LogSheetProps } from "./log-sheet";
import { AI_METHOD_TOOLTIP_TEXT } from "@/lib/today/aiMethodTooltip";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { cn } from "../ui/utils";

type Mode = {
  key: "scan" | "photo" | "voice" | "describe" | "quick";
  label: string;
  Icon: LucideIcon;
  onClick?: () => void;
  locked?: boolean;
  /** True for the AI methods (voice / photo) whose lock the tooltip explains. */
  aiMethod?: boolean;
};

export function InputModeRow({
  barcode,
  voice,
  photo,
  describe,
  aiMethodTooltipVisible = false,
  onQuickAdd,
  onDescribe,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  /** ENG-1303 — Describe as a first-class method tile. Present only when the
   *  host wires the inline describe flow; `locked` mirrors `describe.locked`. */
  describe?: { locked?: boolean };
  /** ENG-1252 — host-gated discoverability tooltip flag. */
  aiMethodTooltipVisible?: boolean;
  onQuickAdd?: () => void;
  /** ENG-1303 — host expands (or paywalls) the inline describe flow. */
  onDescribe?: () => void;
}) {
  const v3 = isFeatureEnabled("sloe_v3_log");
  // ENG-1532 — one barcode entry point (`component_grammar_dedup`): ON drops
  // the Scan tile/chip (the loud CTA is the single scanner entry); OFF renders
  // today's sets with Scan leading, byte-intact. Keep in sync with mobile.
  const dedup = isFeatureEnabled("component_grammar_dedup");

  // Order differs by render: the v3 grid follows the prototype LogHub
  // method-grid (Scan / Photo / Voice / Describe / Quick add); the legacy
  // chips keep their historical Scan / Voice / Photo / Quick add order so the
  // flag-off path is byte-for-byte the pre-ENG-1303 render.
  const scan: Mode = { key: "scan", label: "Scan", Icon: ScanBarcode, onClick: barcode?.onOpen };
  const voiceMode: Mode = {
    key: "voice",
    label: "Voice",
    Icon: Mic,
    onClick: voice?.onStart,
    locked: voice?.locked ?? false,
    aiMethod: true,
  };
  const photoMode: Mode = {
    key: "photo",
    label: "Photo",
    Icon: Camera,
    onClick: photo?.onCapture,
    locked: photo?.locked ?? false,
    aiMethod: true,
  };
  const describeMode: Mode = {
    key: "describe",
    label: "Describe",
    Icon: PencilLine,
    onClick: describe ? onDescribe : undefined,
    locked: describe?.locked ?? false,
  };
  const quick: Mode = { key: "quick", label: "Quick add", Icon: PencilLine, onClick: onQuickAdd };

  const modes: Mode[] = v3
    ? dedup
      ? [photoMode, voiceMode, describeMode, quick]
      : [scan, photoMode, voiceMode, describeMode, quick]
    : dedup
      ? [voiceMode, photoMode, quick]
      : [scan, voiceMode, photoMode, quick];

  // ENG-1252 — anchor the tooltip under the FIRST rendered + locked AI method
  // so it never renders twice; host owns whether it shows at all.
  const tooltipKey = aiMethodTooltipVisible
    ? modes.find((m) => m.aiMethod && m.locked && m.onClick)?.key ?? null
    : null;

  if (v3) {
    return (
      <div
        className="mt-5 flex gap-2"
        data-testid="log-sheet-input-mode-row"
        data-variant="v3-grid"
      >
        {modes.map(({ key, label, Icon, onClick, locked }) =>
          onClick ? (
            <div key={key} className="flex flex-1 flex-col items-center gap-1">
              <button
                type="button"
                aria-label={locked ? `${label} (Pro)` : label}
                onClick={onClick}
                data-testid={`log-sheet-method-${key}`}
                className={cn(
                  "relative flex w-full flex-col items-center gap-2 rounded-[12px] bg-secondary px-1 py-3 text-primary-solid",
                  "transition-colors hover:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
              >
                <Icon width={22} height={22} aria-hidden />
                <span className="text-[11px] font-semibold text-foreground">{label}</span>
                {locked ? (
                  <span
                    data-testid={`log-sheet-method-lock-${key}`}
                    className="absolute right-2 top-2 grid size-[18px] place-items-center rounded-full bg-muted text-primary-solid"
                  >
                    <Lock width={11} height={11} aria-hidden />
                  </span>
                ) : null}
              </button>
              {key === tooltipKey ? (
                <span
                  data-testid="log-sheet-ai-method-tooltip"
                  className="text-center text-[11px] font-medium leading-tight text-primary-solid"
                >
                  {AI_METHOD_TOOLTIP_TEXT}
                </span>
              ) : null}
            </div>
          ) : null,
        )}
      </div>
    );
  }

  // Kill switch (flag OFF) — the legacy circular chips, byte-for-byte.
  return (
    <div
      className="mt-5 flex justify-between px-1"
      data-testid="log-sheet-input-mode-row"
    >
      {modes.map(({ key, label, Icon, onClick, locked }) =>
        onClick ? (
          <div key={key} className="flex flex-col items-center gap-2">
            <button
              type="button"
              aria-label={locked ? `${label} (Pro)` : label}
              onClick={onClick}
              className={cn(
                "relative grid size-14 place-items-center rounded-full border border-border bg-card text-primary-solid",
                "hover:bg-card/80 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <Icon width={22} height={22} aria-hidden />
              {locked ? (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold leading-none text-primary-foreground">
                  PRO
                </span>
              ) : null}
            </button>
            <span className="text-[11px] text-muted-foreground">{label}</span>
            {key === tooltipKey ? (
              <span
                data-testid="log-sheet-ai-method-tooltip"
                className="text-center text-[11px] font-medium leading-tight text-primary-solid"
              >
                {AI_METHOD_TOOLTIP_TEXT}
              </span>
            ) : null}
          </div>
        ) : null,
      )}
    </div>
  );
}
