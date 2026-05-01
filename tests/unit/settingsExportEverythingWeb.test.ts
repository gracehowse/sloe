/**
 * Web Settings — "Export everything" button — 2026-04-30 user-sentiment
 * audit (lock-in anxiety counter).
 *
 * Source-level test (mounting Settings is heavy — see other
 * `settings*.test.ts` files for the same pattern). Confirms:
 *   - The button is present with its testid.
 *   - It calls the new server-authoritative `/api/export/me`
 *     endpoint, not the retired client-only path.
 *   - The trust copy ("Yours forever. Take your data anywhere.")
 *     is rendered.
 *   - The retired `buildLocalDataExport` / `downloadJsonFile`
 *     imports are gone (negative guard so the legacy path can't
 *     silently come back).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Web Settings — Export everything (2026-04-30 lock-in counter)", () => {
  it("renders the Export everything button with its testid", () => {
    expect(SRC).toMatch(/data-testid="settings-export-everything-button"/);
    expect(SRC).toMatch(/Export everything/);
  });

  it("hits the server-authoritative /api/export/me endpoint", () => {
    expect(SRC).toMatch(/fetch\("\/api\/export\/me"/);
    // Auth header must travel with the call so cookie-less SPA
    // sessions still authenticate (the route falls back to cookies
    // but bearer is the canonical path).
    expect(SRC).toMatch(/Authorization:\s*`Bearer \${token}`/);
  });

  it("includes the trust copy", () => {
    expect(SRC).toMatch(/Yours forever\. Take your data anywhere/);
  });

  it("retires the legacy local export helpers", () => {
    // Negative guards — the retired import + the call sites must
    // both be gone.
    expect(SRC).not.toMatch(/import\s*\{[^}]*buildLocalDataExport[^}]*\}\s*from/);
    expect(SRC).not.toMatch(/buildLocalDataExport\(\)/);
    expect(SRC).not.toMatch(/downloadJsonFile\(/);
  });

  it("handles 429 with a slow-down toast", () => {
    expect(SRC).toMatch(/res\.status === 429/);
    expect(SRC).toMatch(/once per minute/);
  });

  it("handles 401 with a session-expired toast", () => {
    expect(SRC).toMatch(/res\.status === 401/);
    expect(SRC).toMatch(/[Ss]ession expired/);
  });
});
