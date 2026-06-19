#!/usr/bin/env node
/**
 * Mirror .claude/CLAUDE.md → root AGENTS.md for cross-tool agent discovery.
 *
 * Edit .claude/CLAUDE.md (canonical), then run:
 *   npm run sync:agent-docs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, ".claude/CLAUDE.md");
const TARGET = resolve(ROOT, "AGENTS.md");

const HEADER = `<!--
  TRACKED MIRROR — do not edit by hand.
  Canonical source: .claude/CLAUDE.md
  Regenerate: npm run sync:agent-docs
  See: docs/decisions/2026-06-17-agent-docs-claude-canonical.md (Option C)
-->

`;

const body = readFileSync(SOURCE, "utf8");
writeFileSync(TARGET, HEADER + body, "utf8");
console.log(`Synced ${SOURCE} → ${TARGET}`);
