# Julienne's strengths — what they do better, how (pipeline + vendors), and what Sloe should borrow vs already beats

> **Date:** 2026-06-08 · **Area:** Competitive / import pipeline · **Status:** Research (read-only;
> no code copied — approach learned, not lifted)
> **Owner:** product-lead (import roadmap) + brand-manager (positioning)
> **Source material:** Julienne's public shipped web bundle
> `https://withjulienne.com/assets/index-f24fde0f.js` (3.58 MB, fetched + grepped first-hand on
> 2026-06-08) + App Store / ProductHunt / press for user sentiment.
> **Builds on (does not repeat):**
> [`2026-06-07-julienne-image-system.md`](./2026-06-07-julienne-image-system.md) (Gemini 3 Pro Image,
> on-demand + cache — a strength) ·
> [`2026-06-08-julienne-nutrition-method.md`](./2026-06-08-julienne-nutrition-method.md) (crude
> hardcoded macro table — a **weakness**, Sloe's moat) ·
> [`2026-06-03-recipe-import-competitive-posture.md`](./2026-06-03-recipe-import-competitive-posture.md)
> (the legal/posture angle). This doc is the **pipeline + UX + vendor** deep-dive.
> **Sloe baseline for comparison:** `src/lib/recipe-import/extractSocialRecipe.ts`,
> `socialUrlHelpers.ts`, `parseRecipeFromHtml.ts`, `ssrfGuard.ts`,
> `src/lib/analytics/recipeImportPipelineTrace.ts`.

## Evidence-confidence legend

- **[BUNDLE]** — confirmed verbatim from the shipped client JS (primary, first-hand).
- **[SERVER]** — referenced by the client but the logic lives in a Cloud Function / proxy whose body is
  **not** in the bundle (invisible — flagged as such).
- **[WEB]** — from App Store / press / ProductHunt (third-party).
- **[INFERRED]** — reasoned from the above, not directly stated.

---

## TL;DR

Julienne's real moat is **not** its nutrition (crude) or even its images (good but copyable) — it's a
**genuinely well-engineered multi-modal import pipeline wrapped in a calm, granular, forgiving UX.**
Specifically, four things they do better than Sloe today:

1. **A two-stage import architecture** that cleanly separates *acquisition* (platform-specific
   scrape/transcript) from *extraction* (one unified server LLM step), with **per-platform fetchers,
   transcript-retry loops, a primary→fallback scraper chain, and explicit "is there enough here?"
   quality gates** before spending an LLM call. **[BUNDLE]**
2. **A bulk-import queue with live, slot-based concurrency** ("In queue (#3) — starts when a slot
   opens"), a persistent drawer with **per-recipe cancel/retry**, and a **6-stage human-readable
   progress state machine** (`confirming → extracting → organizing → generating → translating`).
   **[BUNDLE]**
3. **A step-centric recipe data model** where ingredients live *inside* each step with their own
   `{name, quantity, unit}` — enabling inline amount-chips during cooking — plus a derived "base
   ingredients" list (flatten → dedup → drop processed), an **allergen→substitution engine**, a
   **pantry-aware "missing ingredients" shopping flow**, and AI **per-recipe tips**. **[BUNDLE]**
4. **Deep video coverage**: YouTube/TikTok via **Supadata** (transcript + scrape), Instagram via a
   **dedicated Heroku proxy**, and an **on-device video→audio→Whisper** path for uploaded video files.
   **[BUNDLE] + [SERVER]**

Where Sloe already **beats** them: nutrition accuracy (the whole point of Sloe), the goals/health
retention layer (Julienne has none), honest AI-image provenance, SSRF hardening, and — critically —
Julienne's loud, repeated user complaint is **data-loss + crash-on-import**, i.e. their durability is
the exposed flank, not their pipeline design.

The single highest-leverage borrow: **the import progress/queue UX** (state machine + slot queue +
cancel/retry drawer). It is pure front-end, legally clean, directly addresses the "30–60s of dead air"
problem on Sloe's lead viral hook, and is the thing independent reviewers praise Julienne for ("the UI
is so friendly… everything just makes sense").

---

## 1. The import / extraction pipeline (their actual moat)

### 1.1 Architecture: two clean stages, acquisition vs extraction

The whole pipeline is a **client-side orchestrator** that dispatches to platform-specific acquisition,
then funnels *everything* into **one unified server extraction call**. Confirmed master dispatcher
**[BUNDLE]**:

```js
async generateRecipeFromUrl(e,i,o){
  const sr=detectPlatform(e), ir=extractPlatformData(e);          // 1. detect + parse id
  let ar;
  if(sr==="youtube"&&ir.identifier)      ar=await this.processYouTube(e);
  else if(sr==="tiktok"&&this.tiktokService) ar=await this.processTikTok(e,ir.identifier);
  else                                    ar=await this.processGeneralWebsite(e,sr,ir.identifier||"");
  if(!ar||!hasRecipeSourceData(ar))      throw new Error("No recipe data found on the webpage");
  if(!hasSubstantiveRecipeSource(ar))    throw new Error("Not enough recipe content was extracted
       from this link. This often happens during bulk import — try this URL again individually.");
  // 2. ONE unified extraction call, regardless of source platform:
  const cr=httpsCallable(functions,"extractRecipeFromScrapedData");
  const ur=(await withRetry(()=>cr({scrapedData:ar}),{retries:1,baseDelayMs:2e3,label:`recipe extraction (${e})`})).data;
  …
}
```

The design principle worth stealing: **the LLM never sees a URL.** Acquisition normalises *every* source
(YouTube transcript, TikTok info, scraped HTML, Instagram caption) into one `scrapedData` shape
`{title, description, content, ingredients, instructions, image, platform, platformIdentifier,
originalLink}`, and a **single** `extractRecipeFromScrapedData` Cloud Function turns that into the
canonical recipe. New sources = new acquisition adapter only; the expensive/clever extraction step is
written once. **[BUNDLE]**

The **top-level input router** sits above this and picks the modality **[BUNDLE]**:

```js
…tr=await this.generateRecipeFromPhotos(rr,o,a)   // image(s)
else if(d) tr=await this.generateRecipeFromUrl(e.trim(),o,a)   // link
else if(e.trim()) tr=await this.generateRecipeFromText(e.trim(),o,a)   // pasted text
else throw new Error("No valid input provided")
// recipeType: er?"video":g?"photo":d?"link":"text"
```

Entry-point copy: **`"Create a recipe using a link, photo, video, or text"`** (and
`"Create or save a recipe using a link, photo, file, or text."`). One box, four modalities. **[BUNDLE]**

### 1.2 The four Cloud Functions that do extraction — all [SERVER]

The client calls these by name via `httpsCallable(functions, …)`; the **prompts/logic are invisible**
(server-side). What's confirmed is the *signature* each is handed:

| Cloud Function | Input sent from client | Purpose |
|---|---|---|
| `extractRecipeFromScrapedData` | `{scrapedData:{…}}` (the normalised blob) | **Primary** path for every URL import |
| `extractRecipeFromVideo` | `{videoData, fileName}` | Uploaded video file |
| `extractRecipeFromText` | `{text}` | Pasted text |
| `extractRecipeFromImage` | `{imageUrl, context}` | Photo / screenshot import |

> **Caveat the task flagged, confirmed:** the server functions the prior backend-map called
> `generateRecipeFrom{Url,Video,Photos,Text}` are **client-side orchestrator method names** (the
> dispatcher class above), *not* Cloud Functions. The actual server extraction endpoints are the four
> `extractRecipeFrom*` above. The real LLM prompt/model for extraction is **not in the bundle**
> (`[SERVER]` — only Whisper, Gemini-image, and Supadata calls are client-visible).

### 1.3 Acquisition adapters — the per-platform craft

**YouTube — `processYouTube`** via **Supadata** `getYouTubeData` → `supadataYouTubeTranscript`
Cloud Function. Notable: a **transcript-retry loop** when the transcript comes back empty (common on
fresh uploads), with escalating backoff **[BUNDLE]**:

```js
const i=await withRetry(()=>this.supadataService.getYouTubeData(e),{retries:2,baseDelayMs:2e3,label:`YouTube data (${e})`});
let o=i.transcript?.content?.trim()||"";
if(!o) for(let ar=0;ar<2&&!o;ar++){
  await new Promise(hr=>setTimeout(hr,2500*(ar+1)));   // 2.5s, then 5s
  o=(await this.supadataService.getYouTubeData(e)).transcript?.content?.trim()||"";
}
```

**TikTok — `processTikTok`** via `tiktokVideoInfo` Cloud Function (`{videoUrl}` → `{success, data,
error}`); a separate `TikTokServiceSecure.extractVideoId` handles the `/@user/video/123`, `vm.tiktok.com`
short-link, and `?item_id=` URL shapes. **[BUNDLE]**

**Instagram — `processInstagramUrl`** does **not** use Supadata. It extracts the shortcode (`/reel/`,
`/p/`, `/tv/`) and POSTs `{shortCode}` to a **dedicated proxy on Heroku** **[BUNDLE]**:

```js
getInstagramEndpoint$1=()=>window.location.origin.includes("localhost:5002")
  ? "/api/instagram"
  : "https://kitchen-cabinet-a954a3c78331.herokuapp.com/url/ig/proxy";
```

> **New vs prior docs:** a whole second backend — **`kitchen-cabinet-a954a3c78331.herokuapp.com`** — runs
> the Instagram fetch *and* the general web scraper (`WebScrapingService` base URL). So Julienne's import
> stack is **Firebase Cloud Functions + Supadata + a bespoke Heroku scraping/proxy service**, not Firebase
> alone. **[BUNDLE]**

**General websites — `processGeneralWebsite`** is a **two-tier scraper with fallback** **[BUNDLE]**:

```js
try {                                   // tier 1: bespoke scraper (Heroku WebScrapingService)
  const c=await withRetry(()=>this.scrapingService.scrapeWebpage(e),{retries:1,baseDelayMs:1500,label:`scrape (${e})`});
  if(!(c.title && c.title!=="Recipe from www.thekitchn.com" && c.description && c.description!=="Failed to scrape recipe content"))
     throw new Error("Primary scraping returned invalid data");
  return c;
} catch(c) {                            // tier 2: Supadata web scrape as fallback (general only)
  if(i==="general"){
    const d=await withRetry(()=>this.supadataService.scrapeWebpage(e),{retries:1,baseDelayMs:1500,label:`Supadata scrape (${e})`});
    …
  } else throw c;
}
```

Underneath, the import scraper reads **schema.org/JSON-LD** Recipe markup and a **flexible field-mapper**
that accepts many shapes (`name|title|recipe_name|recipeName`, `ingredients|ingredient_list|
recipeIngredient`, `instructions|directions|steps|method|recipeInstructions`) before falling back to the
server LLM on raw `content`. There's also a `translateRecipeIfNeeded` step (multilingual imports). **[BUNDLE]**

> **Distinction worth noting (debunks an easy mis-read):** the ~21 site-specific methods
> (`scrapeSmittenKitchen`, `scrapeBudgetBytes`, `scrapeFoodNetwork`, `scrapeSeriousEats`, …) belong to a
> **`RandomRecipeService`** that hits `/api/discoverRecipeUrls?site=X&count=12` to populate the **Discover
> feed**, *not* the user-import path. User import is the generic JSON-LD + LLM path above. **[BUNDLE]**

### 1.4 Uploaded-video path — on-device audio → Whisper

For an uploaded **video file** (not a URL), the client extracts audio with the **Web Audio API** and
transcribes via **OpenAI Whisper-1** before extraction **[BUNDLE]**:

```js
const o=new FormData; o.append("file",e); o.append("model","whisper-1");
o.append("language","en"); o.append("response_format","json");
await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${…}`}…});
```

The client also surfaces a 5-step progress trail for this path: `Step 1: Downloading video from URL` →
`Step 2: Converting video to blob` → (audio extract) → `Step 4: Generating thumbnail` → `Step 5:
Uploading thumbnail to Firebase Storage`. **[BUNDLE]**

> ⚠️ **Anti-pattern to *not* copy:** the Whisper call is fired **from the client with a bearer token in
> the bundle** (`Authorization: Bearer ${…}` resolved from an inlined env var). That exposes an OpenAI
> key to anyone who reads the JS. Sloe routes all model calls server-side (`src/lib/server/aiProvider.ts`)
> — keep doing that; this is a Julienne mistake, not a strength.

### 1.5 Quality gates — they refuse to waste an LLM call on garbage

Before extraction, two predicates decide if there's *enough* to extract **[BUNDLE]**:

```js
hasRecipeSourceData(s){ return hasMeaningfulText(s.content)||hasMeaningfulText(s.transcription)
  ||hasMeaningfulText(s.description)||hasMeaningfulList(s.ingredients)||hasMeaningfulList(s.instructions) }

