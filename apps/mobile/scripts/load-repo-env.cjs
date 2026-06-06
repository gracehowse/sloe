/**
 * Load monorepo-root `.env.local` before Expo / Metro read `EXPO_PUBLIC_*`.
 * See docs/environment.md — do not add apps/mobile/.env.local.
 */
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const repoEnvLocal = path.resolve(__dirname, "../../..", ".env.local");

if (existsSync(repoEnvLocal)) {
  for (const line of readFileSync(repoEnvLocal, "utf8").split("\n")) {
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
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
