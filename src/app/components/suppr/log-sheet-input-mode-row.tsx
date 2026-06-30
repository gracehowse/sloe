"use client";

/**
 * InputModeRow (web) — the row of logging-method chips (Scan / Voice / Photo /
 * Quick add) at the head of the LogSheet browse tab. Extracted from
 * `log-sheet.tsx` (ENG-1252) to keep that flagship sheet trending toward the
 * 400-line target as new surface lands here. Mirror of the mobile
 * `LogSheetInputModeRow`.
 *
 * AI methods (Voice / Photo) are Pro-gated and render a PRO badge when
 * `locked`. ENG-1252 adds an optional one-line discoverability tooltip
 * ("AI logging — available with Pro.") under the FIRST rendered + locked AI
 * chip; the host owns whether it shows via `aiMethodTooltipVisible` (gate:
 * `@/lib/today/aiMethodTooltip`). The row stays tier-agnostic — it only adds
 * the bubble to a chip it already shows as locked, and never twice.
 */

import { Camera, Mic, PencilLine, ScanBarcode, type LucideIcon } from "lucide-react";
import type { LogSheetProps } from "./log-sheet";
import { AI_METHOD_TOOLTIP_TEXT } from "@/lib/today/aiMethodTooltip";
import { cn } from "../ui/utils";

export function InputModeRow({
  barcode,
  voice,
  photo,
  aiMethodTooltipVisible = false,
  onQuickAdd,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  /** ENG-1252 — host-gated discoverability tooltip flag. */
  aiMethodTooltipVisible?: boolean;
  onQuickAdd?: () => void;
}) {
  const modes: Array<{
    key: "scan" | "voice" | "photo" | "quick";
    label: string;
    Icon: LucideIcon;
    onClick?: () => void;
    locked?: boolean;
    /** True for the AI methods (voice / photo) whose lock the tooltip explains. */
    aiMethod?: boolean;
  }> = [
    {
      key: "scan",
      label: "Scan",
      Icon: ScanBarcode,
      onClick: barcode?.onOpen,
    },
    {
      key: "voice",
      label: "Voice",
      Icon: Mic,
      onClick: voice?.onStart,
      locked: voice?.locked ?? false,
      aiMethod: true,
    },
    {
      key: "photo",
      label: "Photo",
      Icon: Camera,
      onClick: photo?.onCapture,
      locked: photo?.locked ?? false,
      aiMethod: true,
    },
    {
      key: "quick",
      label: "Quick add",
      Icon: PencilLine,
      onClick: onQuickAdd,
    },
  ];
  // ENG-1252 — anchor the tooltip under the FIRST rendered + locked AI method
  // so it never renders twice; host owns whether it shows at all.
  const tooltipKey = aiMethodTooltipVisible
    ? modes.find((m) => m.aiMethod && m.locked && m.onClick)?.key ?? null
    : null;
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
