"use client";

/**
 * PhotoLogDialog (Batch 5.13 + 2026-05-02 confidence-framing port).
 *
 * Pro-tier AI photo logging review dialog. Mirrors the mobile sheet at
 * `apps/mobile/components/PhotoLogSheet.tsx`.
 *
 * Flow:
 *  1. User picks a photo via `<input type="file" accept="image/*" capture="environment" />`
 *  2. Preview renders locally from the File.
 *  3. "Analyse" POSTs multipart/form-data to `/api/nutrition/photo-log`.
 *  4. Review:
 *     - Plate hero card: midpoint kcal headline + plate-level confidence
 *       meter + tappable range caption.
 *     - Item list: collapsed by default (name + midpoint + meter +
 *       chevron + kebab); expand to edit macros / verify.
 *     - "AI estimate" badge swaps to a green "database · verified"
 *       badge after the user matches against USDA / Open Food Facts.
 *  5. Tri-state save copy ("Log verified" / "Log meal" / "Log estimate").
 *
 * Why midpoint-with-confidence-meter framing? See
 * `docs/decisions/2026-05-02-photo-log-confidence-framing.md` — keeps
 * the honest-uncertainty posture the customer-lens P1 caveat called
 * for, presented in a way that converts Cal AI users.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icons } from "../ui/icons";
import { Badge } from "./badge";
import {
  aggregateRange,
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  midpoint,
  photoLogSaveCopy,
  plateConfidence,
  rangeFor,
  sanitiseAiItems,
  type AiLoggedItem,
  type ConfidenceLevel,
} from "../../../lib/nutrition/aiLogging";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

export type PhotoLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlot: string;
  onCommit: (items: AiLoggedItem[]) => void;
};

type Stage = "pick" | "analysing" | "review" | "error";

/**
 * 4-segment confidence meter — vertical strip of 4 bars with 2px gaps.
 *
 *  - high (>=0.75): 4/4 filled, success-green
 *  - medium (0.5–0.75): 2/4 filled, warning-amber
 *  - low (<0.5): 1/4 filled, destructive-red
 *  - verified: 4/4 success-green + leading check glyph
 *
 * Web sizing per spec: 16px wide × 40px tall. Mobile equivalent in
 * `PhotoLogSheet.tsx` is 12×28.
 */
function ConfidenceMeter({
  level,
  verified = false,
  ariaLabel,
  onClick,
}: {
  level: ConfidenceLevel;
  verified?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  const filled = verified || level === "high" ? 4 : level === "medium" ? 2 : 1;
  const colorClass = verified || level === "high"
    ? "bg-success"
    : level === "medium"
      ? "bg-warning"
      : "bg-destructive";

  const meterContent = (
    <div className="inline-flex items-center gap-1" aria-hidden="true">
      {verified && (
        <Icons.check className="size-2.5 text-success" />
      )}
      <div
        className="grid grid-cols-1 gap-[2px]"
        style={{ width: 16, height: 40 }}
      >
        {[3, 2, 1, 0].map((i) => (
          <div
            key={i}
            className={
              i < filled ? colorClass : "bg-muted-foreground/15"
            }
            style={{ borderRadius: 2 }}
          />
        ))}
      </div>
    </div>
  );

  const label =
    ariaLabel ??
    (verified
      ? "Verified against database"
      : level === "high"
        ? "High confidence"
        : level === "medium"
          ? "Medium confidence"
          : "Low confidence");

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        data-testid="confidence-meter"
        data-level={verified ? "verified" : level}
      >
        {meterContent}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      data-testid="confidence-meter"
      data-level={verified ? "verified" : level}
    >
      {meterContent}
    </span>
  );
}

function levelLabel(level: ConfidenceLevel): string {
  if (level === "high") return "high confidence";
  if (level === "medium") return "medium confidence";
  return "low confidence";
}

