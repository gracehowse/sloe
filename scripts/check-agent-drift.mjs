#!/usr/bin/env node
/**
 * ENG — Agent-definition drift gate.
 *
 * The 2026-07-24 agent audit found eleven separate cases where a
 * `.claude/agents/*.md` prompt asserted something the codebase had since
 * changed: a rejected nutrition confidence floor, three mutually
 * incompatible radius scales, a deleted button variant, a retired card
 * elevation model, a dead brand domain, five fabricated analytics event
 * names, and 37 copies of an absolute path to a machine that no longer
 * exists.
 *
 * Root cause: agent prompts were the ONLY artifacts in the repo not
 * covered by a ratchet. Every other surface (spacing, tokens, type,
 * radius, pressable feedback, Storybook, copy voice, nutrition claims,
 * screen budget) has a gate that reads truth from source at runtime.
 * The prompts transcribed truth instead, so they rotted silently.
 *
 * This gate closes that asymmetry. Five detectors, all chosen to be
 * precise rather than broad — a noisy gate on prose gets muted, and a
 * muted gate is how we got here:
 *
 *   1. ABSOLUTE PATHS   — any `/Users/...` reference. Zero false
 *                         positives; catches the exact class that broke
 *                         all 36 agents' STEP ZERO.
 *   2. DEAD REFERENCES  — repo-relative paths and `npm run` scripts that
 *                         do not resolve. Gitignored paths are exempt:
 *                         capture dirs and auth fixtures are generated at
 *                         runtime, so they exist locally and never in a
 *                         fresh CI checkout.
 *   3. TRANSCRIBED SCALES — a numeric list (>=3 values) on a line that
 *                         also names a design scale. These belong in
 *                         `theme.ts`; a prompt must cite the token, not
 *                         copy the numbers.
 *   4. STALENESS        — every agent carries `last-reviewed:` in
 *                         frontmatter, and it may not exceed MAX_AGE_DAYS.
 *                         Agents only: they are model-dispatched and rot
 *                         unseen. Skills are user-invoked, so a human
 *                         notices; every other detector still applies.
 *   5. DEAD AGENTS      — a routing line naming an agent that no longer
 *                         exists. Added because two subagents writing the
 *                         replacement roster each shipped a draft routing
 *                         to a deleted agent, caught only by hand.
 *
 * Scans every `.claude/agents/*.md` plus each `.claude/skills/<name>/SKILL.md`.
 *
 * Usage:
 *   node scripts/check-agent-drift.mjs          # gate (exit 1 on drift)
 *   node scripts/check-agent-drift.mjs --list   # report only, exit 0
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

import { REPO_ROOT, isInvokedDirectly } from "./lib/ratchet.mjs";

const ROOT = REPO_ROOT;
const AGENTS_DIR = join(ROOT, ".claude", "agents");
const SKILLS_DIR = join(ROOT, ".claude", "skills");

/** An agent unreviewed for longer than this is assumed drifted. */
const MAX_AGE_DAYS = 90;

/** Path-ish tokens starting with one of these are treated as repo paths. */
const REPO_ROOTS = [
  "src/", "app/", "apps/", "docs/", "scripts/", "tests/",
  "supabase/", ".claude/", ".github/", "utils/",
];

/** Design-scale words that make a numeric list a transcription. */
const SCALE_WORDS =
  /\b(spacing|radius|borderradius|border-radius|fontsize|font-size|type\s*(scale|ramp)|scale\s*is|legal\s*(set|values|scale))\b/i;

/** Words that mark a line as routing work to another agent. */
const ROUTING_WORDS = /\b(owner|routes?\s+to|hands?\s+off|handoff|escalate|defer\s+to)\b/i;

/**
 * Agent names retired in the 2026-07-24 consolidation. Referencing one is
 * always drift — the two subagents that wrote the replacement roster each
 * shipped a draft routing findings to a deleted agent, and nothing caught
 * it until a manual grep. Keep this list; add to it on any future cut.
 */
const DELETED_AGENTS = new Set([
  "repo-auditor", "product-lead", "customer-lens", "ui-critic",
  "ui-product-designer", "design-director", "visual-qa", "premium-auditor",
  "design-system-enforcer", "copy-reviewer", "brand-manager", "code-quality",
  "qa-lead", "docs-keeper", "product-memory", "integration-manager",
  "performance-optimizer", "monetisation-architect", "growth-strategist",
  "journey-architect", "analytics-engineer", "competitor-intelligence",
  "user-sentiment", "feature-scout", "production-readiness",
  "diversity-inclusion", "orchestrator", "orchestrator-full-sweep",
]);

