# MyFitnessPal — what they do, how, vendors, and what Sloe should borrow vs beat

> **Date:** 2026-06-08 · **Area:** Competitive / teardown · **Status:** Research (informs
> MFP-refugee capture, nutrition-accuracy positioning, monetisation/paywall posture)
> **Owner:** product-lead (competitive) + monetisation + brand-manager (funnel copy)
> **Method:** primary-source mining of MFP's **shipped web bundle** — a **Next.js (Pages Router)**
> app on `www.myfitnesspal.com`, assets served from `web-assets.myfitnesspal.com/web-main/_next/…`.
> Fetched to `/tmp/mfp-teardown`: 4 entry HTML pages (`/`, `/food/diary`, `/account/login`, `/dashboard`),
> the `_buildManifest.js` (full 130-route map), and ~30 JS chunks incl. the **4.5 MB `pages/_app`
> monolith** (the BFF API client + entitlements + auth live here) and the diary/premium/onboarding
> page chunks. Plus the **inlined `__NEXT_DATA__` runtime config** in `/food/diary` HTML (the full
> vendor wiring with live public keys). Plus WebSearch/WebFetch for the server-side food-DB,
> Meal-Scan vendor, user sentiment, and the 2024 data-corruption incident.
> **Caveat:** the bundle is client logic only. MFP's signature asset — the **hundreds-of-millions-of-
> items food database + matching/search** — is **server-side** behind `api.myfitnesspal.com/v2`. We
> captured the *API surface* that fronts it and the *premium gating*; the DB internals and the search
> ranking algorithm can only be seen authed/live (flagged below).
> **Relevant to:** `project_competitor_set_and_mfp_exodus.md` (MFP is the incumbent the whole exodus
> is leaving) · `project_suppr_positioning.md` ("love food AND have goals") · the CLAUDE.md
> nutrition-accuracy rules (validated matching / reject-low-confidence — which is *literally* MFP's
> most-complained-about weakness) · sister teardowns `2026-06-08-yazio-teardown.md`,
> `2026-06-08-lifesum-teardown.md` (same technique).

---

## TL;DR

**Feasibility — very high signal.** Unlike Lifesum (marketing site only) and Yazio (funnel only),
MFP ships its **actual logged-in product as a public Next.js web app**. The diary, food logging,
onboarding (`/account/create/*`), premium checkout, and reports are all real, inspectable web
surfaces. The `_app` chunk handed us a **complete 126-route backend-for-frontend (BFF) map** with
HTTP verbs, the **full 21-entitlement premium matrix**, the auth model, and — via the inlined config
— **every vendor with live public keys**. The one thing we *can't* see is the food-DB + search ranking
(server-side), but we recovered the exact API path that fronts it.

**What MFP does well, one line each:**
- **The food database is the moat — scale, not quality.** Hundreds of millions of items, built over
  15+ years of crowdsourcing. *Confirmed strength:* nothing else has this barcode coverage. *Confirmed
  weakness (heavily documented):* it's riddled with duplicate + wrong entries, barcode re-scans
  return different data, and in **March 2024 a 3-day "data corruption" event** silently inserted/
  altered diary entries with no public root-cause. **This is Sloe's single biggest opening.**
- **Barcode scanner** — the most comprehensive on the market by DB size. **Premium-gated since Oct 2022**
  (entitlement `premium-barcode-scanner`) — a deeply unpopular move that fuels the exodus.
- **AI Meal Scan + Voice Log** — camera/voice → ML recognises foods → **matches to the DB** → review &
  log. Meal Scan is **powered by Passio AI** (confirmed partnership). Both Premium
  (`premium-meal-scan`, `premium-visual-food-search`). Voice Log launched late-2024.
- **Deep diary data model** — full macro + micro set (sat/poly/mono/trans fat, cholesterol, sodium,
  potassium, fibre, sugar, + vit A/C/calcium/iron), per-meal sections, water, notes, quick-add,
  copy-meal, custom nutrient goals, net-carbs mode (`premium-net-carbs-mode`).
