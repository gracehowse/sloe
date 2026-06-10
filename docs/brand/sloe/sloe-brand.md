# Sloe — Brand Identity

> **Status:** candidate brand spec for the Suppr rebrand. Generated 2026-06-02 by `brand-manager`.
> Nothing is committed. This spec + its companion render (`sloe-render.html`) are the deciding
> evidence for **Sloe vs the placeholder "Suppr"** — built per the Tare lesson (a name that read
> fine on paper but died the moment it was rendered). Formal legal clearance (class 9 + class 5 /
> 29-30 / 43, USPTO + EUIPO + UK-IPO, App Store namespace, `eatsloe.com` / `sloe.life` domains +
> @sloe handles) must clear before any commit.

---

## 1. Name story

**Sloe** is the fruit of the blackthorn (*Prunus spinosa*) — the dusky blue-purple hedgerow berry
foraged in late autumn, famous for two things: a deep, frosted indigo-plum skin with a pale
"bloom" you can rub off with a thumb, and the patience it demands (you wait for the first frost,
then you wait again while it steeps into sloe gin). It is the slow-food berry by nature.

The name does three jobs at once:

1. **It is a real, ownable colour.** Like Sorrel hands you a russet, Sloe hands you a *richer*
   palette: a deep indigo-plum primary plus the berry's signature frosted-bloom highlight — a
   pale, cool, dusty lilac-grey that no competitor in the lane owns. The palette is built into
   the name, and it is more distinctive than a warm herb-russet because it pairs a jewel-dark
   anchor with a soft frosted light.

2. **It is a homophone of "slow."** This is the heart of the brand and it must be *felt, never
   stated.* Sloe = slow food, unhurried, anti-grind, calm. It is the quiet antidote to the
   frantic gamified streak-anxiety of MyFitnessPal and the calorie-from-a-photo urgency of
   Cal AI. The domains carry the pun: **eatsloe.com** reads "eat slow"; **sloe.life** reads
   "slow life." We never write "slow down!" in copy — the name does that work silently.

3. **It is deliberately non-descriptive.** Sloe does not say "recipe" and does not say "tracker."
   That is the whole point. The recipe-app graveyard is full of names that announced themselves
   as recipe apps (Recime, Paprika, Mela) and the diet lane is full of names that announced the
   diet (MyFitnessPal, Lose It!). Sloe sits with Zoe, Calm and Noom: a short, warm, abstract
   word that becomes a brand because the **tagline** carries the meaning — *the food-and-goals
   bridge lives in the line under the wordmark, never in the name.*

Why it beats the herb shortlist (Sorrel / Comfrey / Borage): a herb says "cooking" loudly and
risks reading as *just a recipe app* — the exact trap to avoid. Sloe says neither cooking nor
tracking; it says *calm, considered, a little premium, a little British* — and lets the tagline
do the positioning. It also ships a far more distinctive palette (jewel indigo + frost) than any
herb-green.

**Pronunciation:** /sloe/ — exactly "slow." One syllable, zero ambiguity once heard, and the
"oh that's *slow*" penny-drop is a gift for word-of-mouth (it is its own explainer).

**Risk to clear:** the homophone means voice-search and verbal sharing can land on "slow" — a
feature, not a bug, but worth a domain-defensive grab of the obvious slow-spelled variants.
Spelling on first read is the one real cost: people may type "slow." Mitigated by `eatsloe.com`
being the front door and the wordmark always appearing with the berry mark to anchor the spelling.

---

## 2. Palette — derived from the sloe berry

The berry gives us the system: a **deep indigo-plum** flesh, a **frosted bloom** highlight, and
we add a **warm clay** for the coaching warmth (permission, not restriction) and a **warm cream/oat**
ground so the whole thing reads Lifesum-warm rather than clinical-cool. The jewel-dark plum is the
brand signature; warmth keeps it human.

### Core brand

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | **Sloe** (indigo-plum) | `#3B2A4D` | Wordmark, primary ink on cream, headers, the berry mark fill. The brand anchor. |
| Primary deep | **Sloe Deep** | `#241733` | Darkest plum — dark-surface backgrounds, deep shadow, high-contrast ink. |
| Primary bright | **Damson** | `#6A4B7A` | Lifted plum for gradients, active states, the brand gradient's dark stop. |
| Bloom (signature light) | **Frost** | `#C9C2D6` | The berry's frosted "bloom" — dusty cool lilac-grey. Soft dividers, muted chips, the bloom highlight on the mark, inactive ring track. **The ownable accent no competitor has.** |
| Bloom tint surface | **Frost Mist** | `#EDEAF1` | Faint cool wash for cards/surfaces that want a hint of the bloom. |