export function PhotoLogDialog({ open, onOpenChange, activeSlot, onCommit }: PhotoLogDialogProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [verifyingIndex, setVerifyingIndex] = useState<number | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setStage("pick");
      setFile(null);
      setItems([]);
      setExpanded({});
      setVerifyingIndex(null);
      setVerifyError(null);
      setTooltipOpen(false);
      setError(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      track(AnalyticsEvents.ai_photo_log_started);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("That doesn't look like an image. Pick a photo of your meal.");
      setStage("error");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      setError("Photo is too large (max 6 MB). Try a smaller image.");
      setStage("error");
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const submitPhoto = useCallback(async () => {
    if (!file) return;
    setStage("analysing");
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const resp = await fetch("/api/nutrition/photo-log", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (resp.status === 403 && data?.error === "upgrade_required") {
        setError(
          typeof data.message === "string"
            ? data.message
            : "AI photo logging is a Pro feature. Upgrade to use it.",
        );
        setStage("error");
        return;
      }
      if (!data?.ok || !Array.isArray(data.items)) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : "Could not identify food in that photo. Try a clearer angle.",
        );
        setStage("error");
        return;
      }
      const cleaned = sanitiseAiItems(data.items, "ai_photo");
      if (cleaned.length === 0) {
        setError("No food items were identified. Try a clearer, well-lit photo.");
        setStage("error");
        return;
      }
      setItems(cleaned);
      setExpanded({});
      setStage("review");
    } catch {
      setError("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [file]);

  const totals = useMemo(() => aggregateTotals(items), [items]);
  const plateRange = useMemo(() => aggregateRange(items), [items]);
  const plateConf = useMemo(() => plateConfidence(items), [items]);
  const allVerified = useMemo(
    () => items.length > 0 && items.every((i) => i.verified === true),
    [items],
  );
  const saveCopy = useMemo(() => photoLogSaveCopy(items), [items]);

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        // Edit-without-verify must NOT auto-set `verified`. If a macro
        // or name field is in the patch and `verified` isn't explicitly
        // toggled, force it back to false.
        const editingMacroOrName =
          "name" in patch ||
          "calories" in patch ||
          "protein" in patch ||
          "carbs" in patch ||
          "fat" in patch ||
          "fiber" in patch;
        if (editingMacroOrName && !("verified" in patch)) {
          next.verified = false;
        }
        return next;
      }),
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        if (idx > index) next[idx - 1] = v;
      });
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    items.forEach((_, i) => {
      next[i] = true;
    });
    setExpanded(next);
  };

  const handleVerify = useCallback(
    async (index: number) => {
      const item = items[index];
      if (!item) return;
      const before = classifyConfidence(item.confidence);
      track(AnalyticsEvents.ai_photo_log_verify_tapped, {
        confidenceBefore: before,
        itemIndex: index,
      });
      setVerifyingIndex(index);
      setVerifyError(null);
      try {
        // Reuse the existing recipe-line verifier with a single-ingredient
        // payload — it routes through USDA → OFF → Edamam → FatSecret →
        // local estimation, returning the same `confidence`-tagged shape
        // we already trust on the recipe surface.
        const amountStr =
          item.grams != null && Number.isFinite(item.grams)
            ? String(item.grams)
            : "100";
        const unit = item.grams != null ? "g" : "g";
        const resp = await fetch("/api/nutrition/verify-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredients: [{ name: item.name, amount: amountStr, unit }],
            servings: 1,
          }),
        });
        if (!resp.ok) {
          throw new Error(`status_${resp.status}`);
        }
        const data = await resp.json();
        const verified = data?.verified?.[0];
        const macros = verified?.macros;
        if (!data?.ok || !verified || !macros || verified.confidence < 0.5) {
          track(AnalyticsEvents.ai_photo_log_verify_failed, {
            itemIndex: index,
            reason: "no_match",
          });
          setVerifyError("No high-confidence match in our database — keep the AI estimate or edit manually.");
          return;
        }
        setItems((prev) =>
          prev.map((it, i) => {
            if (i !== index) return it;
            const next: AiLoggedItem = {
              ...it,
              verified: true,
              confidence: 1,
            };
            if (Number.isFinite(macros.calories)) next.calories = Math.round(Number(macros.calories));
            if (Number.isFinite(macros.protein)) next.protein = Math.round(Number(macros.protein));
            if (Number.isFinite(macros.carbs)) next.carbs = Math.round(Number(macros.carbs));
            if (Number.isFinite(macros.fat)) next.fat = Math.round(Number(macros.fat));
            if (macros.fiber != null && Number.isFinite(macros.fiber)) {
              next.fiber = Math.round(Number(macros.fiber));
            }
            // Verified items have no range — clear any explicit bounds.
            next.caloriesLow = undefined;
            next.caloriesHigh = undefined;
            return next;
          }),
        );
        track(AnalyticsEvents.ai_photo_log_verify_succeeded, { itemIndex: index });
      } catch {
        track(AnalyticsEvents.ai_photo_log_verify_failed, {
          itemIndex: index,
          reason: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "server_error",
        });
        setVerifyError("Can't reach database — try again.");
      } finally {
        setVerifyingIndex(null);
      }
    },
    [items],
  );

  const handleLogAll = () => {
    if (items.length === 0) return;
    onCommit(items);
    track(AnalyticsEvents.ai_photo_log_committed, {
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Icons.camera className="size-5 text-primary" aria-hidden />
            Photo log
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {stage === "review"
              ? `We identified ${items.length} item${items.length === 1 ? "" : "s"}. Review, edit or verify before logging.`
              : stage === "analysing"
                ? "Identifying items and estimating portions…"
                : "Snap a photo of your meal and we'll identify foods, estimate portions, and match against our verified nutrition database."}
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="grid gap-3 py-2">
            {previewUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Photo preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted"
                aria-label="Pick a photo to analyse"
              >
                <Icons.camera className="size-6" aria-hidden />
                Tap to pick a photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePick}
            />
            <p className="text-[11px] text-muted-foreground">
              AI estimates. Photo is sent to our servers and processed by OpenAI for
              food identification. Nutrition values come from our verified database
              where possible; low-confidence items will be flagged.
            </p>
          </div>
        )}

        {stage === "analysing" && (
          <div className="py-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden />
            Identifying items and estimating portions…
          </div>
        )}

        {stage === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error ?? "Something went wrong. Please try again."}
          </div>
        )}

        {stage === "review" && (
          <div className="grid gap-2 py-2 max-h-[55vh] overflow-y-auto">
            {previewUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Your meal" className="h-full w-full object-cover" />
              </div>
            )}

            {/* Plate hero card — midpoint headline + meter + range caption. */}
            <div
              data-testid="plate-hero"
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <p
                  className="text-[28px] font-bold leading-none text-foreground"
                  data-testid="plate-hero-midpoint"
                >
                  ~{totals.calories} kcal
                </p>
                <p className="text-xs text-muted-foreground">
                  plate total · {items.length} item{items.length === 1 ? "" : "s"}
                </p>
                {(plateRange.low > 0 || plateRange.high > 0) && !allVerified && (
                  <button
                    type="button"
                    onClick={expandAll}
                    aria-label="Expand all items"
                    className="text-[11px] text-muted-foreground/80 hover:text-foreground inline-flex items-center gap-1 mt-0.5 self-start"
                    data-testid="plate-hero-range"
                  >
                    Range {plateRange.low}–{plateRange.high} · {levelLabel(plateConf)}
                    <Icons.down className="size-3" aria-hidden />
                  </button>
                )}
                {allVerified && (
                  <p
                    className="text-[11px] text-success inline-flex items-center gap-1 mt-0.5"
                    data-testid="plate-hero-verified-caption"
                  >
                    <Icons.check className="size-3" aria-hidden /> all items verified
                  </p>
                )}
              </div>
              <div className="relative shrink-0 ml-3" style={{ width: 56 }}>
                <div className="flex justify-end">
                  <ConfidenceMeter
                    level={plateConf}
                    verified={allVerified}
                    onClick={() => setTooltipOpen((v) => !v)}
                    ariaLabel={
                      allVerified
                        ? "All items verified"
                        : `Plate ${levelLabel(plateConf)}. Tap for details.`
                    }
                  />
                </div>
                {tooltipOpen && (
                  <div
                    role="tooltip"
                    className="absolute right-0 top-full mt-1 z-10 w-56 rounded-md border border-border bg-card p-2 text-[11px] text-foreground shadow-md"
                  >
                    Estimated from photo. Tap &ldquo;Verify&rdquo; to match against
                    USDA / Open Food Facts.
                  </div>
                )}
              </div>
            </div>

            {items.map((item, i) => {
              const level = classifyConfidence(item.confidence);
              const verified = item.verified === true;
              const range = rangeFor(item);
              const isExpanded = !!expanded[i];
              const isVerifying = verifyingIndex === i;
              const itemMid = midpoint(item);
              return (
                <div
                  key={`${item.name}-${i}`}
                  data-testid={`photo-log-item-${i}`}
                  data-verified={verified ? "true" : "false"}
                  className={`rounded-lg border p-2.5 text-sm grid transition-[grid-template-rows] duration-150 ${
                    verified
                      ? "border-success/40 bg-success/5"
                      : level === "low"
                        ? "border-destructive/40 bg-destructive/5"
                        : level === "medium"
                          ? "border-warning/40 bg-warning/5"
                          : "border-border bg-card"
                  }`}
                  style={{
                    gridTemplateRows: isExpanded ? "auto auto 1fr" : "auto auto 0fr",
                  }}
                >
                  {/* Row 1: name + midpoint + meter + chevron + kebab */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        aria-label={`Item ${i + 1} name`}
                        className="h-8 text-sm font-medium"
                      />
                    </div>
                    <span
                      className="text-[17px] font-bold leading-none text-foreground tabular-nums shrink-0"
                      data-testid={`photo-log-item-${i}-midpoint`}
                    >
                      ~{itemMid} kcal
                    </span>
                    <ConfidenceMeter level={level} verified={verified} />
                    <button
                      type="button"
                      onClick={() => toggleExpand(i)}
                      aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                      aria-expanded={isExpanded}
                      className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                      data-testid={`photo-log-item-${i}-toggle`}
                    >
                      {isExpanded ? (
                        <Icons.up className="size-4" aria-hidden />
                      ) : (
                        <Icons.down className="size-4" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Icons.more className="size-4" aria-hidden />
                    </button>
                  </div>
                  {/* Row 2: range caption + AI/verified chip */}
                  <div className="flex items-center gap-2 mt-1">
                    {!verified && (
                      <p
                        className="text-[11px] text-muted-foreground flex-1 min-w-0"
                        data-testid={`photo-log-item-${i}-range`}
                      >
                        range {range.low}–{range.high} ·{" "}
                      </p>
                    )}
                    {verified ? (
                      <Badge
                        variant="added"
                        ariaLabel="Verified against database"
                        icon={<Icons.check />}
                        data-testid={`photo-log-item-${i}-verified-chip`}
                      >
                        database · verified
                      </Badge>
                    ) : (
                      <Badge
                        variant="ai"
                        ariaLabel="AI estimated nutrition"
                        icon={<Icons.sparkles />}
                        data-testid={`photo-log-item-${i}-ai-chip`}
                      >
                        AI estimate
                      </Badge>
                    )}
                  </div>
                  {/* Row 3 (expanded): macro inputs + verify CTA */}
                  <div
                    className="overflow-hidden"
                    aria-hidden={!isExpanded}
                  >
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
                            disabled={!isExpanded || isVerifying}
                            tabIndex={isExpanded ? 0 : -1}
                          />
                        </label>
                      ))}
                    </div>
                    {!verified && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerify(i)}
                          disabled={isVerifying}
                          aria-label={`Verify ${item.name} with database`}
                          data-testid={`photo-log-item-${i}-verify`}
                        >
                          {isVerifying ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin"
                                aria-hidden
                              />
                              Verifying…
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Icons.verified className="size-3" aria-hidden />
                              Verify with database
                            </span>
                          )}
                        </Button>
                      </div>
                    )}
                    {!verified && verifyingIndex === null && verifyError && (
                      <p
                        role="alert"
                        className="mt-1.5 text-[11px] text-destructive"
                      >
                        {verifyError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              AI estimates. Verify with the database to lock macros to a known source.
            </p>
            <div className="mt-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              Logging to <span className="font-semibold text-foreground">{activeSlot}</span> · midpoints shown.
              Total: {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
              {totals.fiber != null ? ` · Fi ${totals.fiber}g` : ""}
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === "pick" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submitPhoto} disabled={!file}>
                Analyse
              </Button>
            </>
          )}
          {stage === "error" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setStage("pick")}>Try again</Button>
            </>
          )}
          {stage === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStage("pick")}>
                Back
              </Button>
              <Button
                onClick={handleLogAll}
                disabled={items.length === 0}
                data-testid="photo-log-save-button"
                className={
                  saveCopy.primary === "Log verified"
                    ? "bg-success text-success-foreground hover:bg-success/90"
                    : undefined
                }
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>{saveCopy.primary}</span>
                  {saveCopy.subcaption && (
                    <span
                      className="text-[10px] font-normal opacity-90"
                      data-testid="photo-log-save-subcaption"
                    >
                      {saveCopy.subcaption}
                    </span>
                  )}
                </span>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoLogDialog;
