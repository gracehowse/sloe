# Lifesum — what they do, how, vendors, and what Sloe should borrow vs beat

> **Date:** 2026-06-08 · **Area:** Competitive / teardown · **Status:** Research (informs the
> warm-coaching design direction + Life Score / food-rating exploration + monetisation posture)
> **Owner:** product-lead (competitive) + brand-manager (aesthetic) + design-director
> **Method:** (1) primary-source mining of Lifesum's shipped **web bundle** (React/Redux SPA on
> `lifesum.com`, fetched to `/tmp`), (2) live homepage screenshot read, (3) WebSearch/WebFetch
> fallback for the **mobile-only** product surface, backend, and vendors the bundle can't reach.
> **Relevant to:** `project_lifesum_aesthetic_direction.md` (the warm-coaching direction is partly
> Lifesum-inspired) · `project_competitor_set_and_mfp_exodus.md` (Lifesum is in the named set) ·
> `project_suppr_positioning.md` ("love food AND have goals").

## TL;DR

**Feasibility:** Lifesum is **mobile-first, not web-inspectable as a product.** The `lifesum.com`
bundle is a real React+Redux SPA — but it's a **marketing + account-management site only**
(landing pages, premium-upgrade funnel, sign-up, GDPR/CCPA account delete, gift cards, partner
co-brands). There is **no food-logging web app**; `app.lifesum.com` / `my.lifesum.com` /
`web.lifesum.com` do not resolve. The diary, food DB, barcode scanner, Life Score and meal plans
all live in the native iOS/Android apps. So the bundle gave us a **clean backend service map +
web vendor stack** (confirmed from source); the product UX + server stack came from search
(confirmed from third-party docs/jobs pages, marked as such).

**What they do well, in one line each:**
- **Life Score** — a single weekly 0–100 health number derived from ~16 nutrients (not just
  calories). Their signature differentiator and the thing the brand is built around.
- **Warm-coaching aesthetic** — cream/beige canvas, soft green accent, lifestyle food photography,
  calm editorial copy ("Eat well, live well" / "enjoying the foods you love"). This *is* the look
  Sloe's warm-coaching direction is reaching for.
- **Meal plans as the premium hook** — keto, high-protein, 5:2, 16:8 fasting, Mediterranean, etc.,
  with auto grocery lists. Curated content, not an algorithm.
- **Multimodal AI logging** (Feb 2025) — photo / voice / text / barcode in one capture. Marketed as
  "world-first", but post-launch reviews flag accuracy regressions (cashews→shrimp, phantom coffee
  from a mug in frame, double-counted barcodes).
- **Aggregated food DB** — they explicitly **don't** own a proprietary DB; they stitch USDA +
  MyNetDiary + UK FSA + German BLS + user-submitted, with a blue "verified" badge.

**Vendor headline (confirmed):** AWS/CloudFront hosting · **Adyen** web card payments ·
**Adjust** mobile attribution · **DatoCMS** headless content · **Sentry** errors · GA4 + GTM +
**Facebook pixel** marketing analytics · **Braze** lifecycle CRM/messaging · Apple/Google/Facebook
social login. Backend (third-party-reported): **Go + Postgres/Aurora + Kinesis on AWS EKS**.

**The strategic read:** Lifesum is the *best existing reference for the warm-coaching skin* and for
**Life Score as a "health, not just calories" narrative** — both things Sloe should borrow the
*concept* of. But Lifesum is **beatable on three axes Sloe already owns**: (1) it has **no recipe-
import / social viral loop** (our wedge), (2) its **food DB is aggregated and its 2025 AI is buggy**
(our count-to-weight + reject-low-confidence rigour beats it), and (3) it **monetises by paywalling
the food DB / barcode / macros with no free trial** — a punitive posture an MFP-refugee will resent,
which is our acquisition opening.

---

## 1. Feasibility: is there an inspectable web app? (web-vs-mobile)

| Endpoint | Result | What it is |
|---|---|---|
| `https://lifesum.com` | **HTTP 200, 245 KB** | React+Redux marketing SPA (webpack code-split, `loadable-components`, `@reduxjs/toolkit`). Confirmed. |
| `https://app.lifesum.com` | **HTTP 000 (no DNS/connection)** | Does not exist. |
| `https://my.lifesum.com` | **HTTP 000** | Does not exist. |
| `https://web.lifesum.com` | **HTTP 000** | Does not exist. |

