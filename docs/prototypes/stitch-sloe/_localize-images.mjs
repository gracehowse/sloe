#!/usr/bin/env node
// Download remote lh3.googleusercontent (Stitch) images into ./img and
// rewrite <img src> to local paths so captures are reliable and the
// prototypes are self-contained (Stitch URLs expire).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const IMGDIR = path.join(__dir, 'img');
fs.mkdirSync(IMGDIR, { recursive: true });

const files = fs.readdirSync(__dir).filter(f => f.endsWith('.html'));
const URL_RE = /https:\/\/lh3\.googleusercontent\.com\/[^"']+/g;

// Collect unique URLs
const urls = new Set();
for (const f of files) {
  const html = fs.readFileSync(path.join(__dir, f), 'utf8');
  (html.match(URL_RE) || []).forEach(u => urls.add(u));
}

// Download each to a hashed filename
const mapUrlToLocal = {};
let dl = 0, fail = 0;
for (const u of urls) {
  const hash = crypto.createHash('md5').update(u).digest('hex').slice(0, 12);
  const out = path.join(IMGDIR, hash + '.png');
  const rel = './img/' + hash + '.png';
  mapUrlToLocal[u] = rel;
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) { continue; }
  try {
    execFileSync('curl', ['-sL', '--max-time', '30', '-o', out, u]);
    if (fs.statSync(out).size < 1000) throw new Error('tiny');
    dl++;
  } catch (e) {
    fail++;
    mapUrlToLocal[u] = u; // keep remote on failure
  }
}

// Rewrite html
const report = {};
for (const f of files) {
  const fp = path.join(__dir, f);
  let html = fs.readFileSync(fp, 'utf8');
  let n = 0;
  html = html.replace(URL_RE, (u) => {
    const local = mapUrlToLocal[u];
    if (local && local !== u) { n++; return local; }
    return u;
  });
  fs.writeFileSync(fp, html);
  report[f] = n;
}
console.log(JSON.stringify({ downloaded: dl, failed: fail, unique: urls.size, rewrites: report }, null, 2));
