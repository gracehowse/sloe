#!/usr/bin/env node
/**
 * One-shot VAPID key generator for server-initiated Web Push.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Copy the output into your env vars:
 *   - Vercel (production + preview + dev): Settings → Environment Variables
 *       NEXT_PUBLIC_VAPID_PUBLIC_KEY  — safe to ship to the browser
 *       VAPID_PRIVATE_KEY             — NEVER ship to the browser; server only
 *       VAPID_SUBJECT                 — mailto: or https: URL identifying you
 *   - `.env.local` for local dev (same names)
 *
 * Keys are regenerated per run; rotate only when you want to invalidate
 * every existing web_push_subscriptions row (subscribers will need to
 * re-grant). The `subject` field is arbitrary but must start with
 * `mailto:` or `https:`; it identifies the sender to push services and
 * is surfaced if a push service needs to contact the sender for abuse
 * / debugging reasons.
 */

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("");
console.log("=== Web Push VAPID keys — copy into env vars ===");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:grace@suppr-club.com");
console.log("");
console.log(
  "⚠ VAPID_PRIVATE_KEY is a secret. Never commit it; keep it server-side only.",
);
console.log(
  "⚠ Regenerating these keys invalidates every existing push subscription —",
);
console.log(
  "  subscribers will need to re-grant in their browser before receiving pushes.",
);
console.log("");
