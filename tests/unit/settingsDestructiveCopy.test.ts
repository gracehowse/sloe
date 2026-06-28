/**
 * Settings — humane destructive-zone copy + visual ladder
 * (audit 2026-04-30 P0-4 + P1-6).
 *
 * Two related fixes:
 *
 *   P0-4 — three destructive rows used to share one red plate, which
 *          made the reversible "Delete local data & sign out" read as
 *          catastrophic next to permanent account deletion. The new
 *          ladder:
 *            - Erase everything   → amber (warning)
 *            - Delete local data  → neutral (reversible)
 *            - Delete account     → destructive (red, irreversible)
 *
 *   P1-6 — the Erase confirm dialog used to recite a long inventory of
 *          everything the user was about to lose ("food log, journal,
 *          library saves, shopping lists, imported recipes, synced
 *          activity, … this cannot be undone"), which read as shame
 *          energy. The calm copy points at the recovery path
 *          ("re-import from your export") and lists categories
 *          lowercase so the user can still see what's affected.
 *
 * The tests below source-check the new copy strings + the absence of
 * the retired red-50 / red-950 Tailwind hardcodes. Drift in any
 * direction will fail this suite.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");
// 2026-06-23 (ENG-1225 gap #24): the modal cluster — including the Erase
// confirm dialog + its calm copy/ledger — moved to settings/SettingsDialogs.tsx
// when Settings was split for the two-pane layout. The destructive-row BUTTONS
// (the visual ladder) stay in Settings.tsx; only the dialog COPY relocated.
const DIALOGS_PATH = resolve(
  __dirname,
  "../../src/app/components/settings/SettingsDialogs.tsx",
);
const DIALOGS_SRC = readFileSync(DIALOGS_PATH, "utf8");

describe("Settings — destructive ladder colour tokens (P0-4)", () => {
  it("removes the legacy red-50 / red-950 Tailwind hardcodes", () => {
    // Negative guards — the three rows used to share `bg-red-50
    // dark:bg-red-950/20 text-red-{600,700} dark:text-red-{300,400}`.
    // Tokens are now warning / muted / destructive.
    expect(SRC).not.toMatch(/bg-red-50\b/);
    expect(SRC).not.toMatch(/dark:bg-red-950\b/);
    expect(SRC).not.toMatch(/text-red-(?:600|700|400|300)\b/);
  });

  it("Erase everything sits on the warning plate (amber)", () => {
    expect(SRC).toMatch(
      /data-testid="settings-erase-everything-button"[\s\S]{0,500}?bg-warning\/10[\s\S]{0,500}?border-warning\/30/,
    );
  });

  it("Delete local data & sign out sits on the neutral plate", () => {
    // Reversible action — must read as a normal grey row, not red.
    expect(SRC).toMatch(
      /data-testid="settings-clear-local-button"[\s\S]{0,500}?bg-muted\b/,
    );
  });

  it("Delete account permanently is the only row using the destructive token", () => {
    expect(SRC).toMatch(
      /data-testid="settings-delete-account-button"[\s\S]{0,500}?bg-destructive\/10[\s\S]{0,500}?text-destructive[\s\S]{0,500}?border-destructive\/30/,
    );
  });

  it("Delete-local-data row carries the recovery hint", () => {
    expect(SRC).toContain(
      "Reversible — sign back in and your data syncs from the server.",
    );
  });
});

describe("Settings — Erase Everything confirm copy (P1-6, calm rewrite)", () => {
  it("title points at recovery, not shame", () => {
    expect(DIALOGS_SRC).toContain('title="Delete your data and start fresh?"');
  });

  it("body opens with the recovery path before the inventory", () => {
    expect(DIALOGS_SRC).toContain(
      "You can re-import from your export file anytime.",
    );
  });

  it("body lists affected + kept categories as scannable bullets (2026-05-12 DC9 polish)", () => {
    // Pre-2026-05-12 the body was a single paragraph
    // ("Affects: food log, journal, library saves, …"). Linear's
    // pattern for destructive confirms is ✓/✗ bullets so the user
    // can verify at a glance which things go and which stay. The
    // categories still all appear by label (now in the ERASE_LEDGER
    // array in SettingsDialogs.tsx).
    expect(DIALOGS_SRC).toContain('label: "Food log"');
    expect(DIALOGS_SRC).toContain('label: "Daily journal"');
    expect(DIALOGS_SRC).toContain('label: "Library saves"');
    expect(DIALOGS_SRC).toContain('label: "Shopping lists"');
    expect(DIALOGS_SRC).toContain('label: "Imported recipes"');
    expect(DIALOGS_SRC).toContain('label: "Synced activity"');
    expect(DIALOGS_SRC).toContain('label: "Your account"');
    expect(DIALOGS_SRC).toContain('label: "Subscription"');
  });

  it("retires the legacy shame-energy phrasing", () => {
    expect(DIALOGS_SRC).not.toContain('title="Erase everything?"');
    expect(DIALOGS_SRC).not.toContain(
      "This will permanently delete your food log, journal",
    );
  });

  it("retires the legacy single-paragraph affects string (2026-05-12 DC9 polish)", () => {
    // Negative guard — the prior `description=` paragraph form
    // ("Affects: food log, journal, …") was replaced with structured
    // bullets in a JSX description.
    expect(DIALOGS_SRC).not.toContain(
      'description="You can re-import from your export file anytime. Affects:',
    );
  });

  it("confirm button label keeps the imperative 'Erase everything'", () => {
    // The button still has to say what it does — only the dialog title
    // / body softened. Mirrors mobile.
    expect(DIALOGS_SRC).toContain('confirmLabel="Erase everything"');
  });
});

describe("Settings — barcode contribution withdrawal", () => {
  // The withdrawal UI was extracted into its own component (ENG-717 screen
  // budget); Settings mounts it, the component owns the fetch/delete logic.
  const BARCODE_SECTION_SRC = readFileSync(
    resolve(__dirname, "../../src/app/components/settings/BarcodeContributionsSection.tsx"),
    "utf8",
  );
  it("mounts the withdrawal section from Settings", () => {
    expect(SRC).toContain("<BarcodeContributionsSection");
  });
  it("surfaces a managed withdrawal path in Privacy & Security", () => {
    expect(BARCODE_SECTION_SRC).toContain("settings-barcode-contributions-row");
    expect(BARCODE_SECTION_SRC).toContain("BARCODE_CONTRIBUTIONS_SETTINGS_LABEL");
    expect(BARCODE_SECTION_SRC).toContain("/api/user-foods?mine=1&limit=25");
    expect(BARCODE_SECTION_SRC).toContain('method: "DELETE"');
    expect(BARCODE_SECTION_SRC).toMatch(/\/api\/user-foods\?id=/);
  });
});

describe("Settings — page header (P1-5)", () => {
  it("strips the leftover bg-clip-text / text-transparent classes from the H1", () => {
    // `<h1 className="text-foreground bg-clip-text text-transparent">`
    // had no gradient set — it was a remnant. The audit cleaned it to
    // a plain text-foreground heading.
    expect(SRC).not.toMatch(/<h1[^>]*bg-clip-text/);
    expect(SRC).not.toMatch(/<h1[^>]*text-transparent/);
    expect(SRC).toMatch(
      /<h1 className="font-\[family-name:var\(--font-headline\)\][^"]*text-foreground-brand"[^>]*>Settings<\/h1>/,
    );
  });

  it("page-header cog sits on a plum-tinted Sloe plate, not bg-primary/30 or grey bg-muted", () => {
    // History: the cog plate started as `bg-primary/30` (stuck out),
    // was flattened to `bg-muted` in the 2026-04-30 audit, then moved
    // to the Sloe DS plum-tinted plate in the Settings reskin (Figma 09
    // Settings `335:2`) so the glyph reads in step with the plum serif
    // title instead of as orphaned grey chrome. The plate fill is
    // `--foreground-brand` at 10% and the glyph ink is the same token.
    expect(SRC).not.toMatch(/p-2 bg-primary\/30 rounded-xl/);
    expect(SRC).not.toMatch(/p-2 bg-muted rounded-xl/);
    // Plate: plum at 10% via color-mix on --foreground-brand.
    expect(SRC).toMatch(
      /color-mix\(in srgb, var\(--foreground-brand\) 10%, transparent\)/,
    );
    // Glyph: the settings cog inks in the plum brand token.
    expect(SRC).toMatch(
      /<Icons\.settings[\s\S]*?color: "var\(--foreground-brand\)"/,
    );
  });
});