**Verdict: effectively mobile-only as a product.** The web bundle is inspectable but is a
marketing/account surface, so it yields the **service map + web-side vendors** but not the food-
logging UX. Hosting headers: `server: CloudFront`, `x-amz-cf-*`, `via: …cloudfront.net` →
**AWS CloudFront/S3**. (Confirmed from response headers.)

The bundle's own page list (extracted from the webpack chunk manifest) confirms scope — every
route is marketing or billing, none is a tracker:

> `Home`, `FeaturesPage`, `PremiumPage`, `UpgradePage`, `SignUpPage`, `UserAccount`,
> `FinalizePaymentPage`, `PriceUpdater`, `MealPlansPage`, `PlanQuizPage`, `Glp1ListPage`/`Glp1Article`,
> `ReferralPage`, `BuyGiftCardPage`/`ActivateGiftCardPage`/`Redeem`, `Renew`, `VerifyPage`, `ResetPage`,
> `NutritionExplained`, plus partner co-brand pages: `NikePage`, `Samsung2022`, `Gympass`,
> `OscarHealth`, `LifesumForWork`, `DatoNativeAd`.

---

## 2. Backend service map (confirmed from the bundle's API calls)

The bundle calls `api.lifesum.com` with **named microservice prefixes** and explicit REST verbs —
this is the cleanest primary-source artefact of the teardown. The product API is **v2/v3**; auth is
a dedicated **"gatekeeper"** service; profile is **"userprofile"**.

| Service | Method + path | Purpose | Confidence |
|---|---|---|---|
| **gatekeeper** | `POST gatekeeper/v1/login/apple` | Sign in with Apple | Confirmed (bundle) |
| | `POST gatekeeper/v1/login/google/token` | Google token login | Confirmed |
| | `POST gatekeeper/v1/login/facebook` | Facebook login | Confirmed |
| | `POST gatekeeper/v1/login/lifesum` | Native email/password login | Confirmed |
| **accounts** | `POST v2/accounts/create` | Registration | Confirmed |
| | `DELETE v2/accounts/account_delete` | GDPR/CCPA account deletion | Confirmed |
| | `GET v2/accounts/account_info/` | Account read | Confirmed |
| | `POST v2/accounts/request_password_reset` | Password reset | Confirmed |
| | `… v2/accounts/verify_account/` | Email verification | Confirmed |
| **userprofile** | `GET / PATCH userprofile/v3/me` | Profile read/update | Confirmed |
| **store/pricing** | `GET / DELETE v2/store/subscription` | Subscription state + cancel | Confirmed |
| | `GET v2/pricing/products/web` | Web SKU catalogue | Confirmed |
| | `POST v2/pricing/verify_coupon/` | Coupon validation | Confirmed |
| **geo** | `GET v2/country` | Region detection (drives currency/pricing) | Confirmed |

**Data-model fields leaked** (from the Redux store reducers): `is_premium`, `premium_purchase_time`,
`new_style_subscription` / `isNewStyleSubscription` (they migrated subscription schemas and carry a
legacy/new flag), `verified`. (Confirmed from bundle.)

**Mobile bridge:** the web→app handoff uses the **`shapeupclub://`** deep-link scheme — a fossil of
Lifesum's original company name **"ShapeUp Club"** (the iOS bundle id is `com.sillens.shapeupclub`,
"Sillens" being the founding entity). Confirmed deep links: `shapeupclub://deeplink?action_id=gold`
(premium), `…?action_id=recipe_browse` (recipe browse — confirms a recipe-browse surface exists in-
app). (Confirmed from bundle.)

**Server stack (third-party-reported, NOT from bundle — treat as inferred-but-credible):**
**Go** services, **Postgres / Amazon Aurora**, **AWS Kinesis** (event streaming), **Kubernetes (EKS)**,
infra-as-code. Source: StackShare + Lifesum "Senior Backend Engineer" job post. Confidence: medium-
high (consistent across two independent sources, and consistent with the CloudFront + microservice
shape seen in the bundle).

---

## 3. Vendor stack

### 3.1 Confirmed from the web bundle (primary source)