hasSubstantiveRecipeSource(s){ return hasMeaningfulList(s.ingredients)||hasMeaningfulList(s.instructions)
  ? true : ((s.transcription?.trim().length||0)+(s.content?.trim().length||0)) > /*threshold*/ }
```

If `hasSubstantiveRecipeSource` fails, the user gets a **specific, actionable** error — note the
bulk-import hint **[BUNDLE]**:

> *"Not enough recipe content was extracted from this link. This often happens during bulk import — try
> this URL again individually."*

This is a small thing that reads as polish: the failure copy *teaches the user the workaround* instead of
a generic "something went wrong."

### 1.6 Retry / resilience primitive

One shared `withRetry(fn, {retries, baseDelayMs, label, shouldRetry})` with backoff wraps **every**
network leg (scrape, transcript, extraction). Extraction itself only retries once
(`{retries:1, baseDelayMs:2000}`); acquisition retries more (YouTube `retries:2`). **[BUNDLE]**

```js
function withRetry(s,e={}){ const{retries:i=2,baseDelayMs:o=1500,label:a="operation",shouldRetry:c}=e;
  for(let er=0;er<=i;er++) try{ return await s() } catch(tr){ if(er===i||!(c?c(tr):true)) break; … } }
```

### 1.7 Abuse protection on the pipeline

Firebase **App Check + reCAPTCHA Enterprise + Cloudflare Turnstile** all present — they gate the import
functions against scripted abuse. **[BUNDLE]** (counts: `appCheck`≈50, `recaptcha`≈39, `Turnstile`≈14.)

---

## 2. The recipe-detail + cooking UX

### 2.1 Recipe-detail action set

Confirmed action labels: **Cook · Ask Julienne · Watch · Save · Share.** **[BUNDLE]**

- **Watch** — `"Watch the original video!"` opens the source Reel/TikTok/YouTube inline (attribution +
  re-engagement). For Instagram-sourced video, a floating player renders bottom-left on the detail page. **[BUNDLE]**
- **Ask Julienne** — recipe-scoped chat (`httpsCallable(functions,"generateText")` server path
  `[SERVER]`); tone is explicitly pinned in a system prompt fragment: *"Keep the tone relaxed,
  approachable, and conversational — like you're talking to a friend about food. Avoid being overly
  whimsical or cutesy."* **[BUNDLE]** (Independent reviewers note the chat "needs work" — concept strong,
  depth thin.) **[WEB]**
- **Cook** — step-by-step cook view (`"Next step"`). **No screen-wake-lock** found (a real gap: the
  screen will sleep mid-recipe). **[BUNDLE]**
- The **"Story" action the task asked about does not exist as a recipe action** — `"/stories/"` is an
  Instagram URL pattern, and `"Food History"`/`story:` strings belong to an **admin "Food History"
  content tool**, not user-facing cooking. **[BUNDLE]**

### 2.2 The data model — step-centric, this is the clever bit

Ingredients are stored **inside each step**, each with its own amount, then the flat ingredient list is
**derived** (not authored). The shape, confirmed from the `generateRecipeTips` payload **[BUNDLE]**:

```js
steps: e.steps.map(d => ({
  text: d.text,
  ingredients: d.ingredients.map(g => ({ name:g.name, quantity:g.quantity, unit:g.unit }))
}))
```

That's what powers **inline ingredient amount-chips while cooking** (each step shows exactly the "200g
flour / 2 eggs" it needs). The canonical "base ingredients" list is computed by flattening every step's
ingredients, de-duping by name, and **dropping already-processed/derived items** **[BUNDLE]**:

```js
e.steps.forEach(c => { c.ingredients && i.push(...c.ingredients) });
const o=this.removeDuplicatesByName(i);
return o.filter(c => !this.isProcessedIngredient(c,o));   // e.g. don't relist "cooked rice" if "rice" exists
```

> **For Sloe:** this is a meaningfully better cooking model than a separate flat ingredient list + plain
> step text. It's also a clean substrate for **per-step nutrition** later (Sloe's accurate engine could
> attribute macros to the step the ingredient enters). Worth considering for the recipe schema — but it's
> a non-trivial data-model change; **ticket it, don't free-hand it.**

### 2.3 Servings scaling — present but coarse

`servings` is a first-class field; macros are normalised per-serving (`carbs:Math.round(i/d*2)/2` etc.,
`d=servings`); there's a tracked `servings_adjustment` analytics event. But independent review flags
scaling as **"only 1.0 increments"** — i.e. you can double, not 1.5×. **[BUNDLE] + [WEB]** *(Sloe should
do fractional/arbitrary scaling — a cheap, concrete win over them.)*

### 2.4 Shopping list — pantry-aware, with substitutions

- Entry CTA: **`"Ready to cook? Add all recipe ingredients"` → `"Add to your shopping list"`.** **[BUNDLE]**
- **Pantry-aware**: distinguishes **`available ingredients`** vs **`missing ingredients`** (with a
  `missingIngredientsCache`), and offers **`Search missing ingredients…`**. **[BUNDLE]**
- **Allergen→substitution engine**: a hardcoded map keyed by allergen yields suggestions, e.g.
  `eggs → "flax eggs or applesauce"`, `nuts → "sunflower seeds or pumpkin seeds"`,
  `dairy → "plant-based alternatives (oat milk, vegan cheese, coconut cream)"`; plus inline
  compatibility warnings ("Consider substituting these ingredients or choosing a different recipe").
  **[BUNDLE]**
- **Instacart**: present only as a logo (`/assets/images/InstacartLogo.png`) on the shopping list — a
  "shop with Instacart" affordance, **not** a deep cart-sync integration. **[BUNDLE]**

### 2.5 AI tips

`generateCookingTip` (a rotating "Daily Cooking Tip") and `generateRecipeTips` (per-recipe, fed the full
step+ingredient model) — both `[SERVER]`. Plus a small **deterministic** tip bank client-side
(`d("egg",["powder","substitute"]) → "Pro tip: Remove scrambled eggs from heat while slightly…"`). **[BUNDLE]**

### 2.6 Bulk import + the progress UX (the most borrowable surface)

This is where Julienne feels premium. **[BUNDLE]:**

- **Bulk Import Recipes** — paste many URLs / a JSON blob; each becomes a queued job.
- A **singleton `RecipeImportScheduler`** with `enqueue / activeCount / getQueuePosition` runs jobs on
  **limited concurrent slots**, surfacing live queue position:
  - `"In queue (#3) — starts when a slot opens"` / `"In queue — starts when a slot opens"`
  - `"Creating 2, 1 in queue"` · `"1 recipe in queue"` · `"Your recipes are all done!"`
- A persistent **`RecipeGenerationDrawer`** shows every in-flight recipe with **per-recipe cancel +
  retry** (`onCancelRecipe`, `onRetryRecipe`).
- A **6-stage human-readable state machine** drives the per-recipe label:

  ```
  queued → confirming ("Confirming recipe type…")
         → extracting ("Extracting recipe details from link/image…")
         → organizing ("Organizing ingredients and steps…")
         → generating ("Generating recipe instructions…")
         → translating (multilingual)
  ```

The net effect: the unavoidable 30–60s extraction wait is **legible and cancellable**, multi-recipe
imports don't block the UI, and failures are per-item recoverable. This is exactly the "calm, it's
handling it" feel reviewers praise.

---

## 3. Vendors / SDKs — the full third-party surface

Confirmed from the bundle, including **corrections** to the prior backend map:

| Vendor / SDK | Use | Confidence | Evidence |
|---|---|---|---|
| **Firebase / GCP** (`julienne-3555a`, `us-central1`) | Auth, Firestore, Storage, Cloud Functions (all `extractRecipeFrom*`, image gen, insight, cost), FCM web push, App Check | **[BUNDLE]** | `firebaseConfig={…projectId:"julienne-3555a"…}` |
| **Supadata** | YouTube transcript (`supadataYouTubeTranscript`) + web scrape fallback (`supadataWebScrape`) | **[BUNDLE]** | service-class log strings |
| **Heroku — `kitchen-cabinet-a954a3c78331`** | Bespoke Instagram proxy (`/url/ig/proxy`) **+** general `WebScrapingService` base URL | **[BUNDLE]** *(new vs prior docs)* | `getInstagramEndpoint$1`, `WebScrapingService` ctor |
| **OpenAI Whisper-1** | Audio transcription for uploaded video files (client-side ⚠️) | **[BUNDLE]** | `model:"whisper-1"`, `api.openai.com/v1/audio/transcriptions` |
| **TikTok info service** | `tiktokVideoInfo` Cloud Function | **[BUNDLE]** | `httpsCallable(functions,"tiktokVideoInfo")` |
| **Stripe** | Billing (`js.stripe.com`, `docs.stripe.com`); plans Monthly/Annual/Lifetime | **[BUNDLE]** | `getPlanDisplayName`, plan switch |
| **Google Analytics 4 (ReactGA)** | The **only** consumer product analytics | **[BUNDLE]** | `ReactGA.initialize`, IDs `G-7YRBP3GS0G`, `G-FSBN27V5JS` |
| **Cloudflare Turnstile** | Bot/abuse challenge | **[BUNDLE]** | `challenges.cloudflare.com`, `Turnstile` |
| **reCAPTCHA Enterprise** | Abuse protection (App Check provider) | **[BUNDLE]** | `recaptcha`/`RECAPTCHA` strings |
| **Apple Sign In + Google auth** | `securetoken.google.com`, `appleid.cdn-apple.com` | **[BUNDLE]** | auth domains |
| **Shopify Buy Button** (`161159-9b.myshopify.com`) | **Merch storefront** (not IAP) | **[BUNDLE]** *(new)* | `ShopifyBuy.buildClient`, storefront token |
| **Instacart** | Shopping-list affordance (logo only) | **[BUNDLE]** *(new)* | `InstacartLogo.png` |
| **OpenLibrary + Amazon** | Cookbook/book metadata by ISBN/ASIN (`fetchBookMetadata`, `fetchAmazonProductData`) | **[BUNDLE]** | `openlibrary.org/api/books?bibkeys=amazon:` |
| **Midjourney** (Cloud Run) | Internal **IG marketing** image studio — operator copies prompt to clipboard; **separate** from the consumer Gemini image path | **[BUNDLE]** | `submitmidjourneyprompt`, `--v 7.0 --ar 4:5` |

**Vendors explicitly *absent*** (checked, not just unobserved): **no Segment, no Amplitude, no Mixpanel,
no PostHog** (the 219 "Segment" / 5 "amplitude" hits are substring noise — verified no
`cdn.segment.com`/`amplitude.com` hosts). **No A/B-testing or feature-flag platform** (LaunchDarkly /
Optimizely / Statsig / GrowthBook / split.io — none; the "experiment" hits are Firestore's
`experimentalForceLongPolling`). **No Sentry / Bugsnag / Datadog** error monitoring — which, given their
crash complaints, is itself telling.

> **Read:** Julienne's instrumentation is **thin** — GA4 events only, no replay, no experimentation, no
> crash reporting. Sloe is *ahead* here (PostHog product analytics + session replay + Sentry, all
> consent-gated). That's a moat in disguise: Sloe can see *why* an import fails and A/B the fix; Julienne
> is flying on GA4 aggregates, which is consistent with their unresolved crash-on-import reputation.

---

## 4. What users actually praise (corroboration) — and what they don't

**[WEB]**, App Store 4.8★ / **only ~24 ratings** (thin base), latest **v1.3.22**:

- **The UX / "it just makes sense"** — *"Everything is methodically thought out and everything just makes
  sense. The UI is so friendly"* (Saba Iranikhah). *"Dude, I can't even cook white rice without help from
  Julienne. It's a must-download!"* (Kvalcourt1).
- **The import promise** — press uniformly frames the hook as *"save recipes from TikTok or Instagram by
  uploading the video or pasting a link → a simple, **ad-free** recipe view with ingredients, cooking
  steps"* and *"capture cooking steps, ingredients… **in seconds**."* Marketing line in-bundle:
  *"Beautiful ad-free recipes every time."*
- **What they praise is the *experience of import*, never the numbers** — consistent with the nutrition
  doc: zero reviews mention macro accuracy; the macro panel is decorative. The praise is "fast, clean,
  ad-free, friendly," which maps exactly to §1–§2 (the pipeline + the progress/cook UX), **not** to data
  quality.

**The loud, repeated complaints** — *"App frequently crashes when uploading recipes and when it crashes
it doesn't save the recipes previously uploaded"* (Reedo229); *"Every time I try to edit or customize a
recipe, my changes don't save"* (alli88421). **Durability, not pipeline design, is their exposed flank.**

> **Discrepancy to flag:** App Store release notes mention a **"meal planning feature for monthly
> planning"** and **Instacart** in 1.3.x, but the **web bundle has no meal-planner code** (only marketing
> keywords + a "suggest meal plans in your budget" onboarding line) and only an Instacart **logo**. So
> either (a) meal-planning is **iOS-app-only / very recent** and not yet on web, or (b) it's lighter than
> the note implies. Earlier reviewers said *"meal planning: none."* **[WEB] vs [BUNDLE] — treat
> meal-planning as nascent/iOS-only until a live iOS capture confirms otherwise.**

---

## 5. Sloe — borrow vs already beats

### 5.1 BORROW (clean, high-leverage, legally fine — all front-end or architecture)

1. **The import progress + queue UX — do this first.** A human-readable **state machine**
   (`confirming → extracting → organizing → generating`), a **slot-based queue** with live position for
   multi-URL/bulk imports, and a **persistent drawer with per-recipe cancel/retry**. This is the
   single biggest perceived-quality gap on Sloe's lead viral hook and it's pure UI. Sloe already has
   `recipeImportPipelineTrace.ts` (the analytics spine) and `importErrorCopy.ts` — extend them into a
   visible staged progress + queue. **Ticket it.**
2. **Acquisition/extraction separation as a hard boundary.** Sloe's `extractSocialRecipe.ts` already
   leans this way (detect platform → fetch meta → LLM). Formalise it: normalise *every* source into one
   `scrapedData` shape and keep a **single** extraction prompt. Makes adding Pinterest/blog/video adapters
   cheap and keeps the expensive prompt in one place.
3. **Pre-flight quality gates.** Port the `hasRecipeSourceData` / `hasSubstantiveRecipeSource` idea: only
   spend an LLM call if there's meaningful content; otherwise return a **specific, teaching** error
   (Julienne's bulk-import hint is a great pattern). Saves cost and improves the failure UX.
4. **Transcript-retry loop for fresh video.** Their YouTube empty-transcript backoff (retry 2× with
   2.5s→5s) is a real-world robustness detail Sloe's audio-transcription fallback should mirror.
5. **Step-centric data model (evaluate, then ticket).** Ingredients inside steps with `{name, quantity,
   unit}` → inline amount-chips while cooking → derived base-ingredient list. Strong cooking UX *and* a
   clean substrate for **per-step nutrition** (a place Sloe's accurate engine could shine where Julienne
   can't). Schema change — design it, don't free-hand it.
6. **Pantry-aware shopping (have vs missing) + substitutions.** Their available/missing split and
   allergen→substitution map are a nice "smart shopping list" layer. Sloe can do the substitution piece
   **better** because Sloe knows the real macros of the substitute (flax-egg vs egg isn't macro-neutral —
   a differentiator).
7. **Cook-mode wake-lock.** Julienne *lacks* this; shipping `navigator.wakeLock` (web) / `expo-keep-awake`
   (mobile) in cook mode is a cheap, obviously-correct win that beats them outright.

### 5.2 ALREADY BEATS (hold the line — these are the moat)

- **Nutrition accuracy** — the whole point. Julienne's hardcoded-table + substring matcher is ~2× wrong
  on common foods (cottage-cheese→cheese) and its kcal/macros don't reconcile (see the nutrition doc).
  Sloe's multi-source cascade + confidence gate + Atwater guard makes the exact bug *structurally
  impossible*. **This is uncopyable on their architecture.**
- **The goals/health retention layer** — Julienne has **no** targets/TDEE/progress loop; it's a saver, not
  a coach. Sloe's "love food AND have goals" wedge is the reason a user *returns*. Julienne's reviewed
  flank is retention/durability; this is precisely where Sloe wins.
- **Honest AI-image provenance** — Sloe's visible AI label + C2PA/provenance vs Julienne's silent,
  unlabelled, SynthID-only images (an EU AI Act Art. 50 exposure for them). Keep it.
- **Server-side model calls + SSRF hardening** — Sloe never ships a model key to the client and guards
  fetches (`ssrfGuard.ts`); Julienne leaks an OpenAI bearer token in the bundle and has no SSRF guard
  visible. Sloe is safer by design.
- **Instrumentation** — PostHog product analytics + session replay + Sentry (consent-gated) vs Julienne's
  GA4-only, no-replay, no-crash-reporting. Sloe can *see and fix* import failures; their crash reputation
  suggests they can't.
- **Region-aware pricing intent** — Julienne is flat-USD (`$2.99/mo, $19.99/yr, lifetime`); Sloe's
  region-aware posture is more correct (note: Julienne's lifetime tier is an ad-subsidised play Sloe
  shouldn't mirror 1:1).

### 5.3 DON'T COPY (their mistakes)

- **Client-side model keys** (the Whisper bearer token in the bundle) — keep everything server-side.
- **No crash reporting / thin analytics** — their data-loss reputation is the cost of flying blind.
- **Coarse 1.0-increment servings scaling** — do fractional scaling instead.
- **Silent unlabelled AI images** — keep Sloe's provenance posture.

---

## 6. Open questions / invisible (server-side) — can't confirm from the bundle

1. **The extraction prompts + model** behind `extractRecipeFromScrapedData/Video/Text/Image` — the core
   IP — are **[SERVER]**. We know the *inputs* and the *normalised shape*, not the prompt or model. A live
   network capture of a real import would reveal request/response bodies (not the prompt).
2. **Whether Julienne does any nutrition on the *server*** — the macros are provably the crude client
   table, but kcal comes from a separate opaque `calculateRecipeCalories` (per the nutrition doc).
3. **Meal-planning + Instacart depth** — present in iOS release notes, near-absent in the web bundle.
   Needs a **live iOS capture** to characterise (likely iOS-only/newer). **[WEB] vs [BUNDLE] conflict.**
4. **Supadata vs bespoke-scraper hit-rates** and the general-scraper's per-site coverage — the fallback
   *branches* are visible, the success rates are not.
5. **Cook-mode depth** — only `"Next step"` confirmed in the bundle; the full cook-mode interaction (step
   timers? voice?) isn't characterised from web. iOS capture would settle it.
6. **This is the web bundle** — the iOS binary wasn't decompiled. Both almost certainly call the same
   Firebase functions, but iOS-only surfaces (meal plan?) won't appear here.

---

## Sources

- **Julienne web bundle** (primary, first-hand decompiled strings):
  `https://withjulienne.com/assets/index-f24fde0f.js` (3.58 MB, fetched 2026-06-08)
