/**
 * Load repo-root `.env.local` into `process.env` (does not override existing).
 * Canonical env file for the monorepo — see docs/environment.md.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..");
export const REPO_ENV_LOCAL_PATH = join(REPO_ROOT, ".env.local");

/** @returns {Record<string, string>} */
export function parseEnvFile(absPath) {
  const out = {};
  if (!existsSync(absPath)) return out;
  const raw = readFileSync(absPath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let key = t.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * @param {{ override?: boolean }} [opts]
 * @returns {boolean} true when file existed and was parsed
 */
export function loadRepoEnvLocal(opts = {}) {
  const vars = parseEnvFile(REPO_ENV_LOCAL_PATH);
  if (Object.keys(vars).length === 0) return false;
  for (const [key, val] of Object.entries(vars)) {
    if (opts.override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return true;
}
