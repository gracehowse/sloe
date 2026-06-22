"use client";

import * as React from "react";
import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Link2,
  Play,
  type LucideIcon,
} from "lucide-react";
import { classifyImport, type ImportKind } from "../../../lib/recipe-import/classifyImport";

/**
 * ImportDetectedChip (ENG-1225 #3) — the unified Import wedge's live "Detected:
 * {label}" cue. It runs the shared `classifyImport` over the user's pasted text
 * and shows what we'll do with it (a TikTok video, a recipe link, an MFP CSV, a
 * meal plan, recipe text) before they commit — the trust moment that lets ONE
 * paste field accept anything. Renders nothing for empty input. Mobile mirror:
 * `apps/mobile/components/import/ImportDetectedChip.tsx`.
 */
// Generic glyphs (lucide dropped brand icons) — the label carries the platform.
function iconFor(kind: ImportKind): LucideIcon {
  if (kind === "social") return Play; // reel / video
  if (kind === "csv") return FileSpreadsheet;
  if (kind === "plan-text") return CalendarDays;
  if (kind === "recipe-text") return FileText;
  return Link2; // recipe-url
}

export function ImportDetectedChip({
  input,
  className,
}: {
  input: string;
  className?: string;
}) {
  const result = React.useMemo(() => classifyImport(input), [input]);
  if (result.kind === "empty") return null;
  const Icon = iconFor(result.kind);

  return (
    <span
      data-testid="import-detected-chip"
      data-kind={result.kind}
      className={[
        "inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[13px] font-medium text-primary-solid",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon size={14} aria-hidden />
      <span>
        <span className="opacity-70">Detected:</span> {result.label}
      </span>
    </span>
  );
}

export default ImportDetectedChip;
