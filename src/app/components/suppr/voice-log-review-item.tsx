"use client";

/**
 * VoiceLogReviewItem — the web twin of the mobile
 * `apps/mobile/components/AiLogReviewItem.tsx`. One editable review row for a
 * single AI-parsed voice-log item: name, per-macro fields, the granular
 * High/Med/Low confidence dot, the "AI estimate" badge, and the shared
 * Verified/Estimated confidence chip (`redesign_search_results` collapsed
 * permanently-on, ENG-1651).
 *
 * Extracted from `voice-log-dialog.tsx` (ENG-1429) so the dialog stays a thin
 * composition shell and the review row mirrors the mobile shared component
 * one-to-one. Pure presentational + per-row handlers passed in from the parent;
 * no analytics, no I/O — the parent commits.
 *
 * Trust posture (CLAUDE.md): the confidence chip is ALWAYS "estimated". An
 * AI-parsed item is an estimate by definition and can never read "Verified".
 * The granular High/Med/Low pill below stays as the real per-item model signal.
 * This mirrors the mobile row, where the chip is hardcoded `tier="estimated"`.
 */

import { ConfidenceDot } from "./confidence-dot";
import { Badge } from "./badge";
import { Input } from "../ui/input";
import { Icons } from "../ui/icons";
import { SearchResultConfidenceChip } from "../ui/search-result-confidence-chip";
import {
  classifyConfidence,
  isLowConfidence,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";

const MACRO_KEYS = ["calories", "protein", "carbs", "fat"] as const;

export type VoiceLogReviewItemProps = {
  item: AiLoggedItem;
  index: number;
  onChange: (patch: Partial<AiLoggedItem>) => void;
  onRemove: () => void;
};

export function VoiceLogReviewItem({
  item,
  index,
  onChange,
  onRemove,
}: VoiceLogReviewItemProps) {
  const level = classifyConfidence(item.confidence);
  const low = isLowConfidence(item);
  // Search-results redesign (2026-05-31, `redesign_search_results` collapsed
  // permanently-on ENG-1651): adopt the same Verified/Estimated chip language
  // used by the food-search + barcode result surfaces, so a voice-logged
  // result reads as the same product. AI-parsed items are ALWAYS an estimate
  // — never "Verified" (CLAUDE.md trust posture). Mirrors mobile
  // AiLogReviewItem.

  return (
    <div
      className={`rounded-lg border p-2.5 text-sm ${
        low ? "border-amber-400/50 bg-amber-400/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label={`Item ${index + 1} name`}
            className="h-8 text-sm font-medium"
          />
          {item.unit && (
            <p className="text-[11px] text-muted-foreground mt-1">{item.unit}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <SearchResultConfidenceChip tier="estimated" testId="voice-confidence-chip" />
          <ConfidenceDot level={level} showLabel />
          <Badge
            variant="ai"
            ariaLabel="AI estimated nutrition"
            icon={<Icons.sparkles />}
          >
            AI estimate
          </Badge>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label={`Remove ${item.name}`}
        >
          <Icons.close className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {MACRO_KEYS.map((key) => (
          <label key={key} className="grid gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {key === "calories" ? "kcal" : `${key.charAt(0).toUpperCase()}${key.slice(1)} (g)`}
            </span>
            <Input
              type="number"
              min={0}
              step={1}
              value={item[key]}
              onChange={(e) => {
                const n = Math.max(0, Number(e.target.value));
                onChange({ [key]: Number.isFinite(n) ? n : 0 });
              }}
              className="h-7 text-xs"
              aria-label={`${item.name} ${key}`}
            />
          </label>
        ))}
      </div>
      {low && (
        <p role="alert" className="mt-1.5 text-[11px] text-amber-700">
          Low confidence — please verify the portion and macros before logging.
        </p>
      )}
    </div>
  );
}

export default VoiceLogReviewItem;
