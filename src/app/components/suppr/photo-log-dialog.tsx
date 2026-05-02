"use client";

/**
 * PhotoLogDialog — Pro-tier AI photo logging.
 *
 * Re-architected 2026-05-01 (`docs/decisions/2026-05-01-photo-log-rangefirst.md`).
 *
 * Renders a ChatGPT-grade itemized breakdown of a meal photo: items
 * grouped by macro role ("Bread + dips", "Protein + fats", "Extras"),
 * per-item kcal RANGES (~120-150 kcal — honest about vision uncertainty),
 * an optional add-on chip strip (e.g. "Add wine: +120-150 kcal"), and
 * a plate total range. Replaces the previous single-number-per-item UI.
 *
 * Flow:
 *  1. User picks a photo via `<input type="file" capture="environment" />`.
 *  2. Preview renders locally from the File.
 *  3. "Analyse" POSTs multipart/form-data to `/api/nutrition/photo-log`.
 *  4. Items render grouped by category, with kcal ranges + 3-dot menu
 *     (Edit portion, Verify with database, Remove) per item.
 *  5. Add-on chips below the list — tapping moves an addon into the
 *     items list (treated as an `Extras`-category item from then on).
 *  6. "Save to today" projects each ranged item to the existing
 *     `AiLoggedItem` shape via `rangedItemToLogged` (calories =
 *     midpoint of the range; range preserved on `.range`) and calls
 *     `onCommit`.
 *
 * Parity: mirrors the mobile `PhotoLogSheet`. Identical response shape,
 * identical grouping, identical formatting. Differs only in styling
 * (sonner toast on web; AsyncStorage + ToastAndroid + Alert.alert on
 * mobile).
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
import { Icons } from "../ui/icons";
import { Badge } from "./badge";
import { toast } from "sonner";
import {
  averageConfidence,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";
import {
  formatRange,
  formatRangeKcal,
  groupItemsByCategory,
  rangedItemToLogged,
  sumRanges,
  type PhotoLogAddon,
  type PhotoLogItemRanged,
  type Range,
} from "../../../lib/nutrition/photoLogRanges";
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

type ResponseShape = {
  items: PhotoLogItemRanged[];
  addons?: PhotoLogAddon[];
  totalKcal: Range;
  totalKcalWithAddons?: Range;
  notes?: string;
  modelVersion: string;
};

export function PhotoLogDialog({ open, onOpenChange, activeSlot, onCommit }: PhotoLogDialogProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<PhotoLogItemRanged[]>([]);
  const [addons, setAddons] = useState<PhotoLogAddon[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Snapshot of the AI's original committed AiLoggedItems before any
   *  user edit. Used at commit time by `persistPhotoCorrections` to
   *  detect user corrections. Stored as a ref because we never re-
   *  render off it. Mirror of mobile sheet. */
  const originalItemsRef = useRef<AiLoggedItem[]>([]);

  useEffect(() => {
    if (open) {
      setStage("pick");
      setFile(null);
      setItems([]);
      setAddons([]);
      setNotes(null);
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
      const data = (await resp.json()) as
        | (ResponseShape & { ok: true })
        | { ok: false; error?: string; message?: string };
      if (resp.status === 403 && "error" in data && data.error === "upgrade_required") {
        setError(
          typeof data.message === "string"
            ? data.message
            : "AI photo logging is a Pro feature. Upgrade to use it.",
        );
        setStage("error");
        return;
      }
      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        const msg =
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Couldn't read the photo. Try a clearer angle or better light.";
        setError(msg);
        setStage("error");
        return;
      }
      // Snapshot the AI's items in `AiLoggedItem` form so the
      // photo-corrections-persist helper can diff user edits at commit
      // time (the helper expects that shape).
      originalItemsRef.current = data.items.map((it) => rangedItemToLogged(it));
      setItems(data.items);
      setAddons(Array.isArray(data.addons) ? data.addons : []);
      setNotes(typeof data.notes === "string" ? data.notes : null);
      setStage("review");
    } catch {
      setError("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [file]);

  const groups = useMemo(() => groupItemsByCategory(items), [items]);
  const totalKcal = useMemo(
    () => sumRanges(items.map((i) => i.calories)),
    [items],
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addAddon = (addon: PhotoLogAddon) => {
    // Move the addon into the items list as an Extras-category item so
    // the plate total updates and the user can subsequently remove it.
    setItems((prev) => [
      ...prev,
      {
        id: addon.id,
        name: addon.name,
        category: "Drinks", // sensible default for the wine / beverage case; user can edit
        calories: addon.calories,
        protein: null,
        carbs: null,
        fat: null,
        confidence: "medium",
        source: "ai",
        ...(addon.hint ? { quantityHint: addon.hint } : {}),
      },
    ]);
    setAddons((prev) => prev.filter((a) => a.id !== addon.id));
    track(AnalyticsEvents.ai_photo_log_addon_added, {
      name: addon.name,
      kcalLow: addon.calories.low,
      kcalHigh: addon.calories.high,
    });
  };

  const handleSaveToday = () => {
    if (items.length === 0) return;
    const projected = items.map((it) => rangedItemToLogged(it));
    onCommit(projected as AiLoggedItem[]);
    track(AnalyticsEvents.ai_photo_log_committed, {
      itemCount: projected.length,
      avgConfidence: averageConfidence(projected as AiLoggedItem[]),
    });

    // Fire-and-forget: persist corrected items to the user's personal
    // food bank so the next photo log of the same item uses these
    // macros. Mirror of mobile `PhotoLogSheet`.
    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        if (!userId) return;
        const result = await persistPhotoCorrections({
          supabase: supabase as Parameters<typeof persistPhotoCorrections>[0]["supabase"],
          userId,
          originals: originalItemsRef.current,
          corrected: projected as AiLoggedItem[],
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
          /* localStorage flaky — still surface the toast once */
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
              ? `${items.length} item${items.length === 1 ? "" : "s"} on the plate. Tap any item to verify against our food database.`
              : "Snap a photo of your meal. We'll itemize it with kcal ranges grouped by macro role."}
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
              AI estimates with ranges. Tap any item after to verify against our food database.
              Low-confidence items are flagged.
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
          <div
            className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto"
            data-testid="photo-log-review"
          >
            {previewUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Your meal" className="h-full w-full object-cover" />
              </div>
            )}

            {/* Items grouped by macro role */}
            <div className="grid gap-3" data-testid="photo-log-groups">
              {groups.map((group) => (
                <div
                  key={group.category}
                  className="grid gap-1.5"
                  data-testid={`photo-log-group-${group.category.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.category}
                  </div>
                  <ul className="grid gap-1">
                    {group.items.map((item) => {
                      const low = item.confidence === "low";
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm ${
                            low ? "border-amber-400/50 bg-amber-400/5" : "border-border bg-card"
                          }`}
                          data-testid={`photo-log-item-${item.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">{item.name}</span>
                              {item.quantityHint && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({item.quantityHint})
                                </span>
                              )}
                            </div>
                            {low && (
                              <p className="mt-0.5 text-[11px] text-amber-700">
                                Low confidence — verify before logging.
                              </p>
                            )}
                          </div>
                          <span
                            className="font-mono text-sm tabular-nums text-foreground shrink-0"
                            aria-label={`${item.name} ${formatRangeKcal(item.calories)}`}
                          >
                            {formatRangeKcal(item.calories)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Icons.close className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Plate total */}
            <div
              className="rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-foreground flex items-center justify-between"
              data-testid="photo-log-plate-total"
            >
              <span aria-hidden className="text-base">👉</span>
              <span className="flex-1 ml-2">Plate total</span>
              <span className="font-mono tabular-nums">{formatRangeKcal(totalKcal)}</span>
            </div>

            {/* Add-on chips */}
            {addons.length > 0 && (
              <div className="grid gap-1.5" data-testid="photo-log-addons">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Add-ons
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {addons.map((addon) => (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => addAddon(addon)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:border-primary/40 hover:bg-muted"
                      data-testid={`photo-log-addon-${addon.id}`}
                    >
                      <Icons.add className="size-3" aria-hidden />
                      <span>Add {addon.name}</span>
                      <span className="text-muted-foreground">+{formatRange(addon.calories)} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caveats */}
            {notes && (
              <p
                className="text-[11px] text-muted-foreground italic"
                data-testid="photo-log-notes"
              >
                {notes}
              </p>
            )}

            <div className="text-[11px] text-muted-foreground">
              Logging to <span className="font-semibold text-foreground">{activeSlot}</span>.
              Calories saved use the midpoint of each range.
            </div>
            <Badge
              variant="ai"
              ariaLabel="AI estimated"
              icon={<Icons.sparkles />}
            >
              AI estimate
            </Badge>
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
              <Button onClick={handleSaveToday} disabled={items.length === 0}>
                Save to today
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoLogDialog;