/** Agent-name-shaped tokens that are legitimately something else. */
const NOT_AGENTS = new Set([
  "prefers-reduced-motion", "color-contrast", "focus-visible", "react-native",
  "lucide-react-native", "no-op", "end-to-end", "count-to-weight",
  "flag-and-review", "best-in-class", "only-shrink", "read-only",
]);

const AGENT_SHAPED = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/**
 * Paths we accept without existence checks: globs, templates, and
 * illustrative filenames inside worked examples.
 */
function isUncheckablePath(p) {
  return (
    p.includes("*") ||
    p.includes("<") ||
    p.includes("YYYY") ||
    p.includes("${") ||
    p.includes("...") ||
    p.endsWith("/…") ||
    /\bNN\b/.test(p)
  );
}

function readFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = text.slice(3, end);
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function loadScripts() {
  const names = new Set();
  for (const pkg of ["package.json", join("apps", "mobile", "package.json")]) {
    const full = join(ROOT, pkg);
    if (!existsSync(full)) continue;
    const json = JSON.parse(readFileSync(full, "utf8"));
    for (const key of Object.keys(json.scripts ?? {})) names.add(key);
  }
  return names;
}

/**
 * Pure detector over one file's text. `pathExists` is injected so the
 * detectors are unit-testable without touching the filesystem.
 */
function scanText({
  text,
  rel = "test.md",
  scriptNames = new Set(),
  today = Date.now(),
  validAgents = new Set(),
  pathExists = () => true,
}) {
  const lines = text.split("\n");
  const findings = [];

  const add = (line, kind, detail, fix) =>
    findings.push({ file: rel, line, kind, detail, fix });

  // --- 4. Staleness + frontmatter -----------------------------------
  const fm = readFrontmatter(text);
  const isSharedContext = rel.endsWith("_project-context.md");
  // Skills carry their own review cadence and are user-invoked, so a human
  // sees them fail. Agents are model-dispatched and rot invisibly — that
  // asymmetry is why staleness is enforced on agents only. Every other
  // detector applies to both: a dead path in a skill is just as wrong.
  const isSkill = rel.includes("/skills/");

  if (isSkill) {
    // fall through to the per-line detectors below
  } else if (!fm && !isSharedContext) {
    add(1, "frontmatter", "no frontmatter block", "add name/description/tools/model/last-reviewed");
  } else {
    const reviewed = fm?.["last-reviewed"] ?? matchInlineReviewed(text);
    if (!reviewed) {
      add(1, "staleness", "no `last-reviewed` date", "add `last-reviewed: YYYY-MM-DD`");
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewed)) {
      add(1, "staleness", `unparseable last-reviewed "${reviewed}"`, "use YYYY-MM-DD");
    } else {
      const age = Math.floor((today - Date.parse(reviewed)) / 86_400_000);
      if (age > MAX_AGE_DAYS) {
        add(1, "staleness", `last reviewed ${age} days ago (max ${MAX_AGE_DAYS})`,
            "re-verify its claims against the codebase, then bump the date");
      }
    }
  }

  lines.forEach((raw, i) => {
    const lineNo = i + 1;

    // --- 1. Absolute paths ------------------------------------------
    for (const m of raw.matchAll(/\/Users\/[^\s`"'()]+/g)) {
      add(lineNo, "absolute-path", m[0],
          "use a repo-relative path — absolute paths break on every other machine");
    }

    // --- 2. Dead npm scripts ----------------------------------------
    for (const m of raw.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
      if (!scriptNames.has(m[1])) {
        add(lineNo, "dead-script", `npm run ${m[1]}`,
            "no such script in package.json or apps/mobile/package.json");
      }
    }

    // --- 2b. Dead repo paths ----------------------------------------
    for (const m of raw.matchAll(/`([^`\s]+)`/g)) {
      const p = m[1].replace(/[.,;:)]+$/, "");
      if (!REPO_ROOTS.some((r) => p.startsWith(r))) continue;
      if (isUncheckablePath(p)) continue;
      if (!pathExists(p)) {
        add(lineNo, "dead-path", p, "path does not resolve from repo root");
      }
    }

    // --- 5. Dead agent references -----------------------------------
    for (const m of raw.matchAll(/`([a-z0-9-]+)`/g)) {
      const token = m[1];
      if (validAgents.has(token) || NOT_AGENTS.has(token)) continue;
      if (DELETED_AGENTS.has(token)) {
        add(lineNo, "dead-agent", token,
            "agent was retired in the 2026-07-24 consolidation — route to a surviving agent");
      } else if (AGENT_SHAPED.test(token) && ROUTING_WORDS.test(raw)) {
        add(lineNo, "dead-agent", token,
            "routing line names something that is not an agent in .claude/agents/");
      }
    }

    // --- 3. Transcribed scales --------------------------------------
    if (SCALE_WORDS.test(raw)) {
      // A run of >=3 numbers separated by / , or whitespace inside
      // braces — i.e. someone copied a scale out of theme.ts.
      const numeric = raw.match(/\b\d{1,4}(\s*[\/,]\s*\d{1,4}){2,}\b/);
      if (numeric) {
        add(lineNo, "transcribed-scale", numeric[0].trim(),
            "cite the token + source file (apps/mobile/constants/theme.ts), never the values");
      }
    }
  });

  return findings;
}

/**
 * A gitignored path is a legitimate reference, not a dead one — capture
 * dirs and auth fixtures are generated at runtime, so they exist locally
 * and never in a fresh CI checkout. Without this the gate is green on a
 * developer machine and red in CI, which is the exact local-vs-CI
 * divergence `CLAUDE.md` warns about. Only consulted for paths that don't
 * exist, so this costs a handful of spawns at most.
 */
const ignoreCache = new Map();
function isGitIgnored(p) {
  if (ignoreCache.has(p)) return ignoreCache.get(p);
  let ignored = false;
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", p], {
      cwd: ROOT,
      stdio: "ignore",
    });
    ignored = true; // exit 0 = the path is ignored
  } catch {
    ignored = false; // exit 1 = not ignored; anything else = treat as not ignored
  }
  ignoreCache.set(p, ignored);
  return ignored;
}