- **Mature monetisation + ecosystem** — Stripe live checkout with a custom payment method (Apple/
  Google Pay), TrueMed (HSA/FSA), partner/coupon redemption flows, Gympass/Wellhub & Calm/Factor
  partnerships, a printable-diary/CSV export surface, and a friends/messages/forum social layer.

**Vendor headline (confirmed from bundle + inlined config):**
**Next.js (Pages Router)** front end on **CloudFront** CDN (`web-assets.myfitnesspal.com`) ·
**axios**-based BFF → canonical API at **`api.myfitnesspal.com/v2`** · **NextAuth** (Credentials +
**Facebook + Google + Apple**) · **Stripe** (`pk_live_…`, API `2024-12-18.acacia`) + **TrueMed**
(HSA/FSA) · **Amplitude** (analytics **+ Experiment** feature-flags, key `2746a27a…`) ·
**Datadog RUM** (3 client tokens, `DD_ENV=nutrition-prod`, `DD_SERVICE=web-main`) ·
**AppsFlyer** (mobile attribution) · **Google Tag Manager** (`GTM-NR6RNVL`) + **Google Ad Manager**
(ad unit `/17729925/UACF_W/MFP/` — the in-app ads people hate) · **Sourcepoint** CMP
(`cdn.privacy-mgmt.com`, consent matrix per ISO code) · **reCAPTCHA v3** · **Passio AI** (Meal Scan,
server/SDK-side). Backend (per MFP job posts): **Java**-primary + Scala/Ruby/Go/Node/Python;
**MySQL + MongoDB + DynamoDB + Redis**; **REST + GraphQL** (GraphQL confirmed live — Datadog RUM
instruments GraphQL operations in the bundle).

