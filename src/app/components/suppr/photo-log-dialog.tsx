"use client";

/**
 * PhotoLogDialog (Batch 5.13) — Pro-tier AI photo logging.
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
 * endpoint. Pro gating lives in the API (403 with `error: "upgrade_required"`)
 * and is surfaced before the user can upload (see NutritionTracker button).
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
import { toast } from "sonner";
import {
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  sanitiseAiItems,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";
import { persistPhotoCorrections } from "../../../lib/nutrition/photoCorrectionPersist";
import { supabase } from "../../../lib/supabase/browserClient";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

/** localStorage key for the one-time "we'll remember this for next
 *  time" toast on web. Mirrors the mobile AsyncStorage flag —
 *  per-device, not per-user, because the lesson is for the human. */
export const PHOTO_CORRECTION_TOAST_KEY = "suppr.photo-correction-tooltip-shown.v1";

export type PhotoLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlot: string;
  onCommit: (items: AiLoggedItem[]) => void;
};

type Stage = "pick" | "analysing" | "review" | "error";

export function PhotoLogDialog({ open, onOpenChange, activeSlot, onCommit }: PhotoLogDialogProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Snapshot of the AI's original items, before the user edited any
   *  field. Used at commit time to detect which rows the user
   *  actually corrected so we only persist meaningful edits to the
   *  bank. Stored as a ref because we never re-render off it. */
  const originalItemsRef = useRef<AiLoggedItem[]>([]);

  useEffect(() => {
    if (open) {
      setStage("pick");
      setFile(null);
      setItems([]);
      setError(null);
      originalItemsRef.current = [];
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
      // Snapshot AI's original items so we can detect user
      // corrections at commit time (mirror of mobile PhotoLogSheet).
      originalItemsRef.current = cleaned.map((it) => ({ ...it }));
      setItems(cleaned);
      setStage("review");
    } catch {
      setError("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [file]);

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

    // Fire-and-forget: persist corrected items to the user's
    // personal food bank so the next photo log of the same item
    // uses these macros. Mirror of mobile `PhotoLogSheet`.
    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        if (!userId) return;
        const result = await persistPhotoCorrections({
          supabase: supabase as Parameters<typeof persistPhotoCorrections>[0]["supabase"],
          userId,
          originals: originalItemsRef.current,
          corrected: items,
          track: (event, payload) => {
            track(event as never, payload as never);
          },
        });
        if (!result.anyPersisted) return;
        const seen =
          typeof window !== "undefined" &&
          window.localStorage?.getItem(PHOTO_CORRECTION_TOAST_KEY) === "1";
        if (seen) return;
        try {
          window.localStorage?.setItem(PHOTO_CORRECTION_TOAST_KEY, "1");
        } catch {
          /* localStorage flaky — still surface the toast once this
             session, the next session may re-show */
        }
        toast.success("Got it — we'll remember this for next time.");
      } catch {
        /* fail closed — the meal already committed */
      }
    })();

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
