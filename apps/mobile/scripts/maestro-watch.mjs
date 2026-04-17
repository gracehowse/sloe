#!/usr/bin/env node
/**
 * Maestro does not support `--continuous` when running a multi-flow workspace (config.yaml).
 * This script watches all `.yaml` files under `.maestro` and re-runs the full suite (same as `npm run test:e2e`).
 */
import { watch } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const maestroDir = join(mobileRoot, ".maestro");
const runner = join(__dirname, "run-maestro-e2e.mjs");

function runSuite() {
  const r = spawnSync(process.execPath, [runner], {
    cwd: mobileRoot,
    stdio: "inherit",
    env: process.env,
  });
  return r.status ?? 1;
}

/** Attach one `fs.watch` per YAML file (portable; avoids `recursive` Linux limits). */
function watchYamlTree(dir, onChange) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      watchYamlTree(p, onChange);
    } else if (name.endsWith(".yaml")) {
      watch(p, () => onChange(p));
    }
  }
}

let debounce;
function scheduleRun(changedPath) {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`\n[maestro-watch] Change: ${changedPath.replace(mobileRoot + "/", "")} — re-running suite…\n`);
    runSuite();
  }, 800);
}

console.log("[maestro-watch] Watching .maestro/**/*.yaml — initial run…\n");
runSuite();

watchYamlTree(maestroDir, scheduleRun);

console.log("\n[maestro-watch] Waiting for edits (Ctrl+C to stop).\n");
