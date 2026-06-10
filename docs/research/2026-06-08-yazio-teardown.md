# Yazio — what they do, how, vendors, and what Sloe should borrow vs beat

> **Date:** 2026-06-08 · **Area:** Competitive / teardown · **Status:** Research (informs the
> warm-coaching onboarding direction, monetisation/paywall posture, and MFP-refugee capture)
> **Owner:** product-lead (competitive) + brand-manager (funnel copy) + monetisation
> **Method:** (1) primary-source mining of Yazio's shipped **web bundle** — a Nuxt 3 / Vue 3 / Pinia
> app on `yazio.com` (marketing site + a full conversion **onboarding funnel** at `/en/app`),
> fetched to `/tmp/yazio_nuxt` (41 JS chunks; the two payloads of interest are `CavAtjCV.js` 1.0 MB
> entry/vendor and `Dn2BZ4Hk.js` 455 KB funnel app); (2) the inlined Nuxt `window.__NUXT__.config`
> public runtime config (full vendor wiring, live keys); (3) a live GrowthBook payload + GTM
> container fetch to confirm which flags/pixels actually fire; (4) WebSearch/WebFetch for the
> **mobile-only** product surface, App Store positioning, pricing, business facts, and user pain.
> **Relevant to:** `project_competitor_set_and_mfp_exodus.md` (Yazio is in the named set and is the
> closest "calorie + recipe + fasting" analogue to Sloe) · `project_suppr_positioning.md` ("love food
> AND have goals") · `project_viral_growth_strategy.md` (their paid funnel is the thing we *don't*
> have and arguably shouldn't copy) · `docs/research/2026-06-08-lifesum-teardown.md` (sister teardown,
> same technique).

## TL;DR

**Feasibility — better than Lifesum.** Unlike Lifesum (marketing site only), Yazio ships a **real,
inspectable web product**: a Noom/Simple-style **paid-acquisition onboarding funnel** at
`yazio.com/en/app/onboarding/*` that runs entirely in the browser, **proxies the canonical Yazio app
API** (the same OAuth2 backend the iOS/Android apps hit), and ends in a **Stripe/Braintree web
checkout**. The actual food diary, food DB, barcode scanner, AI photo logging and fasting timers
remain **native-app-only** — but the funnel bundle gave us a *confirmed* backend service map, the full
vendor stack with live keys, the entire quiz taxonomy, and the pricing/checkout architecture. Very
high-signal teardown.

**What they do well, one line each:**
- **The funnel IS the product moat.** A ~40-screen, goal-branched, psychology-heavy "encouraging
  flow" quiz (contracts-with-yourself, affirmations, role-models, barrier-handling) that ends in an
  **AI-generated personalised plan** and a hard paywall. This is a *growth-engineering* asset, not a
  feature — it's how a 100M-download freemium app converts paid web traffic.
- **GLP-1 funnel branch** (`onboarding/glp-1`) — a dedicated Ozempic/Wegovy on-ramp, the hottest 2025
  weight-app wedge. Confirmed as a first-class goal alongside lose/gain-weight/build-muscle.
- **Explicit competitor-switch capture** — the quiz literally asks *which app you're leaving*
  (`app_choice.{mfp, loseit, lifesum, noom, ww, fatsecret, simple, yazio, other}`) and serves a
  tailored affirmation. They are *engineering* MFP-refugee capture into the funnel.
- **AI photo logging** ("snap a photo → get insights → reach goals"), barcode scanner, 4M-item food
  DB, 2,900+ expert recipes with cooking mode + grocery lists, 20+ fasting trackers (16:8 / 5:2 /
  6:1), water + activity + mood/symptom logging, Apple Watch / Fitbit / Garmin sync.
- **Region/segment-aware dynamic pricing** — a `price-segments/voucher/` endpoint + Stripe
  `update-tax` (VAT-inclusive EU checkout). They vary price by segment and handle tax natively (a
  thing our `project_region_aware_pricing.md` says we still owe).

