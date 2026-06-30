/**
 * Web Settings — "Export everything" button — 2026-04-30 user-sentiment
 * audit (lock-in anxiety counter).
 *
 * Source-level test (mounting Settings is heavy — see other
 * `settings*.test.ts` files for the same pattern). Confirms:
 *   - The button is present with its testid.
 *   - It delegates to the shared `downloadSupprExport` helper
 *     (`runFullExport`), which calls the server-authoritative
 *     `/api/export/me` endpoint — not the retired client-only path.
 *   - The trust copy ("Yours forever. Take your data anywhere.")
 *     is rendered.
 *   - The retired `buildLocalDataExport` / `downloadJsonFile`
 *     imports are gone (negative guard so the legacy path can't
 *     silently come back).
 *
 * ENG-1262: the inline fetch/blob logic moved into
 * `src/lib/client/exportEverythingWeb.ts` so the standalone row AND the
 * DeleteAccount "Download a copy first" action share ONE complete-archive
 * path. The endpoint + status-code handling are pinned in
 * `tests/unit/exportEverythingWeb.test.ts`; the helper file is asserted here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

const HELPER_PATH = resolve(
  __dirname,
  "../../src/lib/client/exportEverythingWeb.ts",
);
const HELPER_SRC = readFileSync(HELPER_PATH, "utf8");

describe("Web Settings — Export everything (2026-04-30 lock-in counter)", () => {
  it("renders the Export everything button with its testid", () => {
    expect(SRC).toMatch(/data-testid="settings-export-everything-button"/);
    expect(SRC).toMatch(/Export everything/);
  });

  it("delegates to the shared complete-archive helper", () => {
    // The button calls the shared `runFullExport` (→ `downloadSupprExport`),
    // not an inlined fetch. One path for the standalone row + the delete-flow
    // export-first action.
    expect(SRC).toMatch(/import \{ downloadSupprExport \} from/);
    expect(SRC).toMatch(/runFullExport/);
    expect(SRC).toMatch(/downloadSupprExport\(supabase\)/);
  });

  it("the shared helper hits the server-authoritative /api/export/me endpoint", () => {
    expect(HELPER_SRC).toMatch(/fetch\("\/api\/export\/me"/);
    // Auth header must travel with the call so cookie-less SPA sessions still
    // authenticate (the route falls back to cookies but bearer is canonical).
    expect(HELPER_SRC).toMatch(/Authorization:\s*`Bearer \${token}`/);
  });

  it("includes the trust copy", () => {
    expect(SRC).toMatch(/Yours forever\. Take your data anywhere/);
  });

  it("retires the legacy local export helpers", () => {
    // Negative guards — the retired import + the call sites must both be gone.
    expect(SRC).not.toMatch(/import\s*\{[^}]*buildLocalDataExport[^}]*\}\s*from/);
    expect(SRC).not.toMatch(/buildLocalDataExport\(\)/);
    expect(SRC).not.toMatch(/downloadJsonFile\(/);
  });

  it("the shared helper handles 429 and 401 status codes", () => {
    expect(HELPER_SRC).toMatch(/res\.status === 429/);
    expect(HELPER_SRC).toMatch(/once per minute/);
    expect(HELPER_SRC).toMatch(/res\.status === 401/);
    expect(HELPER_SRC).toMatch(/[Ss]ession expired/);
  });
});
