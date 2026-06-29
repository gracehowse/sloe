/**
 * ENG-972 — inline natural-language describe flow inside the web Log sheet.
 */
import * as React from "react";
import { Lock, PencilLine } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icons } from "../ui/icons";
import { Badge } from "./badge";
import { ConfidenceDot } from "./confidence-dot";
import {
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";
import type { ParseMealDescriptionResult } from "../../../lib/nutrition/parseMealDescription";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { cn } from "../ui/utils";

type Stage = "input" | "parsing" | "review" | "error";

export type LogSheetDescribeFlowProps = {
  sheetOpen: boolean;
  locked?: boolean;
  seedText?: string | null;
  onSeedConsumed?: () => void;
  onParse: (text: string) => Promise<ParseMealDescriptionResult>;
  onCommit: (items: AiLoggedItem[]) => void;
  onPaywall?: () => void;
  onReviewActiveChange?: (active: boolean) => void;
  inputHidden?: boolean;
};

export function LogSheetDescribeFlow({
  sheetOpen,
  locked = false,
  seedText,
  onSeedConsumed,
  onParse,
  onCommit,
  onPaywall,
  onReviewActiveChange,
  inputHidden = false,
}: LogSheetDescribeFlowProps) {
  const [stage, setStage] = React.useState<Stage>("input");
  const [text, setText] = React.useState("");
  const [items, setItems] = React.useState<AiLoggedItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sheetOpen) {
      setStage("input");
      setText("");
      setItems([]);
      setError(null);
    }
  }, [sheetOpen]);

  React.useEffect(() => {
    onReviewActiveChange?.(stage === "review");
  }, [stage, onReviewActiveChange]);

  React.useEffect(() => {
    if (!seedText?.trim()) return;
    setText(seedText.trim());
    onSeedConsumed?.();
  }, [seedText, onSeedConsumed]);

  const runParse = React.useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (locked) {
        onPaywall?.();
        return;
      }
      setStage("parsing");
      setError(null);
      track(AnalyticsEvents.log_sheet_nl_text_started, { platform: "web" });
      const result = await onParse(trimmed);
      if (!result.ok) {
        if (result.upgradeRequired) {
          onPaywall?.();
          setStage("input");
          return;
        }
        setError(result.error);
        setStage("error");
        return;
      }
      setItems(result.items);
      setStage("review");
    },
    [locked, onParse, onPaywall],
  );

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogAll = () => {
    if (items.length === 0) return;
    onCommit(items);
    track(AnalyticsEvents.log_sheet_nl_text_committed, {
      platform: "web",
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    });
    setStage("input");
    setText("");
    setItems([]);
  };

  if (stage === "review") {
    const totals = aggregateTotals(items);
    const low = items.some((i) => isLowConfidence(i));
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2" data-testid="log-sheet-describe-review">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Review parsed items — edit or remove before logging.
        </p>
        <div className="mb-2 rounded-[var(--radius-card-lg)] border border-border bg-card p-3 text-sm">
          <div className="font-medium">{items.length} item{items.length === 1 ? "" : "s"}</div>
          <div className="text-muted-foreground">
            ~{Math.round(totals.calories)} kcal · {Math.round(totals.protein)}p {Math.round(totals.carbs)}c{" "}
            {Math.round(totals.fat)}f
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
          {items.map((item, i) => {
            const level = classifyConfidence(item.confidence);
            const itemLow = isLowConfidence(item);
            return (
              <div
                key={`${item.name}-${i}`}
                className={cn(
                  "rounded-lg border p-2.5 text-sm",
                  itemLow ? "border-amber-400/50 bg-amber-400/5" : "border-border bg-card",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      aria-label={`Item ${i + 1} name`}
                      className="h-8 text-sm font-medium"
                    />
                    {item.unit ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.unit}</p>
                    ) : null}
                  </div>
                  <ConfidenceDot level={level} showLabel />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Icons.close className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
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
                          updateItem(i, { [key]: Number.isFinite(n) ? n : 0 });
                        }}
                        className="h-7 text-xs"
                        aria-label={`${item.name} ${key}`}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  <Badge variant="ai" ariaLabel="AI estimated nutrition" icon={<Icons.sparkles />}>
                    AI estimate
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        {low ? (
          <p className="mb-2 text-[11px] text-amber-700">Some items are low confidence — check portions.</p>
        ) : null}
        <div className="flex gap-2 pb-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => { setStage("input"); setItems([]); }}>
            Back
          </Button>
          <Button type="button" className="flex-[2]" onClick={handleLogAll}>
            Log all
          </Button>
        </div>
      </div>
    );
  }

  if (inputHidden) {
    return null;
  }

  return (
    <div
      data-testid="log-sheet-describe"
      className="mx-3 mt-2 space-y-2 rounded-[var(--radius-card-lg)] border border-border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        <PencilLine className="size-4 text-primary" aria-hidden />
        <span className="flex-1 text-[13px] font-semibold text-foreground">Describe what you ate</span>
        {locked ? <Lock className="size-3.5 text-muted-foreground" aria-hidden /> : null}
      </div>
      <textarea
        data-testid="log-sheet-describe-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'e.g. "2 scrambled eggs and toast with butter"'}
        aria-label="Describe what you ate"
        rows={2}
        className="min-h-[56px] w-full resize-none rounded-lg bg-muted px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {stage === "error" && error ? (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {stage === "parsing" ? (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Parsing your description…
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          data-testid="log-sheet-describe-parse"
          onClick={() => void runParse(text)}
        >
          Parse meal
        </Button>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">
        AI estimates from verified nutrition data. Review every item before logging.
      </p>
    </div>
  );
}