**The strategic read.** MFP is the **incumbent the exodus is leaving**, not a design north-star. Its
product is *wide and battle-tested* but *aesthetically dated, ad-choked, and — critically —
data-quality-poor*. The lesson isn't "copy MFP"; it's **"be the trustworthy, calm, accuracy-first MFP
without the ads and without the paywalled barcode."** Borrow the **breadth of the data model** and the
**BFF/entitlements architecture pattern**; beat them on **food-data correctness** (our validated-matching
/ reject-low-confidence rules are a direct answer to their #1 complaint), **no ads**, **barcode + import
not paywalled**, and the **"foods you love, fit to your goals"** positioning their restriction-framed
tracker can't touch.

---

## 1. How it's built (confirmed from bundle)

### 1.1 Framework + delivery
- **Next.js Pages Router.** Evidence: `window.__NEXT_P.push(["/food/diary", …])`, `__N_SSP` server-
  side-props flag, `chunks/pages/**` layout, `_buildManifest.js` / `_ssgManifest.js`. Build id
  `-T7A5yGXEWVbVA1ss0A8K`, release `v21.8.22` (`DD_VERSION:"21.8.22_20ee27cd6c0b"`).
- **CDN:** static assets on **CloudFront** — `web-assets.myfitnesspal.com/web-main/` (`ASSET_PREFIX`).
  Photos on `photos-cloudfront.myfitnesspal.com` (218 refs). A second CloudFront distro
  `dzisfcik2b0ff.cloudfront.net` (28 refs).
- **Source maps are 403** (not public) — good security posture; we worked from minified code.
- **UI kit:** **MUI** (`mui.com` refs, `reduceDescriptors` etc.), **react-query** (queryKeys:
  `["user"]`, `["subscription",…]`, `["idm-user-with-consents"]`, `["notifications"]`),
  **react-intl/FormatJS** (`formatjs.github.io`; the bundle embeds a large i18n + Faker-style
  dictionary).

### 1.2 The architecture pattern (worth internalising)
A clean **three-tier BFF**:

```
React client  →  Next.js API routes  /api/services/*   →  axios  →  https://api.myfitnesspal.com/v2
   (react-query)     (the "BFF", same-origin, cookie/session auth)        header: mfp-client-id: <MFP_API_CLIENT_ID>
```

- Confirmed string in `_app`: `` `${…API_HOST}/v2`, headers:{common:{"mfp-client-id":o.env.MFP_API_CLIENT_ID}} ``
  and `MFP_PUBLIC_API_HOST:"https://api.myfitnesspal.com"`.
- A **second axios base** points at `PRODUCT_CATALOG` (the pricing/plan catalogue — `/api/product-catalog`).
- The client **never** talks to `api.myfitnesspal.com` directly; everything is proxied through
  same-origin `/api/services/*` so the browser only holds a session cookie, not the upstream OAuth
  token. **This is a pattern Sloe already approximates** (Supabase + Next route handlers) — MFP
  validates that a same-origin BFF in front of a separate API platform is the right shape at scale.

### 1.3 Auth
- **NextAuth** (`NEXTAUTH_URL:"https://www.myfitnesspal.com"`, routes `/api/auth/session`,
  `/api/auth/callback/credentials`, `/api/auth/signout`, refresh-token rotation
  `/api/auth/refresh-token-data`). Session re-fetch every 120s + on window focus.
- Providers: **`credentials` + `facebook` + `google` + `apple`** (all four present).
- Separate **IDM identity service** (`/api/idm/user-exists`, `/api/idm/consents`,
  `/api/idm/user-with-consents`) — a dedicated identity/consent microservice distinct from the diary API.
- **reCAPTCHA v3** on auth (`RECAPTCHA_SITE_KEY_V3`, `CAPTCHA_ENABLED:"true"`).

---

## 2. The backend surface — the complete BFF map (confirmed)

The `_app` bundle registers **126 BFF routes** via a `this.<verb>("/path", handler)` router. This is
the definitive client-reachable API. Grouped highlights (verb + path):

**Diary / logging (the core loop):**
- `POST /api/services/diary` · `DELETE /api/services/diary/:id` · `GET /api/services/diary/:food_entry_id`
- `POST /api/services/diary/day` · `GET /api/services/diary/read_day` · `GET …/read_diary`
- `GET …/diary/nutrient_goals` · `POST …/diary/report` · `GET …/diary/profile`
- `POST …/diary/copy_meal` · water (`…/water`, `…/read_water`) · notes (`…/notes/food`, `…/read_notes`)
- Diary-sharing auth: `POST …/authenticate_diary_key`, `POST …/diary/authenticate`

**Foods (custom foods + frequently-used — note what's *missing*):**
- `GET /api/services/users/foods/mine` · `POST /api/services/foods` · `GET /api/services/foods/:foodId`
- `PATCH /api/services/foods/:foodId` · `DELETE /api/services/foods/:id` · `GET /api/services/top_foods`
- **There is NO `/foods/search` in the client BFF map.** Food *search* (the famous typeahead against the
  giant DB) is **resolved server-side** inside a BFF route (or hits `api.myfitnesspal.com/v2` directly
  from the server) and is **not exposed in the client bundle**. *Flagged: search ranking is the one
  piece visible only authed/live.* The diary page chunk calls only `/api/services/diary/*`; the search
  box round-trips to the server.

**Meals & recipes:**
- `GET /api/services/users/meals/mine` · `DELETE …/meals/delete/:id`
- `GET /api/mealapp/v2/mealapp/plan/share/:id` · `…/grocery/shareList/:id` (grocery lists)
- `POST /api/mealapp/v2/mealapp/recipe/print`, `…/meal/print/:id` (printable recipes)

**Exercise:** `GET /api/services/exercises/search`, `…/lookup`, `…/lookup_private`,
`…/list_by_name`, `…/calories_burned/:id`, CRUD on `/exercises/:id`. *(Note: exercise search **is**
client-exposed; food search is not — telling about where the crown-jewel logic lives.)*

**Goals / measurements:** `/api/services/nutrient-goals`, `/api/services/diary/nutrient_goals`,
`/api/user-measurements/measurements(/types)`, `/api/services/incubator/measurements/upsert`,
`/api/services/steps/:since_date`.

**Monetisation (Stripe + entitlements):**
- `GET/POST/DELETE /api/services/stripe/customers` · `POST …/stripe/setup-intents` ·
  `GET …/stripe/setup-intents/:id` · `POST/GET/PATCH …/stripe/subscriptions(/:id)` ·
  `GET …/stripe/prices` · `POST …/stripe/portal-session` (Stripe Billing Portal)
- **TrueMed (HSA/FSA):** `POST /api/stripe/truemed/payment-session`, `GET …/stripe/truemed/payment-token`
- `GET …/paid-subscriptions(/active)` · `…/user-subscriptions` · coupons `POST/PATCH …/user-coupons(/:id)`
- `/api/product-catalog` (the plan/price catalogue, separate service)

**Account / social / data rights:** account create/delete/settings, diary & email settings,
`POST /api/services/data-exports` (GDPR/CCPA export), friends, messages, blocked-users, invitations,
`/api/services/live-digest` (the weekly-digest surface), `/api/public/profile/:username`.

**Partner integrations:** `/api/services/account/link-to-gympass`, `/api/services/partners/apps`,
`/api/services/apps/lookup`, FB connect/disconnect, plus partner landing routes
`/partner/{1yearfreefromcalm, 6monthtrial, factorfreeyear, trainerize, truemed}`.

> **Routes only visible live/authed (flagged):** food **search ranking/typeahead**, Meal-Scan upload
> endpoint (Passio), the GraphQL endpoint + operation names (Datadog confirms GraphQL *is* used, but
> the ops resolve server-side), and any recommendation/insights service behind the Nutrition Dashboard.

---

## 3. The food database + matching (server-side — confirmed by research, not bundle)

This is MFP's signature asset and our key battleground. Since it's server-side, this section is
**inferred from public sources + the API surface**, marked as such.

- **Scale:** "one of the largest food databases on the planet — hundreds of millions of items," built
  by **crowdsourcing** (users add foods) layered on MFP-curated + retail/branded data. *(inferred,
  well-corroborated)*
- **Verified entries:** MFP surfaces a "verified"/green-tick concept for curated items, but the long
  tail is user-submitted and **unmoderated at scale**. *(inferred)*
- **Barcode → branded product lookup** by UPC against the same DB; coverage is the best-in-class
  selling point. Gated to Premium since Oct 2022. *(confirmed: `premium-barcode-scanner` entitlement +
  `barcode_scanner_only` gate string + public help docs)*
- **Meal Scan = Passio AI** computer-vision food recognition → maps detected foods back to DB entries
  for logging; "food amount estimation without a scale" in development. *(confirmed: Passio partnership
  page + `premium-meal-scan` / `premium-visual-food-search` entitlements)*
- **Data model (confirmed from chunks):** `calories, carbohydrates, protein, fat, saturated_fat,
  polyunsaturated_fat, monounsaturated_fat, trans_fat, cholesterol, sodium, potassium, fiber, sugar`
  + micros `vitamin_a, vitamin_c, calcium, iron`; servings via `serving_size`/`num_servings`; meal
  sections `Breakfast/Lunch/Dinner/Snacks`.

### The documented weakness (Sloe's opening — confirmed, multi-source)
- **Duplicate + wrong entries everywhere.** Same item appears many times with different numbers; MFP's
  own help docs admit entries "may be inaccurate or incomplete… submitted by other members."
- **Barcode returns inconsistent data** — re-scanning the same barcode can surface different (wrong)
  nutrition, a top frustration for people trying to hit macros.
- **March 2024 "data corruption" incident** — over a 3-day window, diary entries were silently
  altered/inserted (a user found a logged item they never added); MFP gave **no root cause, no
  prevention statement, no automated fix** (users had to hand-correct days-old logs). A security
  professional publicly flagged the opacity.
- **Ads:** in-app full-screen/aggressive ads on the free tier (the `/17729925/UACF_W/MFP/` Google Ad
  Manager unit) are a recurring Trustpilot/Reddit complaint — "watch a full-screen unskippable ad to
  log a meal."

> **Direct line to Sloe's rules:** CLAUDE.md already mandates *parse → detect count/weight → infer
> edible weight → multiple candidates → validate plausibility → reject low-confidence → only ask when
> accuracy materially affected.* That is, almost word-for-word, **the fix to MFP's most-hated flaw.**
> We should *market accuracy as a feature* (e.g. a visible confidence signal + "no duplicate junk
> entries"), because the incumbent's scale advantage is also its trust liability.

---

## 4. Premium — the full entitlement matrix (confirmed from `_app`)

MFP gates **21 entitlements**. The complete list (verbatim keys):

| Entitlement key | What it gates |
|---|---|
| `premium-ad-free` | Remove the in-app ads |
| `premium-barcode-scanner` | **Barcode scanning** (paywalled Oct 2022) |
| `premium-meal-scan` | **AI Meal Scan** (Passio camera logging) |
| `premium-visual-food-search` | Visual/photo food search |
| `premium-track-macros` | Macro targets in grams/% |
| `premium-custom-daily-goals` | Custom calorie/macro goals |
| `premium-custom-meal-goals` | Per-meal macro goals |
| `premium-net-carbs-mode` | Net-carbs (keto) mode |
| `premium-nutrient-dashboard` | Nutrition insights dashboard |
| `premium-food-entry-timestamps` | Timestamps on entries |
| `premium-quick-add` | Quick-add calories/macros |
| `premium-food-list` | Saved food lists |
| `premium-intermittent-fasting` | Fasting tracker |
| `premium-file-export` | CSV/file export |
| `premium-weekly-digest` | Weekly digest report |
| `premium-grocery-integration` | Grocery list integration |
| `premium-meal-plans` / `premium-mfp-plans` | Meal plans |
| `premium-workout-routines` | Workout routines |
| `premium-assign-exercise` | Assign exercises |
| `premium-priority-support` | Priority customer support |

- **Pricing:** ~**$79.99/yr** Premium (per Voice Log press); web checkout offers `monthly` + `annual`
  with `trial_eligible`/`trial` logic. *(annual confirmed in bundle; exact $ from press release)*
- **Payments:** **Stripe** Elements (`@stripe/react-stripe-js` + `@stripe/stripe-js`), `pk_live_feE27wU6…`,
  API version `2024-12-18.acacia`, a **custom payment method** `cpmt_1SD8qN…` (Apple/Google Pay), Stripe
  **Billing Portal** for self-serve management, **setup-intents** for card-on-file. **TrueMed** adds
  **HSA/FSA** eligibility — a clever US-market wedge (pay for a health app with pre-tax dollars).
- **Onboarding funnel** (`/account/create/*`, ~20 screens): welcome → demographics → activity-level →
  goal (with per-goal `affirmation` + `options` screens) → weekly-goal → nutrition-goal → username →
  consents → start-logging. A structured, goal-branched quiz — *similar shape to Yazio's funnel but
  less psychologically aggressive.*

---

## 5. Vendor stack (confirmed from inlined `__NEXT_DATA__` config + bundle)

Recovered verbatim from `/food/diary` SSR config (live public keys):

| Category | Vendor | Evidence |
|---|---|---|
| Front-end framework | **Next.js (Pages Router)** | bundle structure, build manifest |
| CDN / hosting | **AWS CloudFront** | `web-assets…`, `photos-cloudfront…`, `*.cloudfront.net` |
| Core API | **`api.myfitnesspal.com/v2`** (axios BFF proxy) | `MFP_PUBLIC_API_HOST`, `${API_HOST}/v2` |
| Auth | **NextAuth** + **Apple/Google/Facebook/Credentials**; separate **IDM** service | `/api/auth/*`, `/api/idm/*` |
| Payments | **Stripe** (`pk_live_…`, `2024-12-18.acacia`, custom PM, Billing Portal) | `STRIPE_*` config + `@stripe/*` |
| HSA/FSA | **TrueMed** | `/api/*/truemed/*` routes |
| Product analytics + experiments | **Amplitude** + **Amplitude Experiment** (flags) | `AMPLITUDE_API_KEY:"2746a27a…"`, `add-feature-flag-evaluation`, `api2/api.eu.amplitude.com` |
| RUM / observability | **Datadog RUM** (3 client tokens, GraphQL-aware) | `DATADOGRUM_*`, `DD_ENV:nutrition-prod`, `DD_SERVICE:web-main` |
| Mobile attribution | **AppsFlyer** | `APPSFLYER_ENABLED:"true"` |
| Tag management | **Google Tag Manager** | `GTM-NR6RNVL` |
| Advertising | **Google Ad Manager / DoubleClick** | ad unit `/17729925/UACF_W/MFP/`, `securepubads.g.doubleclick.net` |
| Consent / CMP | **Sourcepoint** | `cdn.privacy-mgmt.com`, `SOURCEPOINT_PROPERTY_HREF`, per-ISO consent matrix |
| Bot protection | **Google reCAPTCHA v3** | `RECAPTCHA_SITE_KEY_V3` |
| AI food recognition | **Passio AI** (Meal Scan, server/SDK) | partnership page (research) |
| Community / forum | self-hosted (Vanilla-style) | `community.myfitnesspal.com`, `COMMUNITY_CLIENT_ID` |
| Backend langs/stores | **Java**-primary + Scala/Ruby/Go/Node/Python; **MySQL/MongoDB/DynamoDB/Redis**; **REST + GraphQL** | MFP job posts (research) + Datadog GraphQL instrumentation in bundle |

Notable: MFP runs **two analytics planes** — **Amplitude** for product analytics *and feature-flag/
experiment delivery* (their roadmap/experimentation engine), and **Datadog RUM** for performance/error
observability. Sloe uses **PostHog** for both analytics + flags + session replay — a tighter, single-
vendor stack than MFP's Amplitude-Experiment + Datadog split (a point in our favour: fewer vendors,
one source of truth).

---

## 6. What Sloe should BORROW vs BEAT

### Borrow (selectively — `feedback_prototype_mix_and_match` applies)
1. **The BFF + entitlements pattern.** Same-origin `/api/services/*` proxy in front of a separate API
   platform, with a single declarative entitlement map (21 keys) checked client-side and enforced
   server-side. Sloe's `isFeatureEnabled` + Supabase RLS already rhyme with this; MFP validates the
   shape at 200M-user scale.
2. **Breadth of the diary data model.** Full micro set (sat/poly/mono/trans, potassium, the 4 surfaced
   micros), per-meal macro goals, net-carbs mode, quick-add, copy-meal, water + notes. Good checklist
   for "is our tracker spine complete?" — but present them *calmly*, not as a wall of paywalled toggles.
3. **HSA/FSA payment (TrueMed) for the US.** A genuinely smart monetisation wedge — let US users pay
   for a health app with pre-tax dollars. Worth a line in the monetisation backlog (route to
   monetisation specialist; gate behind region per `project_region_aware_pricing`).
4. **Stripe Billing Portal + setup-intents** for self-serve subscription management (MFP's
   `portal-session`) — reduces support load; we should make cancel/manage frictionless (the *opposite*
   of MFP's "hard to unsubscribe" complaint = a trust differentiator).
5. **Goal-branched onboarding with per-goal affirmation screens** (`/account/create/goals/[goal]/affirmation`)
   — lighter than Yazio's but a useful pattern; aligns with our warm-coaching direction
   (`project_lifesum_aesthetic_direction`).

### Beat (where MFP is structurally weak — these are the wedges)
1. **Food-data correctness > food-data scale.** MFP's #1 documented flaw. Our validated-matching /
   reject-low-confidence / count-to-weight rules are the antidote. **Market it:** a visible match-
   confidence signal, "no duplicate junk," and *never silently log wrong data* (the 2024 incident is a
   cautionary tale we can implicitly contrast against). This is the single highest-leverage difference.
2. **No ads, ever.** MFP free-tier ads are a top exodus driver. Sloe's calm, ad-free surface is an
   instant felt upgrade — say so on the landing/pricing page.
3. **Don't paywall the table stakes.** Barcode-behind-Premium (Oct 2022) is the most-resented MFP move.
   If Sloe ships barcode/import, keeping the *capture* path generous (paywall depth/insights, not the
   ability to log) directly converts MFP refugees.
4. **The recipe-import / "foods you love → fit your goals" loop.** MFP is a restriction-framed tracker
   with a forum bolted on; it has **no viral recipe-import loop** and no "permission to eat the foods
   you love" positioning (`project_suppr_positioning`). That's our uncopyable wedge — the same one we
   identified vs Julienne and Yazio.
5. **One calm analytics/flags stack (PostHog) + session replay** vs MFP's Amplitude+Datadog split —
   internal velocity advantage, and replay-driven UX fixes the incumbent can't match at their size.
6. **Trustworthy data-rights UX.** MFP *has* `data-exports`, but the brand is dogged by opacity (2024
   incident, "can't unsubscribe"). Sloe being visibly straight about data export + cancellation is a
   cheap trust win against a giant with a credibility deficit.

### Defended choices (don't chase)
- **Don't try to out-scale the food DB head-on.** Hundreds of millions of crowdsourced items is a
  15-year moat we can't replicate and *shouldn't* — their scale is also their quality problem. Compete
  on **correctness + the foods our users actually cook/import**, not raw row count.
- **Don't build a forum.** MFP's community is legacy surface area; our viral loop is import + social
  sharing of *recipes*, not message boards.
- **Don't copy the aggressive funnel psychology** wholesale (Yazio note applies) — warm-coaching, not
  Noom-style pressure.

---

## 7. Confidence & limits

- **High confidence (confirmed from bundle/config):** framework, CDN, BFF route map (126 routes),
  auth providers, the 21 premium entitlements, the full vendor list with live public keys, the diary
  data model, Stripe + TrueMed wiring.
- **Medium confidence (research-corroborated, not in bundle):** food-DB scale/crowdsourcing, barcode
  paywall date, Passio AI as Meal-Scan vendor, $79.99 price, backend langs/stores, GraphQL usage
  (bundle shows Datadog *instrumenting* GraphQL → it's used, but ops are server-side).
- **Could only be seen authed/live (flagged, not captured):** the food **search ranking/typeahead**
  algorithm, the Meal-Scan upload endpoint, GraphQL operation names + schema, and any
  recommendation/insights service behind the Nutrition Dashboard. A logged-in pass (real account +
  network capture) would surface these — worth a follow-up if we want the exact search-ranking shape.

## Sources
- MFP web bundle (primary): `www.myfitnesspal.com` HTML + `web-assets.myfitnesspal.com/web-main/_next/static/chunks/*` (esp. `pages/_app`), `_buildManifest.js`, inlined `__NEXT_DATA__` config — fetched to `/tmp/mfp-teardown`, 2026-06-08.
- [How MFP's food database works (MFP blog)](https://blog.myfitnesspal.com/how-food-database-works/) · [MFP: editing inaccurate DB entries (help)](https://support.myfitnesspal.com/hc/en-us/articles/360032622691-Some-food-information-in-the-database-is-inaccurate-Can-I-edit-it)
- [Why are MFP food entries so inaccurate? (community)](https://community.myfitnesspal.com/en/discussion/10804613/why-are-mfp-food-entries-so-wildly-inaccurate) · [So many items with incorrect values (community)](https://community.myfitnesspal.com/en/discussion/10862172/there-is-so-much-items-in-the-database-with-incorrect-nutritional-values)
- [MFP 2024 data-corruption incident (kamens.us)](https://blog.kamens.us/2024/03/27/myfitnesspal-is-not-telling-the-whole-truth-about-recent-data-corruption-incident/)
- [Barcode scanner how-to (MFP help)](https://support.myfitnesspal.com/hc/en-us/articles/360032624771-How-do-I-use-the-barcode-scanner-to-log-foods) · [Meal Scan FAQ (MFP help)](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ) · [Meal Scan = Passio AI](https://www.passio.ai/blog/essential-guide-to-myfitnesspal-meal-scan)
- [Voice Log launch (PR Newswire)](https://www.prnewswire.com/news-releases/say-it-log-it-myfitnesspal-unveils-voice-log-302329040.html) · [MFP 2025 Winter Release](https://blog.myfitnesspal.com/winter-release/)
- [MFP Backend Engineer job (stack)](https://boards.greenhouse.io/myfitnesspal/jobs/6471270) · [MFP API portal](https://www.myfitnesspal.com/api)
- [MFP review 2025 (Wondershare)](https://www.wondershare.com/calorie-tracker/myfitnesspal-alternative.html) · [Why MFP Sucks (FeastGood)](https://feastgood.com/myfitnesspal-sucks/) · [MFP Trustpilot](https://www.trustpilot.com/review/www.myfitnesspal.com)
