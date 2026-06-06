#!/usr/bin/env node
/**
 * Fails when stray per-app env files exist — use repo-root `.env.local` only.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./load-repo-env-local.mjs";

const stray = [
  join(REPO_ROOT, "apps/mobile/.env.local"),
  join(REPO_ROOT, "apps/mobile/.env"),
];

let ok = true;
if (!existsSync(join(REPO_ROOT, ".env.local"))) {
  console.warn("[env:doctor] warn: repo root .env.local is missing (copy from .env.example)");
}

for (const p of stray) {
  if (existsSync(p)) {
    console.error(`[env:doctor] fail: remove ${p.replace(REPO_ROOT + "/", "")} — use repo root .env.local only`);
    ok = false;
  }
}

if (!ok) {
  console.error("[env:doctor] See docs/environment.md § Local development");
  process.exit(1);
}

console.log("[env:doctor] ok — single canonical .env.local at repo root");
