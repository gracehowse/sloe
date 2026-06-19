#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const limit = Number(process.env.SCREEN_LINE_COUNT_LIMIT ?? "400");
const allowlistPath = resolve(
  repoRoot,
  process.env.SCREEN_LINE_COUNT_ALLOWLIST ?? "scripts/screen-line-count-allowlist.json",
);
const roots = (process.env.SCREEN_LINE_COUNT_ROOTS ?? "apps/mobile/app,apps/mobile/components,src/app/components")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);

function gitFilesUnder(root) {
  try {
    return execFileSync("git", ["ls-files", root], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .filter((file) => [...exts].some((ext) => file.endsWith(ext)));
  } catch (error) {
    console.error(`Unable to enumerate tracked files under ${root}:`, error.message);
    process.exit(2);
  }
}

function countLines(file) {
  const contents = readFileSync(resolve(repoRoot, file), "utf8");
  if (contents.length === 0) return 0;
  return contents.endsWith("\n") ? contents.split("\n").length - 1 : contents.split("\n").length;
}

const files = [...new Set(roots.flatMap(gitFilesUnder))].sort();
const allowlist = existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, "utf8")) : {};
const actual = Object.fromEntries(files.map((file) => [file, countLines(file)]));
const failures = [];

for (const [file, allowed] of Object.entries(allowlist)) {
  if (!(file in actual)) continue;
  if (actual[file] > allowed) {
    failures.push(`${file} has ${actual[file]} lines; allow-listed ceiling is ${allowed}. Shrink it or update the baseline by policy.`);
  }
}

for (const [file, lines] of Object.entries(actual)) {
  if (lines > limit && !(file in allowlist)) {
    failures.push(`${file} has ${lines} lines; new screen/component files must stay at or below ${limit}.`);
  }
}

if (failures.length > 0) {
  console.error("Screen line-count ratchet failed:\n" + failures.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Screen line-count ratchet passed (${files.length} files checked, limit ${limit}, ${Object.keys(allowlist).length} baselines).`);
