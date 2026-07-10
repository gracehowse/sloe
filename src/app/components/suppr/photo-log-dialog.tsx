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
// ENG-816 / icon-strategy 2026-05-31 — the "Plate total" banner's leading
// icon is a lucide-react ArrowRight, matching mobile PhotoLogSheet which has
// rendered `<ArrowRight size={16} .../>` UNCONDITIONALLY since the 2026-05-06
// F-107 audit. Ungated for day-one web↔mobile parity (ENG-816 #24): an
// identical-meaning icon swap needs no flag per the icon-strategy decision,
// and gating only web left web showing 👉 while mobile showed the glyph.
import { ArrowRight } from "lucide-react";
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
import { track, isFeatureEnabled } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { FREE_PHOTO_LOG_WEEKLY_LIMIT } from "../../../lib/nutrition/photoLogQuota";
import { RefineByDescribing } from "./refine-by-describing";

/** localStorage key for the one-time "we'll remember this for next
 *  time" toast on web. Mirrors the mobile AsyncStorage flag —
 *  per-device, not per-user, because the lesson is for the human. */
export const PHOTO_CORRECTION_TOAST_KEY = "suppr.photo-correction-tooltip-shown.v1";

export type PhotoLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlot: string;
  onCommit: (items: AiLoggedItem[]) => void;
  /**
   * 2026-05-02 — free-taster gating. Non-Pro users (Free + Base) see
   * "X free photo logs remaining today" under the dialog description;
   * on a 403 from the server the dialog calls `onUpgradeRequired` so
   * the host can route to the AiPaywallDialog. Defaults to "pro" so
   * existing call sites that don't pass it preserve old behaviour.
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

type ResponseShape = {
  items: PhotoLogItemRanged[];
  addons?: PhotoLogAddon[];
  totalKcal: Range;
  totalKcalWithAddons?: Range;
  notes?: string;
  modelVersion: string;
};

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
  const [items, setItems] = useState<PhotoLogItemRanged[]>([]);
  const [addons, setAddons] = useState<PhotoLogAddon[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * 2026-05-02 — authoritative free-taster quota signal returned by
   * the server on a successful response. `null` = no successful call
   * yet; we render the optimistic `FREE_PHOTO_LOG_WEEKLY_LIMIT` until
   * the first 200 lands, then this takes over. Pro users never see
   * this line at all (the `isFreeTier` guard short-circuits below).
   */
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const isFreeTier = userTier !== "pro";
  // ENG-974 — 1-indexed "refine by describing" round for the current result.
  const [refineRound, setRefineRound] = useState(1);
  const refineEnabled = isFeatureEnabled("log_refine_describe_v1");
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
      // Reset the quota signal on each fresh open. The first analyse
      // call populates it from the server response.
      setQuotaRemaining(null);
      setRefineRound(1);
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
      // F-108 (2026-05-07): client abort so a hung request doesn't
      // strand the user on the analysing spinner. 65s ceiling matches
      // the route's `maxDuration = 60` plus headroom.
      const ac = new AbortController();
      const clientTimeout = setTimeout(() => ac.abort(), 65_000);
      let resp: Response;
      try {
        resp = await fetch("/api/nutrition/photo-log", {
          method: "POST",
          body: form,
          signal: ac.signal,
        });
      } finally {
        clearTimeout(clientTimeout);
      }
      const data = (await resp.json().catch((parseErr) => {
        console.error("[photo-log-dialog] response not JSON", parseErr);
        return null;
      })) as
        | (ResponseShape & { ok: true; freeQuotaRemaining?: number | null })
        | { ok: false; error?: string; message?: string; freeQuotaRemaining?: number | null }
        | null;
      if (!data) {
        setError("The server's reply was unreadable. Please try again.");
        setStage("error");
        return;
      }
      if (resp.status === 403 && "error" in data && data.error === "upgrade_required") {
        // 2026-05-02 — free-taster quota exhausted. Hand off to the
        // host so it can close this dialog and open the
        // AiPaywallDialog. The dialog is the SECOND-photo experience,
        // not in-dialog upgrade copy. Fire the funnel event so the
        // dashboards keep reporting.
        if (onUpgradeRequired) {
          track(AnalyticsEvents.ai_photo_log_paywalled);
          onUpgradeRequired();
          return;
        }
        // Back-compat fallback: if the host didn't wire the upgrade
        // callback, surface the inline error so the gate isn't
        // silently swallowed.
        setError(
          typeof data.message === "string"
            ? data.message
            : // ENG-971 — honest billing: Pro AI photo logging is capped at
              // 100/day, not unlimited. Mirror AiPaywallSheet ("up to 100 a
              // day"). Server `data.message` is the canonical string; this is
              // only the back-compat fallback when the host can't open the
              // AiPaywallDialog.
              "You've used all 5 of your free photo logs this week. Pro unlocks AI photo logging up to 100 a day.",
        );
        setStage("error");
        return;
      }
      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        // F-108: differentiate failure mode by server `error` code.
        const errCode = "error" in data && typeof data.error === "string" ? data.error : null;
        // F-138 follow-up (2026-05-08): vendor-neutral `ai_*` codes after
        // photo-log migrated from OpenAI to Claude vision. Legacy `openai_*`
        // codes kept as aliases for the env-var transition window where
        // the route may temporarily fall back to OpenAI.
        const fallbackByCode: Record<string, string> = {
          ai_timeout: "The AI took too long to respond. Try again in a moment.",
          ai_network_error: "Could not reach the AI service. Try again in a moment.",
          ai_http_error: "The AI service had a problem with this image. Try a different photo or angle.",
          ai_not_configured: "Photo logging isn't available right now. Try logging manually.",
          openai_timeout: "The AI took too long to respond. Try again in a moment.",
          openai_network_error: "Could not reach the AI service. Try again in a moment.",
          openai_http_error: "The AI service had a problem with this image. Try a different photo or angle.",
          model_unparseable: "Couldn't read the AI's reply. Try a different angle or better light.",
          file_too_large: "That photo is too large. Crop tighter or take a fresh shot.",
          missing_image: "No image was uploaded. Pick a photo and try again.",
        };
        const msg =
          ("message" in data && typeof data.message === "string" && data.message) ||
          (errCode ? fallbackByCode[errCode] : null) ||
          "Couldn't read the photo. Try a clearer angle or better light.";
        setError(msg);
        setStage("error");
        return;
      }
      // Authoritative remaining-quota signal from the server (only
      // meaningful for non-Pro). `null` for Pro.
      if (typeof data.freeQuotaRemaining === "number") {
        setQuotaRemaining(data.freeQuotaRemaining);
      }
      // Snapshot the AI's items in `AiLoggedItem` form so the
      // photo-corrections-persist helper can diff user edits at commit
      // time (the helper expects that shape).
      originalItemsRef.current = data.items.map((it) => rangedItemToLogged(it));
      setItems(data.items);
      setAddons(Array.isArray(data.addons) ? data.addons : []);
      setNotes(typeof data.notes === "string" ? data.notes : null);
      setRefineRound(1);
      setStage("review");
    } catch (err) {
      // F-108 (2026-05-07): name the error so it's diagnosable from
      // browser console without server access.
      const isAbort =
        (err instanceof Error && err.name === "AbortError") ||
        (err as { name?: string } | null)?.name === "AbortError";
      if (isAbort) {
        console.warn("[photo-log-dialog] aborted (client timeout 65s)");
        setError(
          "The photo is taking longer than usual to analyse. Check your connection and try again.",
        );
      } else {
        console.error("[photo-log-dialog] threw during photo log", err);
        setError("Photo logging failed. Check your connection and try again.");
      }
      setStage("error");
    }
  }, [file, onUpgradeRequired]);

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
      <DialogContent className="bg-card border-border max-w-lg rounded-card-lg">
        <DialogHeader>
          {/* Sloe DS — photo is a Pro feature; the camera carries the damson
              Pro accent and the title reads in the Newsreader serif plum
              (`text-foreground-brand`), matching the LogSheet header. */}
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-headline)] text-[22px] font-medium tracking-tight text-foreground-brand">
            <Icons.camera className="size-5" style={{ color: "var(--accent-win)" }} aria-hidden />
            Photo log
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {stage === "review"
              ? `${items.length} item${items.length === 1 ? "" : "s"} on the plate. Tap any item to verify against our food database.`
              : "Snap a photo of your meal. We'll itemize it with kcal ranges grouped by macro role."}
          </DialogDescription>
          {/*
           * 2026-05-02 — free-taster quota line. Renders only for
           * non-Pro tiers. Optimistic FREE_PHOTO_LOG_WEEKLY_LIMIT
           * before the first server response; authoritative
           * `quotaRemaining` after. Hidden on Pro (uncapped at the
           * user-visible level — the 100/day bucket is plumbing).
           * `aria-label` pins the count without being brittle to
           * whitespace / the bullet separator.
           */}
          {isFreeTier &&
            (() => {
              const shown = quotaRemaining ?? FREE_PHOTO_LOG_WEEKLY_LIMIT;
              const noun = shown === 1 ? "log" : "logs";
              return (
                <div
                  role="status"
                  aria-label={`${shown} free photo ${noun} remaining this week`}
                  className="text-[11px] text-muted-foreground mt-1"
                >
                  {shown} free {noun} remaining this week
                </div>
              );
            })()}
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
              <ArrowRight size={16} aria-hidden className="text-foreground shrink-0" />
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

            {/* ENG-974 — refine by describing. Re-estimates the whole plate from
                the CURRENT items + the user's free-text correction. */}
            {refineEnabled && (
              <RefineByDescribing
                source="photo"
                items={items}
                notes={notes}
                round={refineRound}
                onRoundComplete={() => setRefineRound((r) => r + 1)}
                onRefined={({ items: nextItems, notes: nextNotes }) => {
                  originalItemsRef.current = nextItems.map((it) => rangedItemToLogged(it));
                  setItems(nextItems);
                  // A refine may resolve add-ons into items; drop the stale strip.
                  setAddons([]);
                  setNotes(nextNotes ?? null);
                }}
              />
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
