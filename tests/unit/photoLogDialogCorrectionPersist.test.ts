/**
 * Web parity test for the photo-log corrections-persist wiring (round
 * 4 user-sentiment audit, 2026-04-30 — Cal AI's failure pattern).
 *
 * Pins that `src/app/components/suppr/photo-log-dialog.tsx` calls the
 * cross-platform `persistPhotoCorrections` helper at commit time —
 * the SAME wiring exercised by the mobile `PhotoLogSheet` test under
 * `apps/mobile/tests/unit/photoLogCorrectionPersistWiring.test.ts`.
 * If either platform drifts (e.g. someone refactors web away from
 * the helper) this test goes red.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIALOG_PATH = resolve(
  __dirname,
  "../../src/app/components/suppr/photo-log-dialog.tsx",
);
const DIALOG_SRC = readFileSync(DIALOG_PATH, "utf8");

describe("PhotoLogDialog (web) — corrections persist wiring (round 4)", () => {
  it("imports the cross-platform persistence helper", () => {
    expect(DIALOG_SRC).toMatch(
      /import\s*\{\s*persistPhotoCorrections\s*\}\s*from\s+["'][^"']*photoCorrectionPersist["']/,
    );
  });

  it("snapshots originals on review entry (mirror of mobile)", () => {
    expect(DIALOG_SRC).toMatch(/originalItemsRef\.current\s*=\s*cleaned\.map/);
  });

  it("calls persistPhotoCorrections at commit time", () => {
    expect(DIALOG_SRC).toMatch(/persistPhotoCorrections\s*\(\s*\{/);
  });

  it("uses a localStorage flag to gate the one-time confirmation toast", () => {
    expect(DIALOG_SRC).toMatch(/PHOTO_CORRECTION_TOAST_KEY/);
    expect(DIALOG_SRC).toMatch(/localStorage\?\.getItem\(\s*PHOTO_CORRECTION_TOAST_KEY/);
    expect(DIALOG_SRC).toMatch(/localStorage\?\.setItem\(\s*PHOTO_CORRECTION_TOAST_KEY/);
  });

  it("uses sonner toast.success for the confirmation", () => {
    expect(DIALOG_SRC).toMatch(/toast\.success\(/);
  });

  it("the persistence call is fire-and-forget", () => {
    expect(DIALOG_SRC).toMatch(/void\s*\(\s*async\s*\(\s*\)\s*=>/);
  });

  it("guards on a resolved auth user (skips when signed-out)", () => {
    expect(DIALOG_SRC).toMatch(/supabase\.auth\.getUser/);
  });
});