**Vendor headline (confirmed from bundle + live config):** **Cloudflare** edge/CDN ·
**Nuxt 3 / Vue 3 / Pinia** front end · **Stripe** (`pk_live_…`) primary web card payments +
**Braintree** secondary (PayPal) · **GrowthBook** feature-flags/experiments, **self-hosted behind a
first-party proxy** at `fae.yazio-analytics.com` with an *encrypted* SDK payload · **GTM**
(`GTM-MQMD936`) fanning out **GA4 + Google Ads/DoubleClick + Meta Pixel + AppsFlyer** · **Sentry**
(org `o450822`, US ingest) · **OpenAI** for the onboarding-summary plan generation · Sign-in-with
**Apple + Google** + OAuth2 password grant · **imgproxy**-style on-the-fly image pipeline
(`images.yazio-cdn.com/process/…`). Mobile attribution adds **Adjust + AppsFlyer**.

**The strategic read.** Yazio is the **single closest competitor to Sloe's surface area** (calories +
macros + recipes + fasting in one app) and the **best reference for a converting onboarding funnel** —
their goal-branched, emotionally-scaffolded quiz with an AI plan reveal is genuinely world-class growth
engineering and worth studying screen-by-screen. But they are **beatable on the three axes we already
own**: (1) **no recipe-import / social viral loop** — their growth is *paid* (Google Ads + Meta +
AppsFlyer funnel), which is expensive and not defensible the way our attributed Reel-import loop is;
(2) **the food DB is European-packaged-skewed, duplicate-ridden, and the AI photo logging is paywalled
*and* flagged inaccurate** by users — our count-to-weight + reject-low-confidence rigour beats it on
trust; (3) **they paywall the barcode scanner and AI logging** (a recent, much-resented change) — an
MFP refugee who lands on a barcode paywall is *our* acquisition opening, the same lever we noted for
Lifesum. Borrow the *funnel concept* and the *GLP-1 + competitor-switch capture*; beat them on the loop,
the data integrity, and a less punitive free tier.

---

## 1. Feasibility: is there an inspectable web app? (web-vs-mobile)

| Endpoint | Result | What it is |
|---|---|---|
| `https://www.yazio.com/en` | **HTTP 200, 85 KB** | Nuxt 3 marketing site. Confirmed. |
| `https://www.yazio.com/en/app/onboarding/welcome` | **HTTP 200** (redirect target of `/en/app`) | **The conversion funnel** — a full client-side quiz → AI plan → checkout. The real find. Confirmed. |
| `https://www.yazio.com/en/start/calorie-counter` | **HTTP 200** | One of many SEO "start/*" acquisition landers. Confirmed. |
| `https://app.yazio.com` | **HTTP 404** | Does not serve a product. |
| `https://my.yazio.com` | **HTTP 000** (no connection) | Does not exist. |
| `/en/{diary,food,recipes,fasting,account,login}` | **HTTP 404** | No food-logging web app. The diary/DB/scanner/timers are **native-app-only**. |

**Conclusion.** The diary, food database, barcode scanner, AI photo recognition and fasting timers are
**not web-inspectable** — they live in the iOS/Android apps (noted as inferred where cited). What the
web bundle *does* expose, with full fidelity, is: the **acquisition funnel logic**, the **proxied core
API surface**, the **payment/checkout architecture**, the **experiment platform**, and the **complete
vendor wiring with live public keys**. That's a richer haul than Lifesum gave us.

---

## 2. Backend service map (confirmed from bundle)

The funnel's API base is the relative path **`/api`** — i.e. all calls go to the Nuxt server, which
**proxies** to the canonical Yazio app backend. The real backend host is never exposed client-side
(good hygiene). Two proxy layers are visible:

### 2a. Funnel/BFF endpoints (`/api/*` — Nuxt server)
| Path | Purpose (confirmed/inferred) |
|---|---|
| `/api/proxy/app/**` | **Pass-through to the canonical Yazio app API** (see 2b). Confirmed. |
| `/api/ai/onboarding-summary` (`POST`, body `{locale,…}`) | **Server-side LLM** that generates the personalised plan/summary at the end of the quiz. Confirmed (string `ai-onboarding-summary`, OpenAI ref present). |
| `/api/features/…` | Feature-flag fetch (GrowthBook-backed; see §4). Confirmed. |
| `/api/eval/` | Experiment/flag evaluation endpoint. Confirmed (string). |
| `/api/store`, `/api/store/persist` | **Funnel state persistence** — the quiz saves answers server-side between steps (resumable funnel). Confirmed. |
| `/api/_nuxt_icon` | Nuxt icon server module. Confirmed (not product-relevant). |

