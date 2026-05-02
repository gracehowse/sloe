"use client";

/**
 * PhotoLogDialog (Batch 5.13) — AI photo logging.
 *
 * Flow:
 *  1. User picks a photo via `<input type="file" accept="image/*" capture="environment" />`
 *  2. Preview renders locally from the File.
 *  3. "Analyse" POSTs multipart/form-data to `/api/nutrition/photo-log`.
 *  4. Parsed items render in a review list with edit / remove / confidence badge.
 *  5. "Log all" commits every reviewed item as a `LoggedMeal` with source `"ai_photo"`.
 *
 * Parity: mirrors the mobile `PhotoLogSheet` and shares `sanitiseAiItems`,
 * `classifyConfidence`, `aggregateTotals`, and the `/api/nutrition/photo-log`
 * endpoint.
 *
 * Free taster (2026-05-02 — `docs/decisions/2026-05-02-photo-log-free-taster.md`):
 *  - Non-Pro users get 3 free photo logs per rolling 24h.
 *  - The dialog ALWAYS opens for any tier — the gate is the SECOND photo
 *    after exhaustion (server returns 403 upgrade_required), not the first.
 *  - When `userTier !== "pro"`, a thin "X free logs remaining today" line
 *    renders under the description.
 *  - On 403 from the server, the dialog calls `onUpgradeRequired` so the
 *    host can dismiss the dialog and open the AiPaywallDialog.
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
import { ConfidenceDot } from "./confidence-dot";
import { Badge } from "./badge";
import {
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  sanitiseAiItems,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";
import { FREE_PHOTO_LOG_DAILY_LIMIT } from "../../../lib/nutrition/photoLogQuota";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

// FREE_PHOTO_LOG_DAILY_LIMIT is imported above from the shared
// `src/lib/nutrition/photoLogQuota.ts` module — single source of truth
// shared with the server route + mobile sheet. Used to render an
// *optimistic* "X free logs remaining today" line before the first
// server response lands (then the authoritative `freeQuotaRemaining`
// from the response takes over).

export type PhotoLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlot: string;
  onCommit: (items: AiLoggedItem[]) => void;
  /**
   * 2026-05-02 — free-taster gating. Non-Pro users see "X free logs
   * remaining today" under the description; on a 403 from the server the
   * dialog calls `onUpgradeRequired` so the host can route to the
   * AiPaywallDialog. Defaults to "pro" so existing call sites that
   * don't pass it preserve old behaviour.
   */
  userTier?: "free" | "base" | "pro";
  /**
   * Called when the server returns 403 upgrade_required (free-quota
   * exhausted on the current request). Host dismisses this dialog and
   * opens the AiPaywallDialog with `feature: "photo_log"`.
   */
  onUpgradeRequired?: () => void;
};

type Stage = "pick" | "analysing" | "review" | "error";

export function PhotoLogDialog({
  open,
  onOpenChange,
  activeSlot,
  onCommit,
  userTier = "pro",
  onUpgradeRequired,
}: PhotoLogDialogProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // `null` = unknown (no successful response yet — show optimistic
  // FREE_PHOTO_LOG_DAILY_LIMIT). After a 200, we set it to the
  // authoritative value the server returned.
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const isFreeTier = userTier !== "pro";

  useEffect(() => {
    if (open) {
      setStage("pick");
      setFile(null);
      setItems([]);
      setError(null);
      setQuotaRemaining(null);
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
        // 2026-05-02 — free-taster quota exhausted. Hand off to the host
        // so it can close this dialog and open the AiPaywallDialog (the
        // paywall is the SECOND-photo experience, not in-dialog copy).
        if (onUpgradeRequired) {
          onUpgradeRequired();
          return;
        }
        // Back-compat: if the host didn't wire the upgrade callback,
        // fall through to the in-dialog error so we never silently
        // swallow the gate.
        setError(
          typeof data.message === "string"
            ? data.message
            : "You've used your free photo logs for today. Upgrade to Pro for unlimited.",
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
      // Capture the authoritative remaining-quota signal from the server
      // (only meaningful for non-Pro). `null` for Pro.
      if (typeof data.freeQuotaRemaining === "number") {
        setQuotaRemaining(data.freeQuotaRemaining);
      }
      setItems(cleaned);
      setStage("review");
    } catch {
      setError("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [file, onUpgradeRequired]);

  const totals = useMemo(() => aggregateTotals(items), [items]);
  const hasLowConfidence = items.some((i) => isLowConfidence(i));

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

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
              ? `We identified ${items.length} item${items.length === 1 ? "" : "s"}. Review, edit or remove before logging.`
              : "Snap a photo of your meal and we'll identify foods, estimate portions, and match against our verified nutrition database."}
          </DialogDescription>
          {/* 2026-05-02 — free-taster quota line. Renders only for
              non-Pro users. Optimistic FREE_PHOTO_LOG_DAILY_LIMIT until
              the first analyse call returns the authoritative
              `freeQuotaRemaining`. Mirrors the mobile sheet copy. */}
          {isFreeTier && (
            <p
              role="status"
              aria-label={`${quotaRemaining ?? FREE_PHOTO_LOG_DAILY_LIMIT} free photo logs remaining today`}
              className="text-[11px] font-semibold text-muted-foreground"
            >
              {(quotaRemaining ?? FREE_PHOTO_LOG_DAILY_LIMIT)} free log
              {(quotaRemaining ?? FREE_PHOTO_LOG_DAILY_LIMIT) === 1 ? "" : "s"} remaining today
            </p>
          )}
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
            Analysing your photo…
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
            {items.map((item, i) => {
              const level = classifyConfidence(item.confidence);
              const low = isLowConfidence(item);
              return (
                <div
                  key={`${item.name}-${i}`}
                  className={`rounded-lg border p-2.5 text-sm ${
                    low ? "border-amber-400/50 bg-amber-400/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        aria-label={`Item ${i + 1} name`}
                        className="h-8 text-sm font-medium"
                      />
                      {item.unit && (
                        <p className="text-[11px] text-muted-foreground mt-1">{item.unit}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
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
                      onClick={() => removeItem(i)}
                      className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
                  {low && (
                    <p role="alert" className="mt-1.5 text-[11px] text-amber-700">
                      Low confidence — please verify portion and macros before logging.
                    </p>
                  )}
                </div>
              );
            })}
            <div className="mt-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              Logging to <span className="font-semibold text-foreground">{activeSlot}</span>.
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
              <Button onClick={handleLogAll} disabled={items.length === 0}>
                {hasLowConfidence ? "Log anyway" : "Log all"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoLogDialog;