### Warm coaching accent (permission / warmth)

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Warm accent | **Clay** | `#C8794E` | The coaching warmth — encouragement pills, "Pro" peach pill, warm CTA, the single splash of warmth against the plum. Permission, not restriction. |
| Warm tint | **Clay Soft** | `#F4E2D2` | Peach tint surface behind warm accents (Pro pill, coaching highlight). |
| Warm gold | **Honey** | `#D6A24A` | Best-day star markers, gentle highlight, "closest to target" celebration. |

### Ground & ink

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Ground | **Oat** | `#FBF8F3` | Primary warm cream/oat background — the canvas. Warm, not paper-white, not clinical. |
| Ground 2 | **Oat Deep** | `#F3EEE6` | Faint warm wash for grouped sections. |
| Card | **Linen** | `#F7F3EC` | Soft warm card surface on Oat. |
| Ink | **Ink** | `#221B26` | Warm near-black with a plum undertone — body text on cream. |
| Ink soft | **Ink Soft** | `#6A6072` | Muted body / secondary text. |
| Ink faint | **Ink Faint** | `#9B93A3` | Captions, numerals, placeholder. |
| Line | **Line** | `#E8E2EC` | Hairline dividers, card borders (a whisper of plum). |

### Semantic (state)

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Success / under budget | **Sage** | `#5E7C5A` | On-track / calorie-ring under-budget (per the locked ring rule). |
| Success soft | **Sage Soft** | `#E3EADD` | Under-budget tint, ring fill background. |
| Over budget (calorie ring) | **Destructive** | `#C0533F` | Calorie-ring over-budget ONLY (per the locked override). |
| Over budget (macros/sodium) | **Amber** | `#C9892C` | All *other* over-budget signals (macros, sodium = orange) — never the ring. |

### Brand gradient

`Damson #6A4B7A → Sloe #3B2A4D` (plum-on-plum, optionally lifting toward `Frost #C9C2D6` at the
very edge for the bloom shimmer). Reserved — marketing, paywall, onboarding emphasis, the empty
calorie ring, the avatar/app-icon. **Never in core product chrome.**

### Calorie-ring colour mapping — preserved (does NOT change)

The locked override survives the rebrand intact:

| State | Colour |
|---|---|
| Empty / not yet logged | **Brand gradient** (Damson → Sloe, with a Frost edge) |
| Logged + under budget | **Sage** `#5E7C5A` (success green) |
| Logged + over budget | **Destructive** `#C0533F` |

Other over-budget signals (macros, sodium) stay **Amber**. Sloe only re-skins the *empty/gradient*
state to the plum gradient — green and red keep their semantic meaning untouched.

---

## 3. Typography

Carries the warm-coaching pairing already chosen for the direction (serif display + humanist sans),
so the rebrand is a re-skin, not a re-architecture.

- **Display / wordmark / recipe titles / coaching lines → Fraunces.**
  A warm, "old-style" optical serif with soft ink-traps and a gorgeous italic. Variable optical
  size; set the wordmark at a low weight (~340-400) for an editorial, unhurried, slightly literary
  feel — *slow* made visible. Google Fonts, variable. (`Fraunces`, opsz 9-144, wght 300-700.)
  - Fallback stack: `'Fraunces', 'Georgia', 'Times New Roman', serif`.

- **Body / UI / data → Inter.**
  Clean humanist sans, excellent at small sizes, `tabular-nums` on every changing number (the
  numbers must feel engineered — that pillar survives the warm skin). Google Fonts, variable.
  - Fallback stack: `'Inter', system-ui, -apple-system, sans-serif`.

- **Numerals:** Inter `tabular-nums` for data tiles (engineered, aligned). Fraunces numerals are
  reserved for the *hero* calorie figure in the ring and big editorial moments only — warm, not
  spreadsheet.

**Web-safe / system fallback note:** both are Google Fonts with strong system fallbacks; no paid
licence. If a fully system-safe pairing is ever needed (email, OG images), substitute
`Georgia` (display) + `-apple-system / Segoe UI` (body) — the closest free analogues.

---

## 4. Wordmark direction

Always lowercase **"sloe"** in product and most marketing (sentence-start capitalisation only in
running prose). Lowercase reads calm, modern, unhurried — it *is* the slow.

Three concepts to render and choose between:

