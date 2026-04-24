#!/usr/bin/env node
/**
 * CI-safe guard: every flow listed in `.maestro/config.yaml` exists on disk,
 * and inline `runFlow: shared/*.yaml` references resolve.
 *
 * Does not run Maestro (no Simulator / JDK required).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const maestroDir = join(mobileRoot, ".maestro");
const configPath = join(maestroDir, "config.yaml");

function parseSuiteFlows(text) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim().startsWith("flowsOrder:"));
  if (i < 0) throw new Error("config.yaml: flowsOrder: not found");
  const flows = [];
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    const m = line.match(/^\s*-\s+(\S+)\s*$/);
    if (m && m[1].endsWith(".yaml")) {
      flows.push(m[1]);
      continue;
    }
    if (flows.length > 0 && line.trim() !== "" && !/^\s/.test(line)) break;
  }
  if (flows.length === 0) throw new Error("config.yaml: no flows under flowsOrder");
  return flows;
}

function collectSharedRunFlows(yamlText) {
  const refs = new Set();
  const re = /runFlow:\s+shared\/([\w.-]+\.yaml)/g;
  let m;
  while ((m = re.exec(yamlText)) !== null) {
    refs.add(`shared/${m[1]}`);
  }
  return [...refs];
}

function main() {
  if (!existsSync(configPath)) {
    console.error(`[verify-maestro-suite] Missing ${configPath}`);
    process.exit(1);
  }
  const configText = readFileSync(configPath, "utf8");
  const suiteFlows = parseSuiteFlows(configText);
  let failed = false;

  for (const name of suiteFlows) {
    const p = join(maestroDir, name);
    if (!existsSync(p)) {
      console.error(`[verify-maestro-suite] Suite lists ${name} but file is missing: ${p}`);
      failed = true;
      continue;
    }
    const body = readFileSync(p, "utf8");
    for (const shared of collectSharedRunFlows(body)) {
      const sp = join(maestroDir, shared);
      if (!existsSync(sp)) {
        console.error(`[verify-maestro-suite] ${name} references missing ${shared}`);
        failed = true;
      }
    }
  }

  const rootYamls = readdirSync(maestroDir).filter(
    (f) => f.endsWith(".yaml") && !f.startsWith(".") && f !== "config.yaml",
  );
  const suiteSet = new Set(suiteFlows);
  const orphans = rootYamls.filter((f) => !suiteSet.has(f));
  if (orphans.length) {
    console.log(
      `[verify-maestro-suite] Note: ${orphans.length} top-level flow(s) not in config.yaml suite (may be manual only): ${orphans.join(", ")}`,
    );
  }

  if (failed) process.exit(1);
  console.log(
    `[verify-maestro-suite] OK — ${suiteFlows.length} suite flow(s) on disk; shared runFlow references resolved.`,
  );
}

main();
