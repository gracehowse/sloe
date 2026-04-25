#!/usr/bin/env node
// Pulls TestFlight screenshot + crash feedback from App Store Connect and
// writes a deduped summary to docs/testflight-feedback/data/.
//
// Required env (put in .env.local — do not commit):
//   ASC_KEY_ID         10-char key ID from ASC → Users and Access → Keys
//   ASC_ISSUER_ID      UUID shown above the key list
//   ASC_PRIVATE_KEY    Path to the downloaded .p8 file (or inline contents)
//   ASC_APP_ID         Numeric ascAppId (e.g. 6762522932)
//
// Usage: node scripts/fetch-testflight-feedback.mjs
//
// Summary JSON includes `screenshots[]` with signed JPEG URLs from Apple
// (`tf-feedback.itunes.apple.com`). URLs expire — use soon after fetch; see
// each asset's `expirationDate`.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createPrivateKey, createSign } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "docs/testflight-feedback/data");

loadDotEnv(resolve(REPO_ROOT, ".env.local"));

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, ASC_APP_ID } = process.env;
requireEnv({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, ASC_APP_ID });

const privateKeyPem = ASC_PRIVATE_KEY.includes("-----BEGIN")
  ? ASC_PRIVATE_KEY
  : readFileSync(resolve(REPO_ROOT, ASC_PRIVATE_KEY), "utf8");

const token = signJwt({ keyId: ASC_KEY_ID, issuerId: ASC_ISSUER_ID, privateKeyPem });

const API = "https://api.appstoreconnect.apple.com/v1";

async function main() {
  console.log("Fetching builds...");
  const builds = await asc(
    `${API}/builds?filter[app]=${ASC_APP_ID}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired`,
  );

  console.log(`Found ${builds.data.length} builds.`);

  console.log("Fetching screenshot feedback...");
  const screenshots = await fetchAllPages(
    `${API}/apps/${ASC_APP_ID}/betaFeedbackScreenshotSubmissions?limit=200`,
  );

  console.log("Fetching crash feedback...");
  const crashes = await fetchAllPages(
    `${API}/apps/${ASC_APP_ID}/betaFeedbackCrashSubmissions?limit=200`,
  );

  const summary = summarise({ builds: builds.data, screenshots, crashes });

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(resolve(OUT_DIR, `feedback-${stamp}.json`), JSON.stringify(summary, null, 2));
  writeFileSync(resolve(OUT_DIR, `feedback-${stamp}-raw.json`), JSON.stringify({ screenshots, crashes }, null, 2));

  console.log(`\nWrote:`);
  console.log(`  ${OUT_DIR}/feedback-${stamp}.json      (summary — read this)`);
  console.log(`  ${OUT_DIR}/feedback-${stamp}-raw.json  (raw API payload)`);
  console.log(
    `\nSummary: ${summary.screenshotFeedback.length} screenshot, ${summary.crashFeedback.length} crash submissions across ${summary.builds.length} builds.`,
  );
  console.log(
    "Each screenshot row includes `screenshots[].url` (time-limited); re-run this script after URLs expire.",
  );
}

/** @param {unknown} raw */
function normaliseScreenshotAssets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((shot) => shot && typeof shot.url === "string" && shot.url.length > 0)
    .map((shot) => ({
      url: shot.url,
      width: typeof shot.width === "number" ? shot.width : null,
      height: typeof shot.height === "number" ? shot.height : null,
      expirationDate: typeof shot.expirationDate === "string" ? shot.expirationDate : null,
    }));
}

function summarise({ builds, screenshots, crashes }) {
  const buildMeta = Object.fromEntries(
    builds.map((b) => [b.id, { version: b.attributes.version, uploadedDate: b.attributes.uploadedDate }]),
  );

  return {
    fetchedAt: new Date().toISOString(),
    appId: ASC_APP_ID,
    builds: builds.map((b) => ({
      id: b.id,
      version: b.attributes.version,
      uploadedDate: b.attributes.uploadedDate,
      processingState: b.attributes.processingState,
      expired: b.attributes.expired,
    })),
    screenshotFeedback: screenshots.data.map((s) => {
      const shots = normaliseScreenshotAssets(s.attributes.screenshots);
      return {
        id: s.id,
        submittedDate: s.attributes.submittedDate ?? s.attributes.createdDate,
        comment: s.attributes.comment || null,
        email: s.attributes.email || null,
        deviceModel: s.attributes.deviceModel,
        osVersion: s.attributes.osVersion,
        locale: s.attributes.locale,
        buildId: s.relationships?.build?.data?.id,
        buildVersion: buildMeta[s.relationships?.build?.data?.id]?.version,
        screenshotCount: shots.length,
        screenshots: shots,
      };
    }),
    crashFeedback: crashes.data.map((c) => ({
      id: c.id,
      submittedDate: c.attributes.submittedDate ?? c.attributes.createdDate,
      comment: c.attributes.comment || null,
      email: c.attributes.email || null,
      deviceModel: c.attributes.deviceModel,
      osVersion: c.attributes.osVersion,
      locale: c.attributes.locale,
      buildId: c.relationships?.build?.data?.id,
      buildVersion: buildMeta[c.relationships?.build?.data?.id]?.version,
      hasCrashLog: !!c.attributes.crashLogs?.length,
    })),
  };
}

async function fetchAllPages(url) {
  const merged = { data: [], included: [] };
  let next = url;
  while (next) {
    const page = await asc(next);
    merged.data.push(...(page.data ?? []));
    merged.included.push(...(page.included ?? []));
    next = page.links?.next;
  }
  return merged;
}

async function asc(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ASC ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  return res.json();
}

function signJwt({ keyId, issuerId, privateKeyPem }) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;

  const key = createPrivateKey(privateKeyPem);
  const sign = createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const derSig = sign.sign({ key, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${derSig.toString("base64url")}`;
}

function requireEnv(vars) {
  const missing = Object.entries(vars).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(", ")}`);
    console.error(`Add them to ${resolve(REPO_ROOT, ".env.local")} — see docs/testflight-feedback/README.md`);
    process.exit(1);
  }
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
