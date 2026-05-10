#!/usr/bin/env node
/**
 * Validate the .claude/agents/ specialist agent files.
 *
 * Catches drift between agent prompts and the codebase / agent system:
 *   1. Every specialist references the shared project-context SSOT.
 *   2. Every cited file path actually exists.
 *   3. Every agent cross-reference (handoffs, "route to X") resolves.
 *   4. Every agent has the elite-tier structural skeleton.
 *
 * Exit code: 0 = pass, 1 = any P0/P1 finding.
 * Run via: node scripts/validate-agents.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const agentsDir = join(repoRoot, ".claude", "agents");
const sharedContextRel = ".claude/agents/_project-context.md";

const REQUIRED_SECTIONS = [
  /## OBJECTIVE/m,
  /## RULES/m,
  /## OUTPUT FORMAT/m,
  /## FAILURE MODES/m,
  /## HANDOFFS/m,
  /## FINAL CHECK/m,
];

const EXTENSION_PATTERN = /\.(md|ts|tsx|js|jsx|mjs|cjs|sql|css|html|json|yml|yaml|toml|sh|mts|cts)$/i;

const findings = [];
const record = (severity, agent, message) =>
  findings.push({ severity, agent, message });

function listAgentFiles() {
  return readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "MEMORY.md")
    .sort();
}

function listSpecFiles() {
  return new Set(
    readdirSync(agentsDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .map((f) => f.replace(/\.md$/, ""))
  );
}

const SHELL_PREFIXES = [
  "node ",
  "npm ",
  "npx ",
  "pnpm ",
  "yarn ",
  "bun ",
  "git ",
  "gh ",
  "bash ",
  "sh ",
  "cd ",
  "supabase ",
  "tsc ",
  "eslint ",
  "vitest ",
  "playwright ",
  "expo ",
  "EXPLAIN ",
];

function bodyOutsideBlockquotes(body) {
  // Drop lines that are blockquoted (worked examples). Those are illustrative,
  // not literal claims about the codebase.
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
}

function extractRepoPaths(body) {
  // Match backtick-wrapped paths: `path/to/file.ext` (must contain "/" and a known extension).
  const out = new Set();
  const scanned = bodyOutsideBlockquotes(body);
  const inline = scanned.matchAll(/`([^`\n]+)`/g);
  for (const [, captured] of inline) {
    if (!captured.includes("/")) continue;
    if (!EXTENSION_PATTERN.test(captured)) continue;
    // strip trailing punctuation a sentence might leave
    const cleaned = captured.replace(/[.,;:)]+$/, "");
    // skip absolute paths / URLs / placeholders
    if (cleaned.startsWith("/")) continue;
    if (/^https?:\/\//.test(cleaned)) continue;
    if (cleaned.includes("<") || cleaned.includes("{{")) continue;
    // skip glob-style patterns
    if (cleaned.includes("**")) continue;
    if (cleaned.includes("*")) continue;
    // skip composite shorthand like sentry.{client,edge,server}.config.ts
    if (cleaned.includes("{") || cleaned.includes("}")) continue;
    // skip shell command snippets ("node scripts/x.mjs", "supabase db push", etc.)
    if (SHELL_PREFIXES.some((p) => cleaned.startsWith(p))) continue;
    out.add(cleaned);
  }
  return out;
}

// Phrases that imply an inline backtick name is being used as an AGENT handle
// (a routing target, handoff source, sign-off owner). Anything outside these
// contexts is treated as a generic identifier (package name, code keyword, etc.)
// and ignored. Keeping this strict avoids false positives.
const AGENT_REF_PATTERNS = [
  /`([a-z][a-z-]+)` —/g, // "`executor` —"
  /\broute to `([a-z][a-z-]+)`/gi,
  /\broutes to `([a-z][a-z-]+)`/gi,
  /\brouting to `([a-z][a-z-]+)`/gi,
  /\bhand off to `([a-z][a-z-]+)`/gi,
  /\bhand-off to `([a-z][a-z-]+)`/gi,
  /\bhandoff to `([a-z][a-z-]+)`/gi,
  /\bescalate to `([a-z][a-z-]+)`/gi,
  /\bloop in `([a-z][a-z-]+)`/gi,
  /\bpair with `([a-z][a-z-]+)`/gi,
  /\bcoordinate with `([a-z][a-z-]+)`/gi,
  /\bsign[- ]off (?:from|by) `([a-z][a-z-]+)`/gi,
  /\bowner: `([a-z][a-z-]+)`/gi,
  /\bvia `([a-z][a-z-]+)`(?:\s+agent|\s+specialist|$|\.)/gi,
  /\b(?:before|after) `([a-z][a-z-]+)` (?:agent|specialist|signs|reviews|approves|gates)/gi,
  /\bcalls into `([a-z][a-z-]+)`/gi,
  /\binvoke `([a-z][a-z-]+)` (?:agent|specialist|on|for|to)/gi,
];

function extractAgentRefs(body) {
  // Pull only the names that appear in routing/handoff contexts. Generic
  // backticked identifiers (package names, keywords) are intentionally ignored.
  const out = new Set();
  const scanned = bodyOutsideBlockquotes(body);
  for (const pattern of AGENT_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(scanned)) !== null) {
      out.add(m[1]);
    }
  }
  return out;
}

function validate(agentFile) {
  const agentName = agentFile.replace(/\.md$/, "");
  const filePath = join(agentsDir, agentFile);
  const body = readFileSync(filePath, "utf8");

  // Check 1 — references the shared project-context SSOT.
  if (!body.includes("_project-context.md")) {
    record(
      "P1",
      agentName,
      `does not reference ${sharedContextRel} (step-zero discipline missing)`
    );
  }

  // Check 2 — cited repo-relative paths exist.
  for (const path of extractRepoPaths(body)) {
    const abs = join(repoRoot, path);
    if (!existsSync(abs)) {
      // Try as a directory by stripping a trailing slash.
      const stripped = path.replace(/\/$/, "");
      if (!existsSync(join(repoRoot, stripped))) {
        record("P0", agentName, `cited path does not exist: \`${path}\``);
      }
    }
  }

  // Check 3 — every routing/handoff ref resolves to a real agent file.
  const specs = listSpecFiles();
  for (const ref of extractAgentRefs(body)) {
    if (specs.has(ref)) continue;
    if (ref === agentName) continue;
    record("P0", agentName, `routing ref \`${ref}\` does not resolve to an agent file`);
  }

  // Check 4 — elite-tier structural skeleton.
  for (const section of REQUIRED_SECTIONS) {
    if (!section.test(body)) {
      record(
        "P2",
        agentName,
        `missing section: ${section.source}`
      );
    }
  }
}

function main() {
  if (!existsSync(agentsDir)) {
    console.error(`No agents dir at ${agentsDir}`);
    process.exit(2);
  }
  if (!existsSync(join(repoRoot, sharedContextRel))) {
    console.error(`Shared context file missing: ${sharedContextRel}`);
    process.exit(2);
  }

  const agents = listAgentFiles();
  console.log(`Validating ${agents.length} agent files in ${agentsDir}\n`);

  for (const agent of agents) validate(agent);

  if (findings.length === 0) {
    console.log("✓ All agent files pass validation.");
    process.exit(0);
  }

  // Group by severity, print, and decide exit code.
  const bySeverity = { P0: [], P1: [], P2: [], P3: [] };
  for (const f of findings) bySeverity[f.severity].push(f);

  for (const sev of ["P0", "P1", "P2", "P3"]) {
    const items = bySeverity[sev];
    if (items.length === 0) continue;
    console.log(`${sev} (${items.length}):`);
    for (const f of items) {
      console.log(`  ${f.agent}: ${f.message}`);
    }
    console.log("");
  }

  const blocking = bySeverity.P0.length + bySeverity.P1.length;
  if (blocking > 0) {
    console.log(`✗ ${blocking} blocking finding(s). Exit 1.`);
    process.exit(1);
  }
  console.log(`✓ No blocking findings (${findings.length} non-blocking).`);
  process.exit(0);
}

main();