| Vendor | Role | Evidence | Confidence |
|---|---|---|---|
| **AWS CloudFront / S3** | Web hosting + CDN | `server: CloudFront`, `x-amz-cf-id` headers | Confirmed |
| **Adyen** (`@adyen/adyen-web`) | **Web card payments** for the upgrade/`FinalizePaymentPage` flow | 92 refs; `node_modules/adyen/adyen-web` chunks | Confirmed |
| **Adjust** | Mobile attribution / deep-link routing | `Adjust.initSdk({appToken:"11gieguiu674"})`; events `Purchase`/`Start Registration`/`Complete Registration`; web link `app.adjust.com/112zb57z_…` | Confirmed |
| **DatoCMS** | Headless CMS for all marketing/blog/meal-plan content | `graphql.datocms.com`, `site-api.datocms.com`, 77 `datocms-assets.com` image refs | Confirmed |
| **Sentry** | Error tracking | DSN `…@sentry.io/1440941` exposed in bundle | Confirmed |
| **Google Analytics 4 + GTM** | Web product/marketing analytics | `G-Z8G409CFY1`, `GTM-TBDDZPSW` | Confirmed |
| **Facebook / Meta pixel** | Ad attribution + conversion | `connect.facebook.net`, `fbq`, pixel ids | Confirmed |
| **Awin + Adrecord** | Affiliate-marketing networks | `awinAdapter.ts`, `adrecordAdapter.ts`, `awin1.com`, `track.adrecord.com` | Confirmed |
| Apple / Google / Facebook ID | Social login | `appleid.cdn-apple.com`, `accounts.google.com`, `connect.facebook.net` | Confirmed |

**Notable architecture detail (worth borrowing — see §6):** their web analytics is a clean
**in-house adapter pattern** — a `useTracking()` hook fanning to swappable adapters
(`createAdapter.ts` → `adjustAdapter`, `gaAdapter`, `awinAdapter`, `adrecordAdapter`) plus named
semantic events (`trackAccountFlowDropOff`, `trackAuthenticationError`, `trackViewFaq`). One call
site, many destinations. (Confirmed from bundle chunk names.)

### 3.2 Confirmed from external sources (mobile-side / not in web bundle)

