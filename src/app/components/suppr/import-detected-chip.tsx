"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  FileSpreadsheet,
  FileText,
  Layers,
  Link2,
  Play,
  type LucideIcon,
} from "lucide-react";
import { classifyImport, type ImportKind } from "../../../lib/recipe-import/classifyImport";
import { importDetectSubline } from "../../../lib/recipe-import/importInputSamples";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * ImportDetectedChip (ENG-1225 #3) — the unified Import wedge's live "Detected:
 * {label}" cue. It runs the shared `classifyImport` over the user's pasted text
 * and shows what we'll do with it (a TikTok video, a recipe link, an MFP CSV, a
 * meal plan, recipe text) before they commit — the trust moment that lets ONE
 * paste field accept anything. Renders nothing for empty input. Mobile mirror:
 * `apps/mobile/components/import/ImportDetectedChip.tsx`.
 */
function iconFor(kind: ImportKind): LucideIcon {
  if (kind === "social") return Play;
  if (kind === "collection") return Layers;
  if (kind === "csv") return FileSpreadsheet;
  if (kind === "plan-text") return CalendarDays;
  if (kind === "recipe-text") return FileText;
  return Link2;
}

export function ImportDetectedChip({
  input,
  className,
}: {
  input: string;
  className?: string;
}) {
  const v3 = isFeatureEnabled("import_input_v3_polish");
  const result = React.useMemo(() => classifyImport(input), [input]);
  if (result.kind === "empty") return null;
  const Icon = iconFor(result.kind);

  if (v3) {
    const subline = importDetectSubline(result.kind);
    return (
      <div
        data-testid="import-detected-chip"
        data-variant="row"
        data-kind={result.kind}
        className={[
          "flex items-center gap-3 rounded-xl bg-primary-soft px-4 py-3",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary-solid">
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Detected: {result.label}
          </span>
          {subline ? (
            <span className="block text-xs text-muted-foreground">{subline}</span>
          ) : null}
        </span>
        <Check size={17} className="shrink-0 text-success" aria-hidden />
      </div>
    );
  }

  return (
    <span
      data-testid="import-detected-chip"
      data-variant="pill"
      data-kind={result.kind}
      className={[
        "inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-[13px] font-medium text-primary-solid",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon size={14} aria-hidden />
      <span>
        <span className="opacity-80">Detected:</span> {result.label}
      </span>
    </span>
  );
}

export default ImportDetectedChip;
