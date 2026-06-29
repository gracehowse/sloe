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
    // Legal review (ENG-1260, 2026-06-29): "Export my data first" overstated
    // completeness — the export is best-effort, not a guaranteed full archive.
    // "Download a copy first" is the honest framing until a server-side export
    // endpoint lands (see ENG follow-up). Deliberate divergence from the v3
    // prototype's wording for data-rights correctness on a destructive flow.
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

export interface DeleteAccountLedgerRow {
  id: string;
  label: string;
}

/** Format ledger rows with live counts when available. */
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
      ? `${counts.recipes} saved & created recipe${counts.recipes === 1 ? "" : "s"}`
      : "Saved & created recipes";
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