| Vendor | Role | Source | Confidence |
|---|---|---|---|
| **Braze** | Lifecycle CRM, push, in-app messaging, "personalized journeys" | Braze published customer case study | Confirmed (vendor's own case study) |
| **USDA · MyNetDiary · UK FSA · German BLS** | **Food-database data sources** (aggregated, licensed/public — not proprietary) | Lifesum Help Center "Lifesum's food database" | Confirmed |
| Multimodal AI vision/NLP model | Powers photo/voice food recognition (Feb 2025) | Lifesum PR + help docs | **Vendor undisclosed** — no public naming of OpenAI/Google/etc. Inferred third-party. |

### 3.3 False positives ruled out (so they don't get repeated)

Greps initially *appeared* to hit **Paddle**, **Segment**, and **Heap** — all three are **0 real
refs** on re-check (matched the English words "paddle"/"segment"/"heap" inside library/error
strings, not the SDKs). **Lifesum web payments = Adyen, not Paddle.** No Segment CDP, no Heap on web.
(This matters for Sloe's own merchant-of-record discussion: Lifesum is *not* a Paddle precedent.)

---

## 4. The product, surface by surface (mobile; from search + bundle hints)

| Surface | What it is | How it works | Confidence |
|---|---|---|---|
| **Life Score** | Single weekly **0–100 health score** | Derived from ~**16 key nutrients** + hydration + activity, recomputed weekly. Bundle strings `home_features_lifescore_*` confirm it's the hero feature; help-center confirms the 16-nutrient basis. **Caveat they admit:** Life Score / per-food rating is **disabled when on a Meal Plan or using Multimodal AI tracking** — a real product seam. | Confirmed |
| **Food rating** | Per-food traffic-light quality grade | Rates individual logged foods (green→red) on nutritional quality, separate from calories. | Confirmed |
| **Multimodal AI logging** | Photo / voice / text / barcode in one flow | Launched Feb 2025 as "world-first multimodal tracker". Image recognition + NLP. **Quality complaints** dominate 2025 App Store reviews (misID, double barcodes, forced logouts). | Confirmed |
| **Meal plans** | Curated multi-week eating plans | keto, high-protein, 5:2, 16:8 fasting, Mediterranean, "clean eating", paleo; auto-generated **grocery lists**. Premium-gated. Curated content, not a solver. | Confirmed |
| **Diary / macros** | Calorie + macro tracking | Core loop. Custom macro targets are **premium-gated**. | Confirmed |
| **Trackers** | Water, fruit/veg, fasting windows | Lightweight habit trackers feeding Life Score. | Confirmed |
| **Recipes** | In-app recipe browse | `shapeupclub://…recipe_browse` deep link confirms a recipe-browse surface. **Import-from-URL/Reel: no evidence Lifesum has this.** | Confirmed (browse) / Confirmed-absent (import) |

**Scale claim:** "Trusted by 60+ million users" (homepage, self-reported).

---

## 5. Monetisation (confirmed)

- **Web payments via Adyen**; mobile via App Store / Play IAP. SKUs region-aware (`v2/country` →
  `v2/pricing/products/web`), local currency + tax + promo applied server-side.
- **Pricing (2026, region-varying):** ~**$12.99/mo**, ~**$24.99/quarter**, ~**$44.99/yr**
  (≈ $3.75/mo annual). Some surfaces quote $7.49–$14.99/mo.
- **No standard free trial on the core app.** Free tier is usable indefinitely but **paywalls
  barcode scanning, custom macros, meal plans, and full food-DB search**. Trials exist only via
  **partner deals** (e.g. Oscar Health = 3 months free; Nike, Samsung, Gympass co-brands).
- **Affiliate revenue** via Awin/Adrecord on top of subscriptions.
- **GLP-1 content play:** dedicated `Glp1` article hub (Ozempic/Wegovy-era SEO/positioning) — content,
  not a feature. Worth noting as a market-tailwind they're chasing.

---

## 6. What Sloe should BORROW vs BEAT

### Borrow (concept, never code — read-only teardown)

1. **Life Score as a "health, not just calories" narrative.** This is Lifesum's single best idea and
   directly reinforces Sloe positioning ("love food AND have goals" — permission, not restriction).
   Sloe's Progress surface already leans "story not dashboard" (`project_progress_direction.md`); a
   **single legible weekly health number** beats a wall of macro tiles for the daily-use emotional
   beat. **Borrow the concept; beat the execution** — Lifesum's own seam (Life Score *disappears* on
   meal plans / AI logging) is a credibility hole Sloe should not reproduce: make the score
   *always-on* and reconcile it with whatever logging mode is active.
2. **The warm-coaching skin — validated in market at 60M users.** The cream canvas + soft-green
   accent + lifestyle food photography + calm editorial copy is exactly
   `project_lifesum_aesthetic_direction.md`. Lifesum proves it *converts at scale*. Borrow the
   register; keep Sloe's existing differentiators that already exceed it (multi-ring calorie+macros,
   "what to eat next" fit chip) per the conformity-trap rule — don't flatten Sloe into a Lifesum clone.
3. **Copy that gives permission, not guilt.** "Lose weight and keep it off **while enjoying the foods
   you love**" is almost verbatim Sloe's thesis. Route the exact taglines to brand-manager; Lifesum
   confirms the angle resonates.
4. **In-house multi-destination analytics adapter pattern** (`useTracking()` → swappable adapters +
   named semantic events like `trackAccountFlowDropOff`). Clean, testable, vendor-swappable. Sloe's
   `isFeatureEnabled`/PostHog layer is already adapter-ish; the **named-funnel-drop-off events** are
   worth stealing as a *pattern* for the onboarding/upgrade funnels.
5. **Meal-plans-as-premium-hook with auto grocery lists.** Sloe already has a Plan tab + shopping
   list; Lifesum validates that *curated* plans (keto/high-protein/fasting) + one-tap grocery list is
   a willingness-to-pay driver. Sloe's edge: tie plans to the user's *own imported recipes*, which
   Lifesum can't (no import).

### Beat (where Lifesum is structurally weak — Sloe's openings)