/** Filesystem wrapper around `scanText`. */
function scanFile(file, scriptNames, today, validAgents = new Set()) {
  return scanText({
    text: readFileSync(file, "utf8"),
    rel: relative(ROOT, file),
    scriptNames,
    today,
    validAgents,
    pathExists: (p) => existsSync(join(ROOT, p)) || isGitIgnored(p),
  });
}

/** `_project-context.md` carries its date as a bold markdown line. */
function matchInlineReviewed(text) {
  const m = text.match(/\*\*last-reviewed:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : null;
}

function runCli() {
  const listOnly = process.argv.includes("--list");

  if (!existsSync(AGENTS_DIR)) {
    console.log("✓ No .claude/agents directory — nothing to check.");
    process.exit(0);
  }

  const scriptNames = loadScripts();
  const today = Date.now();
  const files = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(AGENTS_DIR, f))
    .filter((f) => statSync(f).isFile());

  // Skills cite the same paths and npm scripts as agents and rot the same way.
  if (existsSync(SKILLS_DIR)) {
    for (const dir of readdirSync(SKILLS_DIR)) {
      const skill = join(SKILLS_DIR, dir, "SKILL.md");
      if (existsSync(skill)) files.push(skill);
    }
  }

  const validAgents = new Set(
    files.map((f) => f.split("/").pop().replace(/\.md$/, "")),
  );
  const findings = files.flatMap((f) => scanFile(f, scriptNames, today, validAgents));

  if (findings.length === 0) {
    console.log(`✓ ${files.length} agent file(s) clean — no drift detected.`);
    process.exit(0);
  }

  const byKind = new Map();
  for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind).push(f);
  }

  console.log(`\n⚠ ${findings.length} agent-drift finding(s) across ${files.length} file(s):\n`);
  for (const [kind, items] of byKind) {
    console.log(`  ── ${kind} (${items.length})`);
    for (const it of items) {
      console.log(`     ${it.file}:${it.line}  ${it.detail}`);
      console.log(`       → ${it.fix}`);
    }
    console.log();
  }

  console.log("Agent prompts must cite sources, not copy them. See the PRIME RULE in");
  console.log(".claude/agents/_project-context.md.\n");
  process.exit(listOnly ? 0 : 1);
}

if (isInvokedDirectly(import.meta.url)) runCli();

export { scanText, scanFile, readFrontmatter };
