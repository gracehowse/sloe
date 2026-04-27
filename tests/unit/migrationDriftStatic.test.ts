/**
 * P1-11 (2026-04-25) — verify the static-mode CI gate works:
 *   - Runs `npm run check:migrations:static` over the real
 *     `supabase/migrations/` directory and asserts exit 0.
 *   - Runs the same script over a temp dir with a deliberately-broken
 *     migration set (duplicate timestamp, malformed name) and asserts
 *     exit 1 + the expected error strings on stderr.
 *
 * This covers the actual CI path. The full drift comparison (vs the
 * linked Supabase project) needs CLI auth and stays a local / scheduled
 * task — separate from this test.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");

function runStatic(migrationsDir: string | null): { status: number; stdout: string; stderr: string } {
  const args = ["--import", "tsx", join(REPO, "scripts/check-migration-drift.ts"), "--static"];
  if (migrationsDir) args.push("--migrations-dir", migrationsDir);
  const proc = spawnSync("node", args, {
    // Always run from the repo root so `tsx` resolves; the migrations
    // directory is targeted via the explicit flag.
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return { status: proc.status ?? -1, stdout: proc.stdout, stderr: proc.stderr };
}

describe("check:migrations --static", () => {
  it("exits 0 against the real supabase/migrations directory", () => {
    const result = runStatic(null);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/migration files — all well-formed and unique/);
  });

  describe("synthetic broken-set fixtures", () => {
    let tempRoot: string;

    afterEach(() => {
      if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    });

    function makeFixtureDir(files: Record<string, string>): string {
      tempRoot = mkdtempSync(join(tmpdir(), "suppr-migrations-"));
      const dir = join(tempRoot, "supabase", "migrations");
      mkdirSync(dir, { recursive: true });
      for (const [name, body] of Object.entries(files)) {
        writeFileSync(join(dir, name), body);
      }
      return dir;
    }

    it("exits 1 on duplicate timestamps", () => {
      const dir = makeFixtureDir({
        "20260101000000_alpha.sql": "-- a",
        "20260101000000_beta.sql": "-- b",
      });
      const result = runStatic(dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Duplicate timestamp 20260101000000/);
    });

    it("exits 1 on malformed filenames", () => {
      const dir = makeFixtureDir({
        "20260101000000_ok.sql": "-- ok",
        "not-a-migration.sql": "-- broken",
      });
      const result = runStatic(dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Malformed migration filename: not-a-migration\.sql/);
    });

    it("exits 1 on duplicate migration names with different timestamps", () => {
      const dir = makeFixtureDir({
        "20260101000000_widgets.sql": "-- a",
        "20260102000000_widgets.sql": "-- b",
      });
      const result = runStatic(dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Duplicate migration name 'widgets'/);
    });

    it("exits 0 on a clean fixture", () => {
      const dir = makeFixtureDir({
        "20260101000000_first.sql": "-- a",
        "20260102000000_second.sql": "-- b",
      });
      const result = runStatic(dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/2 migration files — all well-formed and unique/);
    });
  });
});
