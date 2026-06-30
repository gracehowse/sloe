/**
 * DeleteAccount 3-step sheet (ENG-1260 / B26).
 * Prototype: `docs/ux/redesign/v3/Sloe-App.html` `DeleteAccount` (~L5942–5982).
 */
export const DELETE_ACCOUNT_SHEET_FLAG = "delete_account_sheet_v1";

export const DELETE_ACCOUNT_CONFIRM_TOKEN = "DELETE";

export const DELETE_ACCOUNT_LEAVE_REASONS = [
  "Taking a break",
  "Found another app",
  "Privacy concerns",
  "Too expensive",
  "Other",
] as const;

export type DeleteAccountLeaveReason = (typeof DELETE_ACCOUNT_LEAVE_REASONS)[number];

export const DELETE_ACCOUNT_COPY = {
  title: "Delete account",
  step1: {
    heading: "Why are you leaving?",
    sub: "Optional, but it genuinely helps us improve.",
  },
  step2: {
    heading: "This can't be undone",
    body: "Deleting your account permanently removes your diary, recipes, plans and history. Want a copy first?",
    // ENG-1262 (2026-06-29): this button now runs the COMPLETE
    // server-authoritative archive (`/api/export/me` — profile, recipes,
    // meal log, weights, plans, custom foods, saved meals, notes), replacing
    // the meal-log-only CSV the ENG-1260 interim hedge wrapped. "Download a
    // copy first" stays — it's accurate, low-friction wording for a download
    // affordance on a destructive flow, and now backed by a full archive.
    exportFirst: "Download a copy first",
  },
  step3: {
    bodyPrefix: "Type",
    // Legal review (ENG-1260): name the destructive action at the point of no
    // return rather than relying on the user recalling step 2.
    bodySuffix: "to permanently delete your account. This can't be undone.",
    placeholder: "DELETE",
  },
  keepAccount: "Keep my account",
  continue: "Continue",
  deleteForever: "Delete forever",
} as const;

/**
 * De-attribution disclosure footnote (ENG-1263, legal-approved 2026-06-29).
 *
 * The removal ledger lists what is HARD-DELETED. But recipes you published
 * survive — the delete route only sets `author_id = null` (GDPR Art. 17
 * de-identification erasure), it does NOT destroy the published recipe.
 * Bundling published recipes into the red-✕ "removed" list over-promised
 * deletion — a trust gap for privacy-motivated deleters. This note carves out
 * the exception honestly, beneath the terse ledger, in calm Sloe voice.
 *
 * Rendered by BOTH the web (`src/app/components/settings/DeleteAccountSheet.tsx`)
 * and mobile (`apps/mobile/components/settings/DeleteAccountSheet.tsx`) sheets
 * from this single SSOT so the wording can never drift between platforms.
 *
 * Path A (de-attribution stays — Path B hard-delete rejected by legal): the
 * fix is clarity, not changing the deletion behaviour. See ENG-1263.
 */
export const DELETE_ACCOUNT_DEATTRIBUTION_NOTE =
  "Recipes you've published stay public, but we remove your name from them. " +
  "Anyone who saved or cooked them keeps their copy. Everything else here is deleted for good.";

export interface DeleteAccountLedgerRow {
  id: string;
  label: string;
}

/**
 * Format ledger rows with live counts when available.
 *
 * `recipes` is the count of recipes that are HARD-DELETED: saved recipes
 * (`saves`) plus unpublished authored drafts (`recipes WHERE author_id = user
 * AND published = false`). Published authored recipes are NOT included — they
 * survive de-attributed (`author_id = null`) and are covered by
 * `DELETE_ACCOUNT_DEATTRIBUTION_NOTE` instead. See ENG-1263 / the delete route
 * (`app/api/account/delete/route.ts` steps 3 + 4).
 */
export function formatDeleteAccountLedgerRows(counts: {
  diaryEntries: number | null;
  recipes: number | null;
  weightDays: number | null;
  inHousehold: boolean | null;
}): DeleteAccountLedgerRow[] {
  const diary =
    counts.diaryEntries != null
      ? `${counts.diaryEntries} diary entr${counts.diaryEntries === 1 ? "y" : "ies"}`
      : "Food diary entries";
  const recipes =
    counts.recipes != null
      ? `${counts.recipes} saved recipe${counts.recipes === 1 ? "" : "s"} & drafts`
      : "Saved recipes & drafts";
  const weight =
    counts.weightDays != null
      ? `${counts.weightDays} day${counts.weightDays === 1 ? "" : "s"} of weight history`
      : "Weight & body history";
  const household =
    counts.inHousehold === true
      ? "Your household membership"
      : counts.inHousehold === false
        ? null
        : "Household membership (if any)";

  const rows: DeleteAccountLedgerRow[] = [
    { id: "diary", label: diary },
    { id: "recipes", label: recipes },
    { id: "weight", label: weight },
  ];
  if (household) rows.push({ id: "household", label: household });
  return rows;
}
