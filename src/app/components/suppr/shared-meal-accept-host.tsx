/**
 * ENG-1642 — meal-share accept host + share-link callback (web).
 *
 * Extracted out of `NutritionTracker.tsx` so the pinned megafile doesn't
 * grow (screen-line-budget ratchet, ENG-717) — the mirror of mobile's
 * split, where the share orchestration lives in
 * `apps/mobile/lib/mealShare.ts` and the accept flow in
 * `apps/mobile/app/meal-shared.tsx`. Both exports are self-contained
 * against `useAppData()` so the host component only mounts
 * `<SharedMealAcceptHost />` and wires `useMealShareLinkCallback()`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAppData } from "../../../context/AppDataContext.tsx";
import { useAuthSession } from "../../../context/AuthSessionContext.tsx";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { stripHomeQueryParams } from "../../../lib/navigation/stripHomeQueryParams.ts";
import {
  MEAL_SHARE_FLAG,
  mealToShareItem,
  buildMealShareUrl,
  shareItemToLoggableMeal,
  normaliseMealShareToken,
  type MealSharePayload,
  type MealShareStatus,
} from "../../../lib/share/mealShareLink.ts";
import {
  createMealShare,
  getMealShare,
  takePendingMealShare,
} from "../../../lib/share/mealShareClient.ts";
import { normaliseMealSlot } from "../../../lib/nutrition/mealSlots";
import { SharedMealAcceptDialog } from "./shared-meal-accept-dialog";

/**
 * ENG-1642 — create a real shareable link for one logged meal from the
 * kebab "Share meal" action. Returns `undefined` while the
 * `meal_share_links_v1` flag is off (the section then keeps its exact
 * pre-ENG-1642 text-only share path); the callback itself returns `null`
 * on any failure (unknown meal id, unserialisable meal, non-"created"
 * RPC status) so the section can fall back to the text share.
 */
export function useMealShareLinkCallback():
  | ((mealId: string) => Promise<string | null>)
  | undefined {
  const { mealsForSelectedDate } = useAppData();
  const onShareMealLink = useCallback(
    async (mealId: string): Promise<string | null> => {
      const meal = mealsForSelectedDate.find((m) => m.id === mealId);
      if (!meal) return null;
      const item = mealToShareItem(meal);
      if (!item) return null;
      // Normalise to what the RPC accepts: legacy "Snack" rows and ENG-1177
      // custom slot names would otherwise return invalid_slot, and a
      // >200-char title invalid_title — both silently degrading to the
      // text-only share. The slot is only the recipient's default anyway.
      const result = await createMealShare(supabase, {
        title: meal.recipeTitle.slice(0, 200),
        mealSlot: normaliseMealSlot(meal.name) ?? "Dinner",
        items: [item],
      });
      if (result.status !== "created" || !result.token) return null;
      track(AnalyticsEvents.meal_share_link_created, {
        surface: "today_meal_row_kebab",
        itemCount: 1,
      });
      return buildMealShareUrl(result.token, window.location.origin);
    },
    [mealsForSelectedDate],
  );
  return isFeatureEnabled(MEAL_SHARE_FLAG) ? onShareMealLink : undefined;
}

/**
 * ENG-1642 — meal-share accept flow. `?mealShare=<token>` (the sharer's
 * link, via the /m/<token> landing) takes precedence over the signed-out
 * landing → post-auth resume handoff (`takePendingMealShare`,
 * localStorage; always drained so a URL-consumed visit can't leave a
 * stale pending token to replay later). A ref guards this to a single
 * consume-and-lookup per mount — both token sources are erased by the
 * first read, so the ref just avoids a redundant RPC while that first
 * lookup is in flight.
 *
 * DELIBERATELY NOT gated on `meal_share_links_v1`: the flag gates link
 * CREATION (supply), not redemption. Gating accept would dead-end
 * recipients outside a partial ramp cohort on links minted inside it,
 * and would diverge from mobile, whose accept screen also completes
 * flag-off (documented at the flag registration in both
 * `KNOWN_DEFAULT_OFF_FLAGS` lists). With the flag off no NEW links can
 * be minted; a token can only arrive here if one already exists.
 */
export function SharedMealAcceptHost() {
  const { addLoggedMealForDate } = useAppData();
  const { authedUserId } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);
  const mealShareUrlParam = searchParams.get("mealShare");
  const [payload, setPayload] = useState<MealSharePayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    const pendingToken = takePendingMealShare();
    const rawToken = mealShareUrlParam ?? pendingToken;
    if (rawToken == null) return;
    handledRef.current = true;
    if (mealShareUrlParam != null) {
      stripHomeQueryParams(router, pathname, searchParams, ["mealShare"]);
    }
    const token = normaliseMealShareToken(rawToken);
    if (!token) {
      toast.error("This share link isn't valid");
      return;
    }
    void (async () => {
      const lookup = await getMealShare(supabase, token);
      track(AnalyticsEvents.meal_share_link_opened, {
        status: lookup.status,
        authed: Boolean(authedUserId),
      });
      if (lookup.status === "ok") {
        setPayload(lookup.payload);
        setOpen(true);
        return;
      }
      const errorCopy: Record<Exclude<MealShareStatus, "ok">, string> = {
        invalid: "This share link isn't valid",
        expired: "This share link has expired",
        revoked: "This link was removed by its owner",
      };
      toast.error(errorCopy[lookup.status]);
    })();
  }, [mealShareUrlParam, router, pathname, searchParams, authedUserId]);

  /** The recipient confirmed: log every shared item into their own
   *  journal for the chosen day + slot. No `eatenAt` is carried (see
   *  `mealShareLink.ts` module doc) — each row anchors purely on
   *  `dayKey`. `timeLabel` mirrors the saved-meal re-log convention
   *  (`logSavedMeal` in `useMealLogging.ts`). */
  const onConfirm = useCallback(
    (dayKey: string, slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks") => {
      if (!payload) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      for (const item of payload.items) {
        addLoggedMealForDate(
          dayKey,
          shareItemToLoggableMeal(item, slot, timeLabel),
          "shared_meal",
        );
      }
      track(AnalyticsEvents.shared_meal_logged, {
        surface: "web_accept_dialog",
        itemCount: payload.items.length,
        slot,
      });
      toast.success("Added to your log");
      setOpen(false);
    },
    [payload, addLoggedMealForDate],
  );

  return (
    <SharedMealAcceptDialog
      open={open}
      onOpenChange={setOpen}
      payload={payload}
      onConfirm={onConfirm}
    />
  );
}
