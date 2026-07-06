#!/usr/bin/env node
/**
 * Generate docs/decisions/INDEX.md — a newest-first index of every decision
 * doc, so 300+ files are browsable without grep/date-guessing.
 *
 * Walks docs/decisions/*.md, extracts:
 *   - date:    from the filename's YYYY-MM-DD prefix (existing convention;
 *              falls back to a YYYY-MM prefix, then an in-body `date:`
 *              frontmatter key, then "undated" — sorted last)
 *   - title:   the first H1 (`# ...`), frontmatter excluded
 *   - summary: an explicit frontmatter `summary:` key if present, else the
 *              first non-heading, non-metadata paragraph
 *
 * Regenerate after adding a new decision doc:
 *   npm run docs:decisions-index
 *
 * ENG-1370.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DECISIONS_DIR = resolve(ROOT, "docs/decisions");
const OUTPUT = resolve(DECISIONS_DIR, "INDEX.md");

const FILENAME_DATE_RE = /^(\d{4}-\d{2}-\d{2})-/;
const FILENAME_MONTH_RE = /^(\d{4}-\d{2})-/;

/** Split a file's raw text into { frontmatter, body }. Frontmatter is a
 * `---`-delimited block starting at line 1 (YAML-ish key: value lines). */
function splitFrontmatter(raw) {
  if (!raw.startsWith("---\n") && raw !== "---") {
    return { frontmatter: {}, body: raw };
  }
  const lines = raw.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontmatter: {}, body: raw };

  const frontmatter = {};
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (m) frontmatter[m[1].trim()] = m[2].trim();
  }
  const body = lines.slice(end + 1).join("\n");
  return { frontmatter, body };
}

/** First H1 (`# Title`) in the body, heading markers stripped. */
function extractTitle(body, fallback) {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return fallback;
}

/** A line that *starts* a metadata block: a bold `**Key:**` label (optionally
 * a bullet-list item), or a bare `Key: value` line (e.g. `Date: 2026-07-03`,
 * `Status: Resolved`). */
function isMetadataStart(line) {
  const t = line.trim().replace(/^[-*]\s+/, ""); // strip a leading list-bullet marker
  if (/^\*\*[\w /]+:\*\*/.test(t)) return true; // **Status:** / **Date:** / **Linear:** …
  if (/^(Date|Status|Area|Owner|Linear|Scope|Related|Priority|Backlog|Audit reference|Amended):/i.test(t)) return true;
  return false;
}

/** Lines that are always noise regardless of position. */
function isStructuralNoise(line) {
  const t = line.trim();
  if (t === "") return true;
  if (t.startsWith("#")) return true; // headings
  if (t === "---") return true; // stray rule
  if (/^>/.test(t)) return true; // blockquote callouts
  if (/^\|.*\|$/.test(t)) return true; // markdown table row (data or `|---|---|` separator)
  return false;
}

/**
 * First real paragraph after the title, collapsed to one line, truncated.
 *
 * Body convention: the title is often immediately followed by a metadata
 * block (one or more `**Key:** value` / `Key: value` lines, which may wrap
 * onto plain continuation lines with no blank line separating them). That
 * whole contiguous block — not just its first line — is skipped before we
 * start collecting the real summary paragraph.
 */
function extractSummary(body, frontmatter) {
  if (frontmatter.summary) return frontmatter.summary;

  const lines = body.split("\n");
  let sawTitle = false;
  let inMetadataBlock = false;
  const paragraph = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!sawTitle) {
      if (/^#\s+/.test(trimmed)) sawTitle = true;
      continue;
    }
    if (isStructuralNoise(line)) {
      inMetadataBlock = false; // a blank line always closes a metadata block
      if (paragraph.length > 0) break;
      continue;
    }
    if (paragraph.length === 0) {
      if (inMetadataBlock || isMetadataStart(line)) {
        inMetadataBlock = true;
        continue;
      }
    }
    paragraph.push(trimmed);
  }

  let summary = paragraph.join(" ").replace(/\s+/g, " ").trim();
  if (!summary) return "";
  const MAX = 220;
  if (summary.length > MAX) {
    summary = `${summary.slice(0, MAX).trimEnd()}…`;
  }
  return summary;
}

function extractDate(filename, frontmatter) {
  const exact = filename.match(FILENAME_DATE_RE);
  if (exact) return { date: exact[1] };

  const month = filename.match(FILENAME_MONTH_RE);
  if (month) return { date: month[1] };

  if (frontmatter.date) return { date: frontmatter.date };

  return { date: null };
}

function main() {
  const files = readdirSync(DECISIONS_DIR).filter(
    (f) => f.endsWith(".md") && f !== "INDEX.md" && f !== "README.md"
  );

  const entries = files.map((filename) => {
    const raw = readFileSync(resolve(DECISIONS_DIR, filename), "utf8");
    const { frontmatter, body } = splitFrontmatter(raw);
    const { date } = extractDate(filename, frontmatter);
    const title = extractTitle(body, filename.replace(/\.md$/, ""));
    const summary = extractSummary(body, frontmatter);
    return { filename, date, title, summary };
  });

  // Newest-first. Undated entries (date === null) sort last, alphabetically.
  entries.sort((a, b) => {
    if (a.date === null && b.date === null) return a.filename.localeCompare(b.filename);
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.filename.localeCompare(b.filename);
  });

  const rows = entries.map((e) => {
    const dateCol = e.date ?? "undated";
    const link = `[${e.title}](./${e.filename})`;
    const summaryCol = e.summary || "—";
    return `| ${dateCol} | ${link} | ${summaryCol} |`;
  });

  const generatedAt = new Date().toISOString().slice(0, 10);
  const out = `# Decision log — index

<!--
  GENERATED FILE — do not edit by hand.
  Source: docs/decisions/*.md (title = first H1, date = filename YYYY-MM-DD
  prefix, summary = frontmatter \`summary:\` or first body paragraph).
  Regenerate after adding/editing a decision doc:
    npm run docs:decisions-index
  Generator: scripts/generate-decisions-index.mjs (ENG-1370)
-->

${entries.length} decision docs, newest first. Generated ${generatedAt}.

| Date | Decision | Summary |
|------|----------|---------|
${rows.join("\n")}
`;

  writeFileSync(OUTPUT, out, "utf8");
  console.log(`Wrote ${entries.length} entries to ${OUTPUT}`);
}

main();
