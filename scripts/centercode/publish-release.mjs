#!/usr/bin/env node
/**
 * Create a Centercode release (beta cohort notification).
 * Qualitative feedback lives in Centercode — not layout/screenshot QA.
 *
 * Env (repo root .env.local or CI secrets):
 *   CENTERCODE_BASE_URL   e.g. https://yourco.centercode.com
 *   CENTERCODE_API_KEY
 *   CENTERCODE_PROJECT_KEY
 *   CENTERCODE_RELEASE_TYPE_KEY
 *   CENTERCODE_RELEASE_TITLE      (default: Suppr iOS build)
 *   CENTERCODE_RELEASE_VALUE      (default: BUILD_NUMBER or date)
 *   CENTERCODE_RELEASE_BODY       (HTML snippet for testers)
 *   CENTERCODE_DOWNLOAD_URL       (TestFlight / EAS install link)
 *   CENTERCODE_DOWNLOAD_LABEL     (default: Install build)
 *
 * Usage:
 *   node scripts/centercode/publish-release.mjs
 *   npm run centercode:publish-release
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const baseUrl = process.env.CENTERCODE_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.CENTERCODE_API_KEY?.trim();
const projectKey = process.env.CENTERCODE_PROJECT_KEY?.trim();
const releaseTypeKey = process.env.CENTERCODE_RELEASE_TYPE_KEY?.trim();

const missing = [
  !baseUrl && "CENTERCODE_BASE_URL",
  !apiKey && "CENTERCODE_API_KEY",
  !projectKey && "CENTERCODE_PROJECT_KEY",
  !releaseTypeKey && "CENTERCODE_RELEASE_TYPE_KEY",
].filter(Boolean);

if (missing.length) {
  console.error(
    `Missing Centercode env: ${missing.join(", ")}\nSee docs/operations/centercode-beta-feedback.md`,
  );
  process.exit(1);
}

const title =
  process.env.CENTERCODE_RELEASE_TITLE?.trim() ??
  `Suppr build ${process.env.BUILD_NUMBER ?? "local"}`;
const releaseValue =
  process.env.CENTERCODE_RELEASE_VALUE?.trim() ??
  process.env.BUILD_NUMBER ??
  new Date().toISOString().slice(0, 10);
const body =
  process.env.CENTERCODE_RELEASE_BODY?.trim() ??
  "<p>New Suppr beta build is ready. Install via the link below and file feedback in Centercode (not for screenshot/layout QA).</p>";
const downloadUrl = process.env.CENTERCODE_DOWNLOAD_URL?.trim();
const downloadLabel = process.env.CENTERCODE_DOWNLOAD_LABEL?.trim() ?? "Install build";

/** @type {Record<string, unknown>} */
const payload = {
  title,
  subtitle: process.env.CENTERCODE_RELEASE_SUBTITLE?.trim() ?? "Suppr beta",
  releaseValue,
  body,
  startDate: new Date().toISOString(),
  endDate: "2050-12-31T23:59:59Z",
  isClickThroughNotice: false,
};

if (downloadUrl) {
  payload.links = [
    {
      label: downloadLabel,
      url: downloadUrl,
      openInNewWindow: true,
      includeInDownloadBlock: true,
      logDownloadAttempts: true,
    },
  ];
}

const endpoint = `${baseUrl}/api/v1/projects/${encodeURIComponent(projectKey)}/releaseTypes/${encodeURIComponent(releaseTypeKey)}?apiKey=${encodeURIComponent(apiKey)}`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Centercode release failed (${res.status}):`, text);
  process.exit(1);
}

console.log("Centercode release created:", text.slice(0, 500));
