/**
 * ENG-1569 — self-test for the PostHog-host leak gate
 * (`scripts/check-posthog-proxy.mjs`).
 *
 * The ticket: the gate used to suppress a URL match in the compiled client
 * bundle as "vendor-owned" whenever it was byte-identical to something in the
 * installed SDK source. Because the SDK's own default host is string-identical
 * to our server-only DEFAULT_POSTHOG_HOST, a real leak of the official host
 * from ANY of our modules matched vendor source too and passed silently. The
 * fix: stop scanning the compiled client bundle for the URL literal at all, and
 * make the server-only module-marker deny-list the sole gate on that surface.
 *
 * The script runs entirely at top level with filesystem side effects and reads
 * `process.cwd()` as its repo root, so this pins behaviour by running the real
 * script against hermetic synthetic repo trees (the subprocess pattern the
 * spacing/token/screen-budget self-tests use), not by importing it.
 *
 * What each case protects:
 *  1. The ENG-1569 fix itself — a client bundle carrying ONLY the SDK's own
 *     host literal (and no server-only marker) passes, WITHOUT any installed
 *     vendor package to suppress against. Under the old code this exact tree
 *     failed (empty vendor set ⇒ nothing suppressed ⇒ the literal was flagged),
 *     so this test breaks if the fix is reverted.
 *  2. Real-leak detection is intact — a server-only module's distinctive marker
 *     appearing in the client bundle still hard-fails.
 *  3. Source-side detection is untouched — a raw host literal in committed
 *     src/ source still fails (that arm never used vendor suppression).
 *  4. The three legitimate carve-outs the fix must preserve — serverTrack.ts,
 *     featureFlags.ts, and app/api/** holding the raw host — do NOT
 *     false-positive.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "check-posthog-proxy.mjs");

// The official host, string-identical to what the SDK ships as its default and
// what serverTrack.ts's DEFAULT_POSTHOG_HOST intentionally reuses.
const OFFICIAL_HOST = "https://us.i.posthog.com";

const createdDirs: string[] = [];

/**
 * Build a hermetic repo tree, run the gate against it with cwd = that tree,
 * and return the exit status + combined output. The three `required` roots
 * (src, app, apps/mobile) are always created so the gate doesn't fail on a
 * "missing root" finding unrelated to what we're asserting.
 */
function runGate(files: Record<string, string>): { status: number; output: string } {
  const root = mkdtempSync(join(tmpdir(), "posthog-gate-"));
  createdDirs.push(root);

  for (const dir of ["src", "app", join("apps", "mobile")]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  // A benign placeholder in each required root so the walk has something to do.
  writeFileSync(join(root, "src", "placeholder.ts"), "export const ok = true;\n");
  writeFileSync(join(root, "app", "placeholder.ts"), "export const ok = true;\n");
  writeFileSync(join(root, "apps", "mobile", "placeholder.ts"), "export const ok = true;\n");

  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  try {
    const stdout = execFileSync("node", [SCRIPT], { cwd: root, encoding: "utf8" });
    return { status: 0, output: stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

afterAll(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

describe("check-posthog-proxy — ENG-1569 fix (compiled client bundle no longer URL-scanned)", () => {
  it("passes a client bundle carrying ONLY the SDK's own host literal, with no vendor package to suppress against", () => {
    // The crux: under the old vendor-string suppression this tree FAILED (no
    // node_modules ⇒ empty known-string set ⇒ the literal was reported). The
    // fix skips URL scanning on this surface entirely, so it now passes.
    const { status, output } = runGate({
      ".next/static/chunks/vendor.js": `var a="${OFFICIAL_HOST}";var b="https://us.posthog.com";`,
    });
    expect(status).toBe(0);
    expect(output).toContain("OK: no direct PostHog host literal found");
  });

  it("still hard-fails when a server-only module marker leaks into the client bundle (real leak)", () => {
    const { status, output } = runGate({
      ".next/static/chunks/leak.js": "var host=DEFAULT_POSTHOG_HOST;",
    });
    expect(status).toBe(1);
    expect(output).toContain("DEFAULT_POSTHOG_HOST");
    expect(output).toContain("src/lib/analytics/serverTrack.ts");
    expect(output).toContain("bundled into the client");
  });

  it("still hard-fails on the featureFlags killswitch marker leaking into the client bundle", () => {
    const { status, output } = runGate({
      ".next/static/chunks/leak.js": 'var f="system:killswitch";',
    });
    expect(status).toBe(1);
    expect(output).toContain("system:killswitch");
    expect(output).toContain("src/lib/server/featureFlags.ts");
  });
});

describe("check-posthog-proxy — committed source detection stays intact", () => {
  it("fails when a raw PostHog host literal appears in committed src/ source", () => {
    const { status, output } = runGate({
      "src/lib/analytics/badClient.ts": `export const host = "${OFFICIAL_HOST}";`,
    });
    expect(status).toBe(1);
    expect(output).toContain("src/lib/analytics/badClient.ts");
    expect(output).toContain(OFFICIAL_HOST);
  });

  it("fails when a raw PostHog host literal appears in committed app/ source", () => {
    const { status } = runGate({
      "app/components/BadWidget.tsx": `const h = "${OFFICIAL_HOST}";`,
    });
    expect(status).toBe(1);
  });
});

describe("check-posthog-proxy — the three legitimate carve-outs do NOT false-positive", () => {
  it("does not flag serverTrack.ts holding the raw host as its own default", () => {
    const { status } = runGate({
      "src/lib/analytics/serverTrack.ts": `export const DEFAULT_POSTHOG_HOST = "${OFFICIAL_HOST}";`,
    });
    expect(status).toBe(0);
  });

  it("does not flag featureFlags.ts holding the raw host", () => {
    const { status } = runGate({
      "src/lib/server/featureFlags.ts": `const host = "${OFFICIAL_HOST}"; // system:killswitch`,
    });
    expect(status).toBe(0);
  });

  it("does not flag an app/api/** route holding the raw host (server-only by framework convention)", () => {
    const { status } = runGate({
      "app/api/ingest/route.ts": `export const host = "${OFFICIAL_HOST}";`,
    });
    expect(status).toBe(0);
  });

  it("passes a clean repo with no PostHog host literal anywhere", () => {
    const { status, output } = runGate({});
    expect(status).toBe(0);
    expect(output).toContain("OK: no direct PostHog host literal found");
  });
});