### 2b. Canonical Yazio app API (proxied via `/api/proxy/app/*` — same backend the mobile apps use)
| Path | Purpose | Confirmed? |
|---|---|---|
| `app/oauth/token` | **OAuth2 token**. Grant types seen: `password`, `refresh_token`, `sign_in_with_apple`, `sign_in_with_google`. Client id + secret are in the public config (see §3 — note). | Confirmed |
| `app/user` | User profile read/write. | Confirmed |
| `app/user/goals` | Goal settings (calorie/macro targets, weight goal). | Confirmed |
| `app/user/subscription` + `/subscription/stripe` + `/subscription/braintree` | **Subscription state, gated by payment provider** — Stripe and Braintree are first-class siblings. | Confirmed |
| `app/user/coupon-codes/redeem` | Promo/voucher redemption (the `/promo-code` 20%-off page feeds this). | Confirmed |
| `app/user/password`, `app/user/send-reset-token` | Password set + reset-token email. | Confirmed |
| `app/price-segments/voucher/…` | **Price-segment lookup** — pricing varies by segment/region/experiment, not a static SKU table. | Confirmed |
| Stripe BFF: `…/stripe/create-customer-and-intent`, `…/stripe/update-tax` | **PaymentIntent + dynamic tax** — create customer & intent, then recompute VAT/tax before confirm. | Confirmed |