1. **No recipe-import / no social viral loop.** Lifesum has in-app recipe *browse* but **zero
   import-from-URL/Reel and no attributed-creator spread.** This is Sloe's entire uncopyable wedge
   (`project_competitor_set_and_mfp_exodus.md`, `project_julienne_competitive_pattern.md`). Lifesum
   grew to 60M on paid/affiliate/partner marketing, not a product loop — Sloe's loop is the thing
   they can't bolt on.
2. **Aggregated food DB + buggy 2025 AI.** Lifesum doesn't own its nutrition data and its multimodal
   AI is shipping accuracy regressions (cashews→shrimp, phantom coffee, double barcodes). Sloe's
   CLAUDE.md nutrition rigour — **count-to-weight normalisation, multiple candidate matches, plausibility
   validation, reject-low-confidence** — is a *direct* quality answer to exactly the complaints in
   Lifesum's current reviews. This is a marketing wedge, not just an internal value.
3. **Punitive free tier, no trial — an MFP-refugee irritant.** Lifesum paywalls **barcode + macros +
   full search** and offers **no real free trial**. MFP refugees (our priority cohort) are fleeing a
   *different* paywall-rug-pull; landing them on another hard wall is an acquisition gift to Sloe.
   Sloe should let the **core tracking + barcode + basic macros stay free**, paywall the *delight*
   (plans, AI, household), and **offer a real trial** — the opposite posture.
4. **Web product gap.** Lifesum has *no* food-logging web app at all — purely a mobile funnel. Sloe
   already ships a web tracker surface (parity rule). For the MFP-refugee who tracked on desktop,
   "works on web too" is a concrete switching reason Lifesum can't match.

---

## 7. Confidence & caveats

- **Web bundle = client-only, marketing-scope.** Everything in §2–§3.1 is **confirmed from primary
  source** but reflects only the marketing/billing app. The food-logging product, food-matching
  logic, and server compute are **not** in the bundle.
- **Server stack (§2 tail)** is third-party-reported (StackShare + a job post), not source-verified —
  credible (two independent sources, consistent with observed architecture) but treat as inferred.
- **Multimodal AI model vendor is undisclosed.** No public source names the vision/NLP provider.
- **Pricing varies by region and over time;** figures are 2026 third-party snapshots, directionally
  right, not a live quote.
- **This is a read-only teardown** — no Lifesum code was copied; findings characterise *approach and
  vendors* only, per the brief.

## Sources

- Lifesum web bundle (primary): `lifesum.com` root + `/main-ad11d053.js`,
  `/Home-749a9d8d.js`, `/src_js_components_Login_Login_tsx-…`, `/vendors-…reduxjs_toolkit…js`
  (fetched to `/tmp/ls_*.js`, 2026-06-08).
- [Lifesum — Features](https://lifesum.com/features/) · [Premium](https://lifesum.com/premium)
- [Lifesum Help Center — Life Score & Meal Ratings](https://lifesum.helpshift.com/hc/en/3-lifesum/section/9-life-score-meal-ratings/)
- [Lifesum Help Center — Lifesum's food database](https://lifesum.helpshift.com/hc/en/3-lifesum/faq/48-lifesum-s-food-database/)
- [Lifesum — AI-Powered Multimodal Tracker (PR, Feb 2025)](https://www.prnewswire.com/news-releases/lifesum-transforms-meal-tracking-with-ai-powered-multimodal-tracker-for-personalized-nutrition-302367832.html)
- [Braze — Lifesum customer case study](https://www.braze.com/customers/lifesum-case-study)
- [Lifesum — Senior Backend Engineer (jobs)](https://jobs.lifesum.com/jobs/7599046-senior-backend-engineer) · [StackShare — Lifesum](https://stackshare.io/lifesum/lifesum) (HTTP 403 on direct fetch; facts via search snippet)
- [App Store — Lifesum](https://apps.apple.com/us/app/lifesum-ai-calorie-counter/id286906691) · [Google Play — com.sillens.shapeupclub](https://play.google.com/store/apps/details?id=com.sillens.shapeupclub)
- [NutriScan — Lifesum pricing 2026](https://nutriscan.app/blog/posts/lifesum-pricing-2026-premium-monthly-yearly-dfa27db3b2) · [Nutrola — Lifesum free vs premium](https://nutrola.app/en/blog/lifesum-free-vs-premium-what-do-you-actually-get)