- **App Store** (rating, reviews, version, release notes):
  [`apps.apple.com/us/app/julienne-a-smarter-cookbook/id6451086935`](https://apps.apple.com/us/app/julienne-a-smarter-cookbook/id6451086935)
- **ProductHunt:** [`producthunt.com/products/julienne-2`](https://www.producthunt.com/products/julienne-2)
- **Press / listings:** [`appadvice.com/app/julienne-a-smarter-cookbook/6451086935`](https://appadvice.com/app/julienne-a-smarter-cookbook/6451086935),
  [`mwm.ai/apps/julienne-a-smarter-cookbook/6451086935`](https://mwm.ai/apps/julienne-a-smarter-cookbook/6451086935),
  [`withjulienne.com`](https://withjulienne.com/)
- **Sloe internal (comparison baseline):** `src/lib/recipe-import/extractSocialRecipe.ts`,
  `socialUrlHelpers.ts`, `parseRecipeFromHtml.ts`, `ssrfGuard.ts`,
  `src/lib/analytics/recipeImportPipelineTrace.ts`, `src/lib/recipes/importErrorCopy.ts`
- **Companion research:** [`2026-06-07-julienne-image-system.md`](./2026-06-07-julienne-image-system.md),
  [`2026-06-08-julienne-nutrition-method.md`](./2026-06-08-julienne-nutrition-method.md),
  [`2026-06-03-recipe-import-competitive-posture.md`](./2026-06-03-recipe-import-competitive-posture.md)
