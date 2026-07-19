/**
 * ENG-1569 — self-test for the PostHog-host leak gate
 * (`scripts/check-posthog-proxy.mjs`).
 *
 * The original bug: the gate suppressed a URL match in the compiled client
 * bundle as "vendor-owned" whenever it was byte-identical to something found
 * by scanning the installed SDK package on disk. Because the SDK's own
 * default host is string-identical to our server-only DEFAULT_POSTHOG_HOST,
 * a real leak of the official host from our own code matched vendor source
 * too and passed silently.
 *
 * The fix: stop deriving the allowlist from vendor package contents, and
 * hardcode the small, finite set of strings the SDK is actually known to ship
 * (`https://app.posthog.com`, `https://us.posthog.com`,
 * `https://us.i.posthog.com`) — suppressing those three exact literals only.
 * The URL-literal scan otherwise stays ACTIVE on the compiled client bundle,
 * running alongside (not instead of) the server-only module-marker deny-list.
 * A first pass at this fix removed the URL scan entirely on this surface,
 * which regressed detection of any *other* direct host literal (e.g. a
 * misconfigured region) landing in client output through a path that never
 * touches either server-only module — see the last test in the first
 * `describe` block below, which pins that this stays caught.
 *
 * The script runs entirely at top level with filesystem side effects and reads
 * `process.cwd()` as its repo root, so this pins behaviour by running the real
 * script against hermetic synthetic repo trees (the subprocess pattern the
 * spacing/token/screen-budget self-tests use), not by importing it.
 *
 * What each case protects:
 *  1. The three known SDK-default literals pass on the bundle surface with no
 *     installed vendor package required to suppress against (hardcoded, not
 *     derived) — this is what the fix actually changed.
 *  2. Real-leak detection via the module-marker deny-list is intact.
 *  3. Source-side detection is untouched — a raw host literal in committed
 *     src/ source still fails (that arm never used vendor suppression).
 *  4. The three legitimate carve-outs the fix must preserve — serverTrack.ts,
 *     featureFlags.ts, and app/api/** holding the raw host — do NOT
 *     false-positive.
 *  5. A non-default host literal in the compiled bundle (not one of the three
 *     known SDK strings, and not routed through either server-only module)
 *     still fails — the regression a marker-only design would miss.
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

describe("check-posthog-proxy — ENG-1569 fix (hardcoded SDK-default allowlist, not vendor-derived)", () => {
  it("passes a client bundle carrying ONLY the SDK's known default host literals, with no installed vendor package required", () => {
    // The crux: under the old vendor-string suppression this tree FAILED (no
    // node_modules ⇒ empty known-string set ⇒ the literal was reported). The
    // fix hardcodes the known-string set instead of deriving it from disk, so
    // this now passes without needing node_modules present at all.
    const { status, output } = runGate({
      ".next/static/chunks/vendor.js": `var a="${OFFICIAL_HOST}";var b="https://us.posthog.com";var c="https://app.posthog.com";`,
    });
    expect(status).toBe(0);
    expect(output).toContain("OK: no direct PostHog host literal found");
  });

  it("still hard-fails on a non-default host literal in the compiled client bundle (the regression a marker-only gate would miss)", () => {
    // Not one of the three known SDK-default strings, and never routed
    // through DEFAULT_POSTHOG_HOST or system:killswitch — a marker-only gate
    // (an earlier version of this fix) would silently pass this. The
    // URL-literal scan staying active on this surface is what catches it.
    const { status, output } = runGate({
      ".next/static/chunks/vendor.js": 'var a="https://eu.i.posthog.com";',
    });
    expect(status).toBe(1);
    expect(output).toContain("eu.i.posthog.com");
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
