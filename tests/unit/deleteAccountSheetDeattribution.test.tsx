// @vitest-environment jsdom
/**
 * DeleteAccountSheet de-attribution disclosure (web) — ENG-1263.
 *
 * The removal ledger lists what is HARD-DELETED. Recipes the user published
 * are NOT destroyed by the delete route — they survive de-attributed
 * (`author_id = null`, GDPR Art. 17 de-identification). Bundling them into the
 * red-✕ "removed" list over-promised deletion — a trust gap for privacy-
 * motivated deleters. This test pins the honest carve-out on the live web
 * surface:
 *   1. Step 2 renders the de-attribution footnote (exact SSOT wording).
 *   2. The footnote names the published-recipes survival + de-attribution +
 *      "everything else deleted" honestly.
 *   3. The ledger row label reads "saved recipes & drafts" (NOT "saved &
 *      created"), so a published-recipe count is never implied as removed.
 *
 * Mobile parity (RN can't render in jsdom) is pinned at source level in
 * `tests/unit/deleteAccountFlow.test.ts` (both sheets import the SSOT constant
 * + the shared `testID`).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DeleteAccountSheet } from "../../src/app/components/settings/DeleteAccountSheet";
import {
  DELETE_ACCOUNT_DEATTRIBUTION_NOTE,
  formatDeleteAccountLedgerRows,
} from "../../src/lib/settings/deleteAccountFlow";

void React;

function renderSheet() {
  // Ledger reflects ONLY hard-deleted recipes (3 drafts + saves). The user also
  // has published recipes that survive — they are not in this count by design.
  const ledger = formatDeleteAccountLedgerRows({
    diaryEntries: 12,
    recipes: 3, // saved + unpublished drafts only
    weightDays: 4,
    inHousehold: false,
  });
  return render(
    <DeleteAccountSheet
      open
      onOpenChange={vi.fn()}
      ledger={ledger}
      onExportFirst={vi.fn()}
      onDeleteForever={vi.fn()}
    />,
  );
}

describe("DeleteAccountSheet de-attribution disclosure (web) — ENG-1263", () => {
  it("renders the de-attribution footnote on step 2 with the exact SSOT wording", () => {
    renderSheet();
    // Sheet opens on step 1 — advance to the ledger step.
    fireEvent.click(screen.getByText("Continue"));

    const note = screen.getByTestId("delete-account-deattribution-note");
    expect(note.textContent).toBe(DELETE_ACCOUNT_DEATTRIBUTION_NOTE);
    // The carve-out must be unmistakable: published recipes survive, name
    // removed, everything else deleted.
    expect(note.textContent).toMatch(/published.*stay public/i);
    expect(note.textContent).toMatch(/remove your name/i);
    expect(note.textContent).toMatch(/deleted for good/i);
  });

  it("frames the removed recipes row as 'saved recipes & drafts' (not 'created')", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Continue"));

    // 3 hard-deleted recipes (saved + drafts). The published-survival wording
    // is carried by the footnote, never implied by this row.
    expect(screen.getByText("3 saved recipes & drafts")).toBeTruthy();
    expect(screen.queryByText(/saved & created/i)).toBeNull();
  });

  it("does not show the footnote before reaching the ledger step", () => {
    renderSheet();
    // Still on step 1 (reasons) — the footnote belongs under the ledger only.
    expect(screen.queryByTestId("delete-account-deattribution-note")).toBeNull();
  });
});