**Read:** this is a clean OAuth2 + REST architecture with a Nuxt **BFF (backend-for-frontend)** that
proxies and hides the core API, persists funnel state, and runs the AI plan generation. The mobile
apps and the web funnel **share one identity + subscription backend** — so a user who pays on the web
funnel is immediately entitled in the app. (Sloe parallel: this is exactly the web→app entitlement
hand-off we'd need if we ever ran a paid web funnel.)

---

## 3. Vendor stack (confirmed from inlined `window.__NUXT__.config.public` + live fetches)

> The funnel inlines its **entire public runtime config** in the HTML. Verbatim keys below (live, but
> these are *publishable* client keys — Stripe `pk_live`, GrowthBook *client* SDK key, GTM id, Google
> OAuth client id, Sentry public DSN. **Caveat:** the config *also* exposes `oauthClientId` +
> `oauthClientSecret` for the password grant — a confidential-client secret shipped to the browser,
> which is a real (if common-in-this-space) weakness, not something to emulate. Not reproduced here.)

| Layer | Vendor | Evidence (confirmed) |
|---|---|---|
| **Edge / CDN / hosting** | **Cloudflare** | `server: cloudflare`, `cf-ray`, `cf-cache-status: DYNAMIC` (app) / `HIT` (images). |
| **Front-end framework** | **Nuxt 3 + Vue 3 + Pinia** | `/_nuxt/*` chunks, `window.__NUXT__`, `pinia`/`vue` strings in entry bundle. |
| **Card payments (primary)** | **Stripe** | `stripePublishableKey:"pk_live_97XOsrpL7LmEiAz8WRYO5Q3N"`; `stripe_elements`, `create-customer-and-intent`, `update-tax`, `stripe_mid`/`stripe_sid`. |
| **Card payments (secondary)** | **Braintree** (PayPal) | `braintree` in config + `/user/subscription/braintree`. |
| **Experiments / feature flags** | **GrowthBook, self-hosted behind a first-party proxy** | `growthBookClientKey:"sdk-AThfZ824…"`, `growthBookApiHost:"https://fae.yazio-analytics.com"`, `growthBookEncryptionKey:"CJK6f7NQ…"`. Live fetch of `…/api/features/sdk-AThf…` returned `encryptedFeatures` (flag names hidden). `abTestsEnabled:"true"`. |
| **Tag manager → ad pixels** | **GTM `GTM-MQMD936`** fanning out | GTM container fetch shows **GA4 + Google Ads/DoubleClick conversion + Meta Pixel (`fbq`, heavy) + AppsFlyer** firing. Pinterest/TikTok/Snap tags present in page/config but not the primary live container tags. |
| **Error monitoring** | **Sentry** | `sentryDsn:"https://e02e5a4c…@o450822.ingest.us.sentry.io/…"`, `sentryEnabled:true`, `sentry-environment=prod_server`. |
| **AI / LLM** | **OpenAI** (inferred provider) | `openai/` string + `/api/ai/onboarding-summary` server route. The funnel's plan-reveal text is LLM-generated; the food-photo recognition is server-side (provider not exposed). |
| **Auth / social login** | **Apple + Google** | `siwaClientId:"com.yazio-website.siwa"`, `siwgClientId:"…apps.googleusercontent.com"`, OAuth `sign_in_with_apple`/`sign_in_with_google` grants. |
| **Image pipeline** | **imgproxy-style on-the-fly processing** | `images.yazio-cdn.com/process/plain/…` (URL-addressed transforms), 1-year `cache-control`, Cloudflare-fronted. |
| **Mobile attribution** | **Adjust + AppsFlyer** | `adjust` strings in bundle; AppsFlyer in both bundle and GTM (web→app deferred-deep-link attribution). |
| **First-party analytics relay** | **`fae.yazio-analytics.com`** | Doubles as the GrowthBook proxy host — a first-party-domain collector that dodges ad-blockers. |

**Notable architecture choices worth flagging for Sloe:**
- **GrowthBook over a first-party proxy with encrypted payloads** is a genuinely good pattern — it's
  ad-blocker-resistant *and* hides experiment names from competitors doing exactly this teardown. (We
  use PostHog flags; same threat model — worth noting they're a step ahead on flag-name secrecy.)
- **Stripe + Braintree dual-rail** is belt-and-braces for a global freemium app (PayPal coverage in
  EU/DACH where Yazio is strongest).
- **Dynamic price-segments + Stripe `update-tax`** is the VAT-inclusive, region-aware pricing we still
  owe per `project_region_aware_pricing.md` and `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md`.

---

## 4. Experiment / feature-flag platform (confirmed)

- **Platform:** GrowthBook, `abTestsEnabled:"true"`, encrypted SDK payload (flag/experiment names are
  *not* readable client-side — the live payload returned `"features":{}` + an opaque
  `encryptedFeatures` blob and `"experiments":[]` to anonymous fetch).
- **Bundle has the full GrowthBook client** (`experimentResult`, `variationId`, `getExperiments`,
  `experiment.assigned`, plus an internal **`ab-test-switcher`** dev tool with `active-tab` /
  `flag-type` / `search` — an internal QA panel for toggling variants).
- **Roadmap inference (from funnel route/i18n keys, not flag names):** heavy A/B surface area on the
  **AI food-tracking intro** (`ai_food_tracking_variant`, `…_bubbles`, `…_bubbles_list`,
  `…_fasting` — at least 4 variants of the same screen), the **encouraging-flow** copy, and
  goal-branch routing. They are clearly optimising the *funnel* relentlessly, screen by screen.

---

## 5. The onboarding funnel — the real lesson (confirmed taxonomy)

Route order (confirmed from chunk strings):
`welcome → onboarding (the quiz) → illustrations → success-stories → glp-1 (branch) → partner →
checkout → coupon → finalize-account / finalize-zip → success` (+ a `swift` fast-path variant).

The quiz is an **"encouraging_flow"** (i18n root `onboarding.encouraging_flow.*`) — a goal-branched,
emotionally-scaffolded Noom-clone. Confirmed structure:

- **Goal branches:** `lose_weight` / `gain_weight` / `build_muscle` / **`glp_1`** (each with its own
  reason, past-experience, gain-causes, motivation, plan-trust sub-flows).
- **Competitor-switch capture:** `calorie_counting.app_choice.{mfp, loseit, lifesum, noom, ww,
  fatsecret, simple, yazio, other}` + a `past.{app, spreadsheet, paper, website, mental_calc,
  calculator}` "how did you track before" question → each gets a tailored affirmation. **They are
  funnel-engineering MFP-refugee capture.**
- **Psychological scaffolding:** `contract_with_yourself` (a literal commitment contract screen),
  `commitment_transition` (goal_commitment / plan_review / plan_reference), `barriers.{not_hungry,
  weekend, not_alone_affirmation}` (objection pre-handling), `changes.{role_model, differences,
  success_factors}`, `environment.{work_schedule, children, eating_habits, stay_motivated,
  supporter}` (context for personalisation + social-support framing).
- **Lifestyle/health profiling:** sleep `duration`, `energy_level` / `energy_vitality`, `carb_intake`,
  `diet.{dietary_preferences, vegan/vegetarian/pescatarian recipes_affirmation}`, fasting experience.
- **Payoff:** `ai_intro` + `ai-onboarding-summary` (LLM-generated plan reveal) → `success_stories`
  (before/after social proof) → **checkout** (Stripe Elements) → `coupon` (20%-off catch) → account
  creation *after* the value is shown.

**This is the canonical 2025 weight-app paid funnel.** It is not a feature — it's the conversion
machine that turns expensive Google/Meta clicks into trials. Worth a dedicated screen-by-screen
capture pass (Playwright `web-drive` on `/en/app/onboarding/welcome`) before we design our own
onboarding/paywall.

---

## 6. Product, pricing & business context (mobile-only surface — from search, marked as such)

**Positioning (App Store, confirmed):** subtitle **"Food scanner for weight loss"**, listed as
**"AI Calorie Tracker by Yazio."** **4.7★, ~48K ratings** (US App Store). 100M+ downloads, 20
languages, 150+ countries.

**Feature set (App Store / help center, inferred for product depth):** 4M+ food DB, barcode scanner,
**AI photo food logging** (added late 2025), macro/nutrient analysis + food ratings, 2,900+
expert recipes (low-carb/veg/vegan filters, step-by-step cooking mode, smart grocery lists), 20+
fasting trackers (16:8 / 5:2 / 6:1), water tracking, step/activity tracking, Apple Watch + Fitbit +
Garmin sync, mood/symptom logging, body-metric trends.

**Pricing (confirmed from store + promo page):** **Yazio PRO ≈ $6.99/mo or $47.90/yr** (~$3.99/mo
annualised); other tiers seen **3-month $23.99, semi-annual $34.99**; **7-day free trial**; a standing
**20%-off annual** via `/promo-code` (→ ~$38.32/yr). Cheaper than MyFitnessPal Premium ($79.99) and
Lifesum ($99.99); pricier than Lose It ($39.99). **PRO gates:** AI photo logging, **barcode scanner**,
full fasting programs, advanced deficit tools, in-depth analysis, custom meal plans, mood/symptom +
body metrics, third-party device sync, ad-free.

**Ownership / company (confirmed):** **YAZIO GmbH, Erfurt, Germany**; founded by Sebastian Weber &
Florian Weißenstein; **~120–144 employees**; **majority-acquired by Groupe SEB** (French consumer-goods
giant — Tefal/Krups/Moulinex), founders still leading. Freemium PRO is the revenue model.

**What users praise (reviews, confirmed):** "way more organized… super well designed"; automatic
calorie/macro math; intake-vs-burned motivation; clean visual design.

**What users complain about (reviews — our openings, confirmed):**
- **Barcode scanner now requires PRO** — a recent, much-resented paywall move ("paying $45/yr to scan
  a barcode"). The single loudest gripe.
- **AI photo logging is paywalled *and* inaccurate** — "less accurate than purpose-built alternatives,"
  underestimates portions/unpackaged food.
- **Food DB is European-packaged-skewed** — duplicate entries with conflicting macros; chain-restaurant
  and common US foods often missing → manual entry.
- **No offline mode** — heavily requested, not shipped; the app needs internet to function.
- **Reliability complaints** — Apple Watch app crashes; reports of the app "stopping working" after a
  period; intrusive upsell pop-ups; data-loss anecdotes.

---

## 7. What Sloe should **borrow** vs **beat**

### Borrow (the concept, never the code)
1. **A goal-branched, AI-plan-reveal onboarding funnel** as the conversion spine. Yazio's
   `encouraging_flow` is best-in-class growth engineering. Our onboarding should branch by goal, ask a
   small set of profiling questions, and **reveal a personalised plan before the paywall** (we already
   have the targets engine to back a real plan, not just a mock — a *correctness* edge over a generic
   LLM blurb). Route into our existing flag-gated onboarding work.
2. **Competitor-switch capture in onboarding.** Ask "which app are you leaving?" with MFP/Lose
   It/Lifesum/Noom/etc. as options, and tailor the next screen (and our CSV-import offer) accordingly.
   This is *direct* support for `project_competitor_set_and_mfp_exodus.md` — and Yazio proves it
   converts. We can go one better: an MFP picker should immediately surface our **MFP CSV import**.
3. **A GLP-1 on-ramp.** A dedicated goal branch for people on Ozempic/Wegovy (protein-priority,
   muscle-preservation, side-effect-aware targets). Hot wedge, and it fits "love food AND have goals."
4. **First-party-proxied flags with hidden names.** Operationally, route our PostHog flag fetch through
   a first-party path and avoid leaking experiment names to teardowns like this one. (Note for
   platform-foundations; not urgent.)
5. **Region-aware, tax-inclusive checkout** (Stripe dynamic tax) — Yazio's `price-segments` +
   `update-tax` is the pattern we already owe per our VAT posture decision.

### Beat (where Yazio is structurally weak — these are our wedges)
1. **The viral loop they don't have.** Yazio grows by *paid* funnel (Google Ads + Meta + AppsFlyer).
   That's expensive and undefensible. Our **attributed recipe-import-from-Reel loop** is organic and
   compounding — the thing `project_julienne_competitive_pattern.md` and the viral plan are built on.
   Don't out-spend them on the funnel; out-*loop* them.
2. **Data integrity on the food DB + AI.** Their DB is duplicate-ridden and EU-packaged-skewed; their
   AI photo logging is paywalled *and* user-flagged inaccurate. Our **count-to-weight normalisation +
   reject-low-confidence + "don't guess"** rules (CLAUDE.md nutrition non-negotiables) are a direct
   trust advantage. Lead with accuracy, not a flashy-but-wrong photo scan.
3. **A less punitive free tier.** Yazio's **barcode-scanner-behind-PRO** move is the loudest complaint
   in their reviews — a moment of resentment for exactly the MFP refugee we want. Keeping **logging +
   barcode free** and monetising on the *goals/coaching/planning* layer is both kinder and on-brand for
   "permission, not restriction" (`project_suppr_positioning.md`).
4. **Offline-first.** Their most-requested missing feature. A reliable offline log is table stakes we
   can win on.

---

## 8. Confidence & caveats

- **Confirmed-from-bundle/live-fetch:** the funnel architecture, the proxied OAuth2 + REST endpoint
  map, the **entire vendor stack with live publishable keys**, GrowthBook (proxied + encrypted),
  Stripe+Braintree dual-rail + dynamic tax, the full quiz taxonomy, GLP-1 + competitor-switch branches,
  Cloudflare + imgproxy infra. These are primary-source facts.
- **Inferred (marked in §3/§6):** OpenAI as the specific LLM provider (the route + `openai/` string are
  confirmed; the model is not exposed); all native-app product depth, the food DB internals, AI
  photo-recognition provider, and the mobile attribution detail (from store/help-center/reviews, not
  the bundle).
- **Caveat (per the brief):** the bundle is **client logic only.** The food database, ingredient
  matching, AI photo recognition, recipe content, fasting-stage logic, and the actual subscription
  entitlement enforcement are **server-side** and not inspectable here — inferred from the public
  product surface.
- **One security note, not for emulation:** Yazio ships an `oauthClientSecret` (confidential-client
  password-grant secret) to the browser in plain config. Common in this app category, but it's a
  weakness — we should *not* copy that pattern.

**Overall confidence: 8/10** on "what they do / how / vendors" (primary-source bundle + live config +
GTM/GrowthBook fetches); 7/10 on the server-side and product-depth claims (third-party-sourced,
marked).