**Concept A — The Bloom Dot (lead).**
Lowercase `sloe` in Fraunces. The **o** is treated as the berry: a solid indigo-plum disc with a
soft pale **Frost** crescent highlight on the upper-left — the literal frosted "bloom" on a real
sloe. One letter does all the symbolic work; the rest of the wordmark stays pure type. Scales to a
single-glyph app icon (the bloomed berry-o on Oat or on the plum gradient). *This is the
recommended mark: it encodes the berry, the colour, and the bloom in the most-used letter, and
gives a clean icon for free.*

**Concept B — The Frost Sprig.**
`sloe` in Fraunces with a tiny blackthorn detail — a single leaf/thorn ascender flourish off the
**l**, or a two-berry sprig sitting as a diacritic above the **o**. More botanical, more editorial-
cookbook; richer but busier, and the icon must crop to the sprig. Use as a secondary "stamp" mark
for packaging/marketing moments, not the primary lockup.

**Concept C — Pure type, no mark.**
`sloe` in Fraunces, low weight, generous tracking, full stop optional (`sloe.`) to nod to
`sloe.life` and to the *full stop = calm, finished, unhurried* idea. The most restrained, most
Calm/Zoe-like. Risk: loses the ownable berry/colour symbol and leans entirely on the typeface —
weaker as an app icon. Keep as the minimal wordmark for tight horizontal spaces (nav bars, footers).

**App icon:** Concept A's bloomed berry-o, centred on the brand gradient (Damson->Sloe) with the
Frost bloom catching the light — a single, premium, instantly-spellable jewel. Recognisable at
60x60.

**Shipped icon + splash (2026-06-04).** The icon currently on the phone is the **full lowercase
"sloe" wordmark** (Fraunces) on the plum gradient — Grace's chosen mark — not the single-glyph
Concept A above (Concept A stays a future option for the smallest sizes). The home-screen label is
now **Sloe** (`CFBundleDisplayName`); the bundle id / scheme stay `suppr` until TM clearance.

- **Icon source:** `assets/gen/wordmark-final/icon-fraunces-1024.png` -> flattened opaque (iOS needs
  no alpha) -> `apps/mobile/assets/images/icon.png` -> `ios/.../AppIcon.appiconset`.
- **Splash:** plum "sloe" wordmark on cream **Oat `#FBF8F3`** (light) / white "sloe" on plum
  **`#3B2A4D`** (dark), from `sloe-fraunces-base.svg` / `...base-white.svg`. The launch screen
  (`AppLaunchScreen.tsx`) uses the same cream/plum field so the native->JS handoff is seamless.
- **Regenerate:** `node scripts/render-sloe-brand-png.mjs && npm run sync-ios-brand --prefix apps/mobile`
  (or `npm run build:brand-icons`), then rebuild the dev client. The iOS project is bare — do **not**
  `expo prebuild`. See `docs/decisions/2026-06-04-ios-app-icon-splash-sloe.md`.

---

## 5. Voice & tone

**Personality:** a calm, warm coach who has all the time in the world for you. Never breathless,
never a drill sergeant, never a cheerleader. The voice is *permission* — it assumes you love food
and have goals, and it helps the two live together. It is adult, plain-English, British, and it
trusts your intelligence.

The "slow" is in the *cadence* as much as the words: short, unhurried sentences. No exclamation-mark
confetti. Encouragement is grounded in real data (Fitbit-credible), never empty hype.

**Permission language — the core move:**
- Reframe restriction -> permission. "There's room for this." beats "You have 320 kcal left."
- Reframe failure -> information. "You went over yesterday — today's a fresh plate." not "You blew it."
- Reframe the grind -> the pace. "No rush. You're trending right." not "3-day streak! Keep it up!"

**Example microcopy:**

| Moment | Sloe says | Never |
|---|---|---|
| Today, room to spare | "Room for dinner — about 620 kcal to play with." | "620 calories remaining!" |
| Logged a treat | "Logged. It fits." | "Cheat meal logged" |
| Over budget | "A bit over today. Tomorrow's a fresh plate." | "You're over your goal!" |
| Empty Today | "Nothing logged yet. No rush." | "Let's get started — log your first meal!" |
| Best day | "Your closest day this week. Nicely judged." | "You crushed it!" |
| Recipe imported | "Saved. Estimated nutrition shown — we'll keep it honest." | "AI-powered analysis complete!" |
| Onboarding open | "Let's set the pace that suits you." | "Start your transformation today!" |
| Paywall | "Everything in Sloe, unhurried." | "Unlock Premium NOW!" |

