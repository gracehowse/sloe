/**
 * ENG-1642 — the web "Share meal" action body (link-or-text), extracted
 * from `today-meals-section.tsx` so the pinned section file shrinks
 * instead of growing (screen-line-budget ratchet, ENG-717). Mirrors
 * mobile's `shareJournalMeal` split in `apps/mobile/lib/mealShare.ts`.
 *
 * `shareUrl === null` (flag off, no host callback, or link-create
 * failure) keeps the exact pre-ENG-1642 text-only share/copy behaviour —
 * only the `mode` analytics prop is new on that path.
 */
import { toast } from "sonner";
import { track } from "../analytics/track.ts";

/** Navigate to Settings → Privacy with "My shared links" expanded. */
export function openMealSharedLinksManager(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/settings?pane=privacy&mealSharedLinks=1";
}

export async function shareMealTextOrLink(opts: {
  title: string;
  message: string;
  shareUrl: string | null;
  /** True when a link create was ATTEMPTED before calling (flag on, host
   *  callback present) — regardless of whether it succeeded. The Safari
   *  user-activation rescue keys on this, because the activation-losing
   *  `await` happens on the attempt, not only on success. */
  linkAttempted: boolean;
  surface: string;
}): Promise<void> {
  const { title, message, shareUrl, linkAttempted, surface } = opts;
  const mode: "link" | "text" = shareUrl ? "link" : "text";
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(
        shareUrl ? { title, text: message, url: shareUrl } : { title, text: message },
      );
      track("meal_share_invoked", { surface, outcome: "shared", mode });
      if (shareUrl) {
        toast.success("Share link created", {
          action: {
            label: "Manage",
            onClick: openMealSharedLinksManager,
          },
        });
      }
      return;
    } catch (err) {
      const errName = (err as Error)?.name;
      // Safari can lose user-activation between the async link-create
      // `await` (before this helper is called) and `navigator.share()`,
      // throwing NotAllowedError even though the user did tap the menu
      // item. Any ATTEMPTED link create has that async gap — including a
      // failed one — so the rescue keys on `linkAttempted`, falling back
      // to the clipboard write below instead of an error toast. The
      // no-attempt text-only path stays byte-identical to pre-ENG-1642.
      if (!(linkAttempted && errName === "NotAllowedError")) {
        track("meal_share_invoked", {
          surface,
          outcome: errName === "AbortError" ? "dismissed" : "error",
          mode,
        });
        return;
      }
    }
  }
  const clipboardText = shareUrl ? `${message}\n${shareUrl}` : message;
  try {
    await navigator.clipboard.writeText(clipboardText);
    toast.success(shareUrl ? "Share link copied" : "Meal copied to clipboard", shareUrl
      ? {
          action: {
            label: "Manage",
            onClick: openMealSharedLinksManager,
          },
        }
      : undefined);
    track("meal_share_invoked", { surface, outcome: "shared", mode });
  } catch {
    toast.error("Couldn't copy meal");
    track("meal_share_invoked", { surface, outcome: "error", mode });
  }
}
