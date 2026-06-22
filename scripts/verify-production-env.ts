/**
 * Prints production readiness for Stripe, Upstash, and Supabase.
 * Exit 0 always, unless a blocking misconfiguration is found AND we're in strict
 * mode — i.e. VERIFY_STRICT=1 or running on the prod deployment (VERCEL_ENV=production).
 *
 * Usage: npm run verify:production-env
 */
function has(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function line(ok: boolean, label: string, detail?: string) {
  const tag = ok ? "[OK]" : "[!!]";
  console.log(`${tag} ${label}${detail ? ` — ${detail}` : ""}`);
}

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
const priceBase = process.env.STRIPE_PRICE_BASE_MONTHLY;
const pricePro = process.env.STRIPE_PRICE_PRO_MONTHLY;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

let strictFail = false;

line(has(stripeSecret), "STRIPE_SECRET_KEY", has(stripeSecret) ? "set" : "missing");
line(has(stripeWebhook), "STRIPE_WEBHOOK_SECRET", has(stripeWebhook) ? "set" : "missing");
line(has(priceBase), "STRIPE_PRICE_BASE_MONTHLY", has(priceBase) ? "set" : "missing");
line(has(pricePro), "STRIPE_PRICE_PRO_MONTHLY", has(pricePro) ? "set" : "missing");
line(
  has(upstashUrl) && has(upstashToken),
  "Upstash Redis (required in prod)",
  has(upstashUrl) && has(upstashToken) ? "configured" : "MISSING — required for safe rate limiting",
);
line(has(supabaseUrl), "NEXT_PUBLIC_SUPABASE_URL");
line(has(serviceRole), "SUPABASE_SERVICE_ROLE_KEY");

const fatSecretTier = (process.env.FATSECRET_TIER ?? "").trim().toLowerCase();
const fatSecretTierOk = fatSecretTier === "premier";
line(
  fatSecretTierOk,
  "FATSECRET_TIER",
  fatSecretTierOk ? "premier" : fatSecretTier ? `${fatSecretTier} (expected premier)` : "unset (defaults to basic in code)",
);
if (!fatSecretTierOk) {
  console.log(
    "[--] FatSecret: set FATSECRET_TIER=premier in Vercel prod+preview for autocomplete/categories endpoints (ENG-1146 CI hygiene).",
  );
}

const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();
console.log(
  `[--] NEXT_PUBLIC_PRIVACY_EMAIL — ${
    privacyEmail ? `set (${privacyEmail})` : "unset; /privacy defaults to privacy@getsloe.com"
  }`,
);

if (!has(serviceRole)) {
  console.log(
    "[!!] Account deletion: without SUPABASE_SERVICE_ROLE_KEY, DELETE /api/account/delete returns 503.",
  );
}

if (has(stripeSecret) && !has(stripeWebhook)) {
  console.log(
    "[!!] Webhooks: add STRIPE_WEBHOOK_SECRET from Stripe Dashboard → Webhooks → Signing secret (live or test).",
  );
  strictFail = true;
}

if (has(stripeSecret) && (!has(priceBase) || !has(pricePro))) {
  console.log("[!!] Checkout: set STRIPE_PRICE_BASE_MONTHLY and STRIPE_PRICE_PRO_MONTHLY to Price IDs.");
  strictFail = true;
}

if (!has(upstashUrl) || !has(upstashToken)) {
  console.log(
    "[!!] Rate limits: Upstash is REQUIRED in production. Without it the limiter falls back to per-instance in-memory buckets (effective cap = limit × lambdas → AI/photo quota bypass) and now fails CLOSED at request time. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel (prod + preview). [ENG-668]",
  );
  strictFail = true;
}

// 2026-04-26 — VAPID keypair for web push (weekly recap delivery to web).
// Without these the /api/push/weekly-recap route returns early without
// dispatching any pushes; web subscribers never receive the Sunday recap.
// Generate with `node scripts/generate-vapid-keys.mjs`.
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidConfigured = has(vapidPublic) && has(vapidPrivate) && has(vapidSubject);
line(
  vapidConfigured,
  "Web push (VAPID keypair)",
  vapidConfigured
    ? "configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT)"
    : "missing — weekly-recap web pushes will silently no-op",
);
if (!vapidConfigured) {
  console.log(
    "[--] Web push: run `node scripts/generate-vapid-keys.mjs` then paste the 3 env vars into Vercel + .env.local.",
  );
}

console.log("");
console.log("Stripe Dashboard: create endpoint POST /api/stripe/webhook with events:");
console.log("  checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted");

// Hard-fail on blocking misconfig when explicitly strict (VERIFY_STRICT=1) OR
// when running on the real production deployment (VERCEL_ENV=production) — so
// wiring this into a prod `prebuild`/CI step fails the deploy instead of
// shipping e.g. a rate-limiter quota bypass. Preview/CI/local stay advisory.
const strictMode = process.env.VERIFY_STRICT === "1" || process.env.VERCEL_ENV === "production";
if (strictMode && strictFail) {
  console.error("\nverify-production-env: strict mode and blocking issues above.");
  process.exit(1);
}

process.exit(0);