**Carries over from the existing voice (non-negotiable):** nutrition is always *estimated*; no
health claims; numbers feel engineered (`tabular-nums`); past = past tense, present = present;
no diet-culture shaming, no toxic gamification. Sloe *softens the warmth dial* on the existing
calm voice — it does not abandon the calm.

### 5b. Voice-swipe file — marketing / landing / social (added 2026-06-07)

Lines collected from lifestyle creators whose tone rhymes with the Sloe positioning. These are
**swipe, not copy** — they set the register for social captions, landing hero lines, and onboarding
warmth. **Never used verbatim; never in in-app chrome.**

**Route:** social posts, onboarding welcome/permission screens, landing page hero/sub-hero, email
subject lines, App Store description body. **Not** product UI, not microcopy, not push
notifications.

| Line | Throughline | Source |
|---|---|---|
| "things in my home I'll never regret investing in" | Permanence, patience, no-regret slow choices | @jadewilson.f |
| "a slow Sunday morning" | Unhurried sanctuary — almost verbatim the brand | @jadewilson.f |
| "the older I get the more I romanticize staying home" | Home as refuge, maturity, calm > novelty | @jadewilson.f |
| "making my home feel softer one little detail at a time" | Incremental care, softness, detail | @jadewilson.f |
| "created the home I kept saving on Pinterest" | Aspiration realised, making the dream tangible | @jadewilson.f |

**The throughline across all five:** *home as unhurried sanctuary, softness, permanence, slowness.*
This is the Sloe positioning rendered in a lifestyle-creator register — the "slow" pun made felt in
someone else's words. Mine the register for tone, cadence, and warmth; the specific lines are
directional, not for reproduction.

---

## 6. Taglines — the food-and-goals bridge

The name is abstract on purpose; the tagline must state the bridge *warmly* (recipe-love + goals,
permission not restriction). Five candidates, ranked:

| Rank | Tagline | Why |
|---|---|---|
| **1** | **Cook what you love. Hit your goals anyway.** | The clearest statement of the exact bridge, in two unhurried beats. "anyway" carries the permission — your goals don't cost you the food. App-Store-subtitle ready. **Recommended.** |
| **2** | **Eat what you love, on plan.** | Tighter, punchier, "on plan" lands the goals side without a diet word; reads beautifully under the lowercase mark. Strong #2 / alt for tight spaces. |
| **3** | **Food you love, kept in balance.** | Warmest and most Lifesum; "kept in balance" is gentle, never restrictive. Slightly softer on the *goals* specificity. |
| **4** | **The calm way to eat well.** | Leans hardest into the "slow" pun and the calm differentiator; loses some of the explicit food-love. Great as a *brand-line* (about-page, ad headline) rather than the App Store subtitle. |
| **5** | **Love food. Mind your goals. No rush.** | Three-beat, most explicitly on-positioning and most "slow", but the longest — better as an onboarding/marketing line than a subtitle. |

**Recommendation:** lead with **#1 "Cook what you love. Hit your goals anyway."** as the App Store
subtitle and primary lockup tagline; hold **#4 "The calm way to eat well."** as the brand-line that
quietly cashes the *slow* pun. Never put a tagline in app chrome — taglines are landing / App Store
/ onboarding only.

---

## 7. What does NOT change

- The calorie-ring colour mapping (empty=gradient, under=Sage green, over=Destructive red).
- "Estimated, never absolute" trust posture; no health claims.
- The 4-tab IA (Today / Plan / Recipes / Progress), Free + Pro, single Log sheet.
- The serif-display + sans-body type architecture (Sloe re-skins the palette, keeps the bones).
- The painterly-but-credible illustration direction (two-tier: stylised-photoreal ingredients,
  hyperreal editorial dishes) — now lit against an Oat/plum ground instead of pure white.

---

## 8. Verdict on whether Sloe carries the warm-coaching bar

See the render at `docs/brand/sloe/sloe-render.html` and the one-paragraph verdict returned with it.
The short version: the jewel indigo-plum + frosted bloom is the most *distinctive and premium*
palette of any candidate screened, and pairs naturally with Fraunces + Oat for a warm-editorial,
slightly-British, calm-premium feel that no competitor in the lane owns. The "slow" pun gives the
brand a free, memorable story and the calm differentiator in the name itself. The one watch-item is
spelling-on-first-read (people may type "slow"), mitigated by `eatsloe.com` as the front door and
the berry mark always anchoring the wordmark. Pending legal clearance, Sloe clears the warm-coaching
bar — and clears it more distinctively than the herb shortlist it replaces.
