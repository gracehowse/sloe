# Sub-processor & Data Processing Agreement (DPA) inventory

**Owner:** Grace (founder) · **Reviewer:** `legal-reviewer` (must sign off before public launch)
**Status:** DRAFT — compiled from the codebase 2026-07-01 (ENG-1277). **Not yet legally reviewed.**
**Last updated:** 2026-07-01

---

## What this document is

This is the artefact that [`docs/operations/legal-finalization-runbook.md` §9 (line 129)](../operations/legal-finalization-runbook.md#9-vendor-dpas)
expects — the internal record of which vendor Data Processing Agreements are signed vs pending.
Until now that reference pointed at a file that did not exist; this doc fills the gap.

It exists for three reasons:

1. **GDPR Art. 28** — a controller must sign a DPA (or equivalent SCC-backed terms) with every
   processor that handles personal data on its behalf, and be able to produce those on request.
   The [IP follow-ups doc](../planning/archive/ip-followups-2026-04-19.md) flags this as a launch
   requirement; the [launch checklist](../launch/checklist.md) item 17 tracks it as **Pending**.
2. **Privacy-policy backing.** The public sub-processor table at `app/privacy/page.tsx` asserts
   *"Each is bound by a data-processing agreement."* That statement must be **true** before UK/EU
   public launch. This inventory is the evidence register behind that claim.
3. **fal.ai gap (ENG-863/865).** The ENG-865 legal-reviewer gate surfaced that fal.ai (AI image
   generation) is a sub-processor with **no DPA addressed and no privacy-policy disclosure**. It is
   flagged explicitly below.

### How to read the DPA-status column

| Status | Meaning |
|---|---|
| **Signed** | A DPA is executed and a copy is on file. **No vendor is currently in this state** — the [launch checklist](../launch/checklist.md) item 17 records all vendor DPAs as *Pending*. Do not mark any row "Signed" without a copy on file. |
| **To provision** | A DPA is available (auto-applied via the vendor's terms, or signable from their dashboard) but has not been confirmed/recorded as accepted for the Sloe account. This is where almost everything sits today. |
| **NEEDED** | A DPA is required and there is a **known gap** — the vendor is in the data path but is missing from the privacy policy and/or has no DPA arranged. Action required before launch. |
| **N/A — no personal data** | The vendor receives only non-personal data (e.g. a public food-database text query with no account identifier). A DPA is good hygiene but not strictly required. Confirm the "no personal data" characterisation with legal. |

**Accuracy note.** Statuses below are the *repo-grounded* reads. Where the repository does not
prove a DPA exists, the status is **To provision** or **NEEDED**, never "Signed". Every open item
names its owner so it is tracked here rather than deferred silently.

---

## Sub-processor inventory

Compiled from: env-var usage (`.env.example`, `.env.local`), `package.json` (web + mobile),
integration modules under `src/lib/`, the push/billing/AI paths, and the existing public
sub-processor table in `app/privacy/page.tsx`. Regions are the vendors' documented defaults where
the repo states one; otherwise "to confirm".

### Core infrastructure

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **Supabase** | Postgres DB, Auth, Storage, Edge Functions — the system of record | Account email, all app data (food logs, weight, recipes, plans), uploaded images, user id | **To provision** — signable via Dashboard → Org Settings → Legal (runbook §9) | EU (Frankfurt), per privacy policy | The primary processor; holds the most sensitive data. Highest-priority DPA. |
| **Vercel** | Web hosting + edge network | HTTP request metadata, IP address | **To provision** — Vercel DPA auto-applies via ToS; record acceptance | Global edge, US primary | Not in runbook §9 list — add it. IP is personal data under GDPR. |
| **Upstash** | Distributed rate-limit state + AI/fal budget counters (Redis) | IP address, request counters keyed by user id / IP | **To provision** — confirm Upstash DPA on file | US / EU (privacy policy) | Falls back to in-memory when unconfigured; when configured in prod it stores IP-derived keys. |

### Billing

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **Stripe** | Web subscriptions / billing | Email, payment card (collected by Stripe directly as an independent controller for card data), billing address for tax | **To provision** — auto-applied via Stripe DPA/ToS; record acceptance | US / Ireland | Card data is Stripe-controller; the account/email link is processor-side. |
| **RevenueCat** | iOS IAP receipt verification + entitlement reconciliation | IAP receipt, Supabase user id, app user id | **To provision** — signable via RevenueCat dashboard (runbook §9) | US | Server-side entitlement source of truth for mobile. |
| **Apple (App Store, StoreKit, Sign in with Apple, HealthKit)** | iOS purchases, sign-in relay, Health sync | IAP receipt, Apple private-relay email, HealthKit permission grants + synced health metrics | **To provision** — governed by the Apple Developer Program License Agreement; no separate signable DPA, confirm coverage with legal | Global | Health data is a special category (GDPR Art. 9). Apple relay email may be the only email on file for Apple-sign-in users. |
| **Google Play** | Android purchases (**future — not shipped; iOS-only today**) | Purchase token, account email | **N/A today** — no Android build target (see project context) | Global | Listed in the privacy policy as "future". Not an active data path. Do not sign until Android ships. |

### AI / imagery (the launch-critical gaps)

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **Anthropic (Claude)** | **Active** AI provider — photo/text meal logging, recipe parsing, digest narrative, coach, refine-log, voice-log refinement (`src/lib/server/aiProvider.ts` prefers Claude when `ANTHROPIC_API_KEY` is set) | User-uploaded meal images, caption / URL / free-text the user submits, recipe text. No account email or DB rows sent, but images can be personal data. | **NEEDED** — DPA to provision via Anthropic's commercial terms **AND** Anthropic is **not disclosed in the privacy policy** (see "Reconciliation" below) | To confirm (US default) | **Gap.** The privacy policy names only "OpenAI" for AI features; the code's default vendor is Anthropic. Both the DPA and the disclosure must be fixed before launch. |
| **fal.ai** | AI image generation — recipe hero images + ingredient images (`src/lib/server/falImageGenerator.ts`, ENG-863/865/999) | Recipe title + key ingredient names the user entered (user-generated content). No account email/id sent to fal; generated image is uploaded to Supabase Storage server-side. | **NEEDED** — no DPA arranged **and not disclosed in the privacy policy**. This is the ENG-865 finding. | To confirm | **The headline gap.** Provision a fal.ai DPA (or confirm their ToS DPA covers it) and add fal.ai to the privacy-policy sub-processor table. fal routes generation to underlying model hosts (Google Gemini 3 Pro Image via `nano-banana-pro` / Black Forest Labs FLUX) as fal's own sub-processors — covered under fal's DPA + sub-processor list; confirm on provisioning. |
| **OpenAI** | **Fallback/legacy** AI provider — used only when `ANTHROPIC_API_KEY` is absent (photo/text meal logging, recipe parsing) | Same categories as Anthropic (uploaded image, caption/URL/text). **Voice audio is NOT sent** — transcription runs on-device (Web Speech API / `expo-speech-recognition`, per `app/api/nutrition/voice-log/route.ts`); only the resulting transcript **text** reaches the AI vendor, no audio leaves the device. | **To provision** — DPA available via the OpenAI API platform (runbook §9) | US | Currently disclosed in the privacy policy as the AI vendor, but is the fallback path, not the default. Keep the DPA; fix the disclosure to name both. |

### Nutrition data sources

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **Supadata** | Recipe-import content acquisition — web-page scrape + video transcript (`src/lib/server/supadata/`) | The URL the user submits to import + the public page/transcript content returned. No account data. Server-only key. | **To provision** — confirm Supadata DPA / ToS coverage | US (privacy policy) | The imported URL can reveal user interest but carries no account identifier. Confirm with legal whether the URL alone is personal data in context. |
| **Edamam** | Branded + restaurant food database lookups (`src/lib/edamam/client.ts`) | Ingredient / food text query only. No account data. | **To provision** — signable via Edamam dashboard (runbook §9) | US | Query text is not linked to a user id at the vendor. |
| **FatSecret** | Branded-food + autocomplete lookups (`src/lib/fatsecret/client.ts`) | Ingredient / food text query only. No account data. | **To provision** — review tier-specific terms (Basic tier; runbook §9). See the FatSecret decision docs. | US | Basic-tier caching restrictions are a separate compliance thread (see `docs/decisions/2026-04-25-fatsecret-tier-confirmation.md`), not a DPA question. |
| **USDA FoodData Central** | Public-domain generic-food database | Ingredient / food text query only. No account data. | **N/A — no personal data** (US public-sector, public-domain data) | US (public sector) | No DPA required; recorded for completeness. |
| **Open Food Facts (OFF)** | Product / barcode lookups (ODbL data) | Barcode or product-name query only. No account data. | **N/A — no personal data** | EU (France) | Governed by ODbL obligations (`docs/decisions/2026-04-19-off-odbl-architecture.md`), which are a licensing matter, not a DPA. |

### Analytics, errors & delivery

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **PostHog** | Product analytics + session replay (opt-out honoured) | Event names, device id, page views, session replays (form inputs masked), Supabase user id as distinct id | **To provision** — PostHog DPA auto-applies via ToS; record acceptance (runbook §9) | EU (Frankfurt) | Session replay makes this higher-sensitivity than plain analytics; masking is on. |
| **Sentry** | Error / crash reporting (opt-out honoured) | Stack traces, device type, Supabase user id | **To provision** — Sentry DPA auto-applies via ToS; record acceptance (runbook §9) | EU (Frankfurt) | Never log secrets/PII into breadcrumbs (project rule). |
| **Expo / EAS** | Mobile OTA updates, **Expo push-notification delivery**, crash logs | Device id, Expo push token (`ExponentPushToken`), OTA update requests | **To provision** — signable via the EAS dashboard (runbook §9) | US | Push tokens are device identifiers. Covers the mobile push path (`src/lib/push/expoPush.ts`). |
| **Web Push (VAPID) / browser push services** | Web push-notification delivery (`src/lib/push/webPushSend.ts`) | Browser push-subscription endpoint (points at Apple/Google/Mozilla push gateways), VAPID-signed payloads | **To confirm** — the endpoint operator is the user's browser vendor (Apple/Google/Mozilla); assess whether a separate DPA applies or whether it is covered under existing platform terms | Global (endpoint-operator dependent) | Not a discrete "vendor" account — the push endpoint is chosen by the user's browser. Included so the web push path is not invisible. |

### Internal tooling (not user-facing data paths — recorded for completeness)

| Vendor | Purpose in Sloe | Personal-data categories processed | DPA status | Data region | Notes |
|---|---|---|---|---|---|
| **Centercode** | Beta-feedback / release announcements — **internal beta ops only** (`scripts/centercode/`) | Beta-tester feedback + release metadata (Grace-operated; not end-user product data) | **To confirm** — assess whether beta-tester PII flows here; if so, provision a DPA | To confirm | Not part of the shipped product's data path. Included so it is not overlooked if the beta programme scales beyond N=1. |
| **Linear** | Internal issue tracking (`LINEAR_API_KEY`) | No end-user personal data — internal engineering data only | **N/A — no end-user data** | To confirm | Recorded for completeness; not a product sub-processor. |

---

## Reconciliation against existing docs

Checked against `app/privacy/page.tsx` (public sub-processor table), the
[legal-finalization runbook §9](../operations/legal-finalization-runbook.md), the
[launch checklist](../launch/checklist.md) item 17, and the
[IP follow-ups doc](../planning/archive/ip-followups-2026-04-19.md). Findings:

1. **fal.ai is missing from the privacy policy.** The public sub-processor table lists 17 vendors
   but does **not** include fal.ai, despite it being an active image-generation sub-processor that
   receives user-entered recipe content. **→ Add fal.ai to `app/privacy/page.tsx` and provision a
   DPA.** (This is the ENG-865 finding, now recorded.)

2. **The privacy policy names "OpenAI" as the AI vendor, but the active default is Anthropic
   (Claude).** `src/lib/server/aiProvider.ts` prefers Claude whenever `ANTHROPIC_API_KEY` is set
   (which it is in `.env.local`/prod); OpenAI is the fallback. The public disclosure and the DPA
   register must **both** name Anthropic. **→ Add Anthropic to `app/privacy/page.tsx` and provision
   an Anthropic DPA.** *(This is a live privacy-disclosure accuracy gap — flag for legal-reviewer
   even though it is out of scope for the ENG-1277 doc change itself.)*

3. **The runbook §9 DPA list is incomplete.** It lists Supabase, Stripe, RevenueCat, Expo, PostHog,
   Sentry, OpenAI, Edamam, FatSecret. It **omits**: Anthropic, fal.ai, Supadata, Upstash, Vercel,
   Apple, USDA, Open Food Facts. This inventory is the superset; the runbook's back-link (added in
   the same change) points here so the two stay reconciled.

4. **The privacy policy asserts every sub-processor "is bound by a data-processing agreement."**
   The [launch checklist](../launch/checklist.md) item 17 records all vendor DPAs as **Pending**,
   and there is no signed-DPA evidence in the repo. Until DPAs are actually in place, that sentence
   is **aspirational, not factual**. **→ Either sign the DPAs before UK/EU public launch, or soften
   the privacy-policy wording until they are.** (Legal-reviewer + founder call.)

No direct contradictions were introduced by this doc — it is a superset of, and consistent with,
the existing privacy-policy table.

---

## Open items requiring founder / legal action

These are the tracked open items (not silent deferrals — each names its owner). They gate UK/EU
public launch, per the runbook.

| # | Item | Owner | Priority |
|---|---|---|---|
| 1 | **Provision + record a fal.ai DPA** and add fal.ai to the privacy-policy sub-processor table | Founder + `legal-reviewer` | P0 (ENG-865) |
| 2 | **Provision an Anthropic DPA** and add Anthropic to the privacy-policy AI disclosure (currently only OpenAI is named) | Founder + `legal-reviewer` | P0 |
| 3 | Confirm + record DPA acceptance for the auto-applied processors (Supabase, Stripe, Vercel, Upstash, RevenueCat, PostHog, Sentry, Expo, OpenAI, Supadata, Edamam, FatSecret) | Founder | P1 |
| 4 | Confirm the "no personal data" characterisation for USDA, Open Food Facts, and the nutrition-query vendors (Supadata / Edamam / FatSecret) with legal | `legal-reviewer` | P1 |
| 5 | Assess whether the web-push (VAPID) path and Centercode beta ops require their own DPAs | `legal-reviewer` | P2 |
| 6 | Decide whether to sign all DPAs before launch **or** soften the privacy-policy "each is bound by a DPA" wording until they are | Founder + `legal-reviewer` | P1 |
| 7 | When DPAs are executed, flip the relevant rows above from **To provision** / **NEEDED** to **Signed** and update [launch checklist](../launch/checklist.md) item 17 | Founder | — |

---

## What this document is NOT

This is a repo-grounded engineering inventory of the vendors in Sloe's data path and the current,
observable state of their DPAs. **It is not legal advice and does not assert that any DPA is
executed.** Every "Signed" determination, every data-residency claim, and every "no personal data"
characterisation must be confirmed by `legal-reviewer` and the founder against the actual signed
agreements and the vendors' current terms before it can be relied on for launch.

## Related artefacts

- [Legal finalization runbook §9 — Vendor DPAs](../operations/legal-finalization-runbook.md#9-vendor-dpas)
- [Launch checklist item 17](../launch/checklist.md)
- [IP follow-ups (SCC / DPA record requirement)](../planning/archive/ip-followups-2026-04-19.md)
- Privacy policy sub-processor table: `app/privacy/page.tsx` (`#subprocessors`)
- [Open Food Facts ODbL architecture](../decisions/2026-04-19-off-odbl-architecture.md)
- [FatSecret tier confirmation](../decisions/2026-04-25-fatsecret-tier-confirmation.md)
</content>
</invoke>
