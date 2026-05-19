# Suppr design direction v1 — comprehensive synthesised plan

Date: 2026-05-19 (amended same day with Phase 0.7 ledger)
Status: **Awaiting Grace approval. Nothing implemented past Phase 0.5 + 0.7 token shifts.**
Approval artefact: `docs/decisions/2026-05-19-suppr-design-direction-v1/index.html`
Owner: Grace
Supersedes (synthesises, not replaces): the Tare Phase 0 + 0.5 foundation
docs at `docs/decisions/2026-05-18-tare-aesthetic-foundation.md` — those
remain accurate for what's shipped behind the flag; this doc is the
forward plan for what comes next.

---

## What this doc is

A single comprehensive plan that takes every piece of evidence,
reference, screenshot, and prior decision in the 2026-05-18 → 2026-05-19
working session and merges them into ONE consistent design direction —
plus the phased implementation plan to ship it, plus the open
decisions Grace still owns.

The previous turn-by-turn pattern (each new reference replacing the
last) is explicitly rejected here. The four references we landed on
each contribute a specific lesson; together they describe one
coherent app.

## Phase 0.8 ledger (2026-05-19, macro softening) — most recent amendment

Grace's correction on Phase 0.7: *"the macro ring colours could
take from noom which is maybe a little softer but still bright -
i just dont want them to be too dulled/ earthy."*

The Phase 0.7 macros reverted to Suppr's current functional palette
(`#4c6ce0` / `#d68224` / `#c4647d` / `#4a8a52`). Those read as
iOS-default-data-viz sharp. Phase 0.8 pulls each one ~12-15% lower
saturation while keeping the same hue family — each macro is still
unambiguously its colour (blue / orange / pink / green) but with
a more considered tonality.

| Macro | Phase 0.7 (pure data) | Phase 0.8 (softened) — shipping |
|---|---|---|
| Protein | `#4c6ce0` cobalt-electric | **`#5b6fb8` cobalt-denim** |
| Carbs | `#d68224` highlighter-orange | **`#c87935` warm amber** |
| Fat | `#c4647d` hot pink | **`#c4708a` soft rose** |
| Fiber | `#4a8a52` data-green | **`#5d8a5c` sage-leaning green** |
| Calories (ring) | `#3a8a4a` | **`#4d8a5c`** matches fiber tonality |

Dark-mode equivalents (lifted for contrast on warm-black surface):
`#8696db / #d69458 / #d495a8 / #86a888 / #80a890`.

Same rotations applied to meal-slot tints, chart palette, source
dots, confidence-high. Calorie ring under-budget colour is the
softened green; over-budget stays `--destructive`; empty stays
faint accent.

No architecture changes. Token values shift. The phase plan,
feature flag, primitives, and approval flow are unchanged.

## Phase 0.7 ledger (2026-05-19, print-bundle alignment) — read this first

Grace shared a new `Tare App-print.html` Claude Design bundle dated
2026-05-19 with the framing *"this aesthetic is closer."* The
bundle's settled `PRINT_TWEAKS` at `print-app.jsx:3-13` reveals
several adjustments to the v1 token defaults — these are
**refinements** (token-value shifts), NOT a teardown (the
architecture, phased plan, and approval flow are unchanged).

What shifted:

| Token / rule | v1 (locked Phase 0.5) | Phase 0.7 (print-bundle settled) |
|---|---|---|
| Default serif | Spectral 600 | **Newsreader 600** |
| Screen title family | Inter bold (with Spectral on 3 moments) | **Newsreader 600 as the title family always; sans below it** |
| Default accent | Terracotta `#a3522a` light / `#d4824a` dark | **INK `#14141a` light / cream-on-dark `#e8e2d4` dark** |
| Accent role | The accent everywhere | **Ink default; terracotta + 9 others available as opt-in "warmth packs"** |
| Page bg light | `#f6f3ee` | `#f1ebdf` (warmer cream) |
| Macros | Earth tones (sage / wheat / terra / forest) | **Functional data palette (blue / orange / pink / green) — same as Suppr today** |
| Phase V2 (macro repalette) | 25 files, 3 days | **CANCELLED — current Suppr macros are the target** |
| Greeting line | Dropped | **Kept (sans-medium 13px, NOT italic)** |
| Overline above screen title | Dropped (date-twice concern) | **Kept (carries date + day-of-week; h1 names the relative day — different info)** |
| Calorie ring under-budget colour | Terracotta accent | **`mFiber` green `#4a8a52` — functional under-budget signal** |
| `.tare-highlight` wash | Sage at 18% alpha | **Solid sage `#c8d4b8` light / `#3a4e2f` dark — reads as ink-on-paper, not UI tint** |

Why the shift (Grace's "closer" framing):
- **Ink on warm cream is more premium + more genuinely gender-neutral**
  than terracotta on cream. Terracotta has a warmth that drifts toward
  "wellness app marketing"; ink monochrome IS Soho House / Equinox /
  Third Space's actual register. Terracotta and 8 others remain
  available as opt-in warmth packs (future settings preset).
- **Newsreader on screen titles is warmer + more humanist** than
  Spectral at the same weight. Spectral 600 was over-corrected
  toward "considered"; Newsreader 600 reads structural-authoritative
  without going magazine-editorial.
- **Functional data macros convey macro identity better** than earth
  tones. Grace already corrected this in brand-bundle chat 2 (*"that's
  a little soulless — the macros can have colours."*) — I missed it
  in the v1 synthesis. The print bundle confirms.
- **Greeting + overline aren't editorial chrome** — they're info
  density done warmly. Apple's own apps use the time-of-day greeting;
  the overline carries the numeric date while the h1 names the
  relative day (Yesterday / Today / Yesterday) — different info, no
  duplication.

What's UNCHANGED from v1:
- Two-track architecture (visual + interaction)
- Phase 0 + 0.5 + 0.7 foundation layer (just-amended tokens)
- TareHighlight + TareCutoutCard primitives
- The six approved-accent places rule (ink replaces terracotta as
  the colour used IN those six places)
- Cook Mode as the Apple-Design-Award target (interaction track)
- Photography commission as a parallel workstream
- The phased rollout via feature flag + PostHog ramp

The phase plan further down in this doc is the canonical sequence.
Phase 0.7 amendments are reflected inline against each phase below.

---

## The five sources synthesised

### 1. The brutal screenshot review (TestFlight captures + full-surface sweep)

Verified problems in the current product:

| # | Pattern | Where it appears | Fix track |
|---|---|---|---|
| 1 | Persistent green "You're all set!" toast on every authed screen | Today / Plan / Recipes / Progress / Settings / Library / Shopping | Visual / Discipline |
| 2 | Dev `N 2 Issues` / `N 1 Issue` badge in TestFlight captures | All authed mobile-web | Infra |
| 3 | Empty-state cards taking 25%+ of screen | Today empty, Plan empty, Library empty, Fasting | Discipline / Copy |
| 4 | Three rows of identical pill shapes on Recipes | Library + Discover | Information architecture |
| 5 | ALL-CAPS overlines on every section | Every authed surface | Visual / Discipline |
| 6 | Blue as wallpaper (8-12 instances per screen) | Every authed surface | Visual / Accent discipline |
| 7 | Bordered-card-on-grey container | Plan, Library, Progress, Settings, Fasting | Visual / Surface |
| 8 | Inconsistent macro icons (steak / wheat / blood / leaf) | Today macro tiles | Visual / Iconography |
| 9 | Header date-twice (eyebrow + h1) | Today header | Layout discipline ✓ (fixed in PR #307) |
| 10 | Empty progress bar dot residue at 0% | Today macro tiles | Visual ✓ (fixed in PR #307) |
| 11 | Day-strip flashing on chevron tap | Today | Performance ✓ (fixed in PR #307) |
| 12 | Bottom toast clipped under FAB | Today | Layout ✓ (fixed in PR #307) |

Of the twelve, four are already fixed in PR #307. Eight remain.

### 2. The Claude Design Tare bundle (8 iterations across two chats)

What survived Grace's eight rounds of iteration with the design tool:

- **True warm-cream daily-use surfaces** (light) + **warm-black daily-use surfaces** (dark) — NOT pure white / pure black, those are clinical
- **Inter for all functional UI** — primary sans
- **Spectral upright for editorial moments** — NOT italic-everywhere (italic reads feminine at scale per Grace's correction in round 7)
- **Two-font discipline maximum** — Spectral + Inter, full stop
- **One terracotta accent** in six specific places only (Tare round 6)
- **Earth-toned macros** — sage / wheat / terra / forest — never as chrome
- **Heavy weight, not heavy editorial** — weight does the hierarchy
- **Highlight-wash primitive** — italic word + sage wash, one per surface
- **Cutout-card primitive** — quarter-circle bite for marketing/paywall ONLY
- **No greeting line, no masthead "No. 142", no page signature** — these read magazine-editorial which Grace dropped in round 7

What Grace explicitly rejected from the design tool's earlier rounds:

- The Tare name itself (rejected — see `project_rebrand_checklist.md`)
- Newsreader serif (replaced with Spectral)
- Italic-everywhere editorial register
- Magazine-masthead chrome
- Pure-white / pure-black surfaces (revised to cream / warm-black after Noom comparative read)

### 3. The reference benchmark research

Each reference contributes a specific lesson. None is a wholesale model.

**Gentler Streak / Gentler Stories** — *closest validated reference*
- 2022 Apple Watch App of the Year + 2024 Apple Design Award (Social Impact) + 2026 ADA finalist
- Exact same positioning as Suppr: anti-fitness-bro, gender-neutral, mass-market-priced, calm
- Apple-commended philosophy: "Statistics are just numbers. Without knowing how to interpret them, they are meaningless. We wanted to change that and focus on the humanity."
- **Lessons to lift**: anti-bro voice, interpretive copy over raw numbers, custom illustration character (Yorhart-equivalent) carries emotional warmth, native iOS patterns respected, big bold tabular numbers for key metrics
- **Lessons NOT to lift**: their colour palette (soft blue/green) is theirs, not ours; we keep terracotta accent

**Crouton** — *interaction-design proof*
- 2024 Apple Design Award (Interaction — NOT Visuals)
- Visually unremarkable — native iOS HIG executed competently. Won on interaction quality.
- Apple's exact citation: "With its effortless series of interactions, Crouton lets users keep their focus on the counter rather than the screen."
- **Lessons to lift**: Cook Mode is where interaction excellence wins. Wink-to-navigate via TrueDepth. URL-paste auto-import. Multiple parallel timers with Live Activity + Dynamic Island. iPad two-panel kitchen-counter layout.
- **Lessons NOT to lift**: their visual register is a competent floor, not a ceiling — we aim higher on visuals while matching their interaction bar

**Kitchen Stories** — *recipe-native editorial discipline*
- Apple Design Award winner (2017)
- Recipe-first photography-led editorial restraint
- **Lessons to lift**: photography commission is non-negotiable for premium recipe-app feel. Sans typography at heavy weights + generous whitespace is sufficient — no editorial serif required to feel "considered". Restraint in chrome.
- **Lessons NOT to lift**: their pure-sans approach undersells our editorial moments — we keep Spectral for ~3 specific moments per screen

**Mela** — *2025 ADA finalist (recipe manager)*
- Refined minimalist typography, dark mode standout, Reeder-DNA
- **Lessons to lift**: bold + italic for in-recipe emphasis (quantities bold, varieties italic), parsed-clean text presentation, dark mode as first-class not afterthought

**Noom** — *softness reference only (NOT product reference)*
- Heavy serif headlines + peach surfaces + curved cutouts + real photography for ACQUISITION SURFACES
- Their product itself (gamified hooks, paywall pressure, streak guilt) is explicitly rejected
- **Lessons to lift**: peach surface as opt-in for paywall/onboarding ONLY (never daily-use). Heavy serif weight (600+) when serif is used. Curved cutout shape language. Italic + colour-wash on ONE word per headline.
- **Lessons NOT to lift**: their product behaviour, their voice, their colour-pop-everywhere in data viz

**Cal AI** — *reference rejected*
- Soft but "looks like AI spat it out — not considered" (Grace's read)
- Default Tailwind + Inter + generic wellness palette
- We aim higher on craft

**Headspace** — *reference rejected*
- Too loud — orange accent + bold round-character illustrations
- Proves the £10/mo mass-market positioning is viable, but not the visual register

**MFP / Cronometer / Lose It / MacroFactor** — *anti-references*
- Data-grid blue/green dashboards from 2018
- What we're explicitly NOT
- MacroFactor's math model is strong; their visual is beige

### 4. The repo memory + locked decisions

Constraints we must honour:

- Suppr name stays. No Tare wordmark, no app-icon rebrand, no favicon swap. The aesthetic ports without the brand mark.
- Calorie ring three-state colour mapping (memory `feedback_calorie_ring_colour_mapping.md`): empty / under / over each have semantic colour. The Tare design's single-accent ring loses the over-budget alarm signal. We keep the 3-state with the accent replacing under-target.
- Web + mobile parity is non-negotiable. Every aesthetic change ships both platforms or neither.
- £7.99/mo price point — mass-market positioning. Equinox/Soho House proves the *register* exists; Gentler Streak proves it works at our *price*.
- Defended choices from `feedback_conformity_trap.md`: multi-ring calorie+macros (when expanded), "what to eat next" 3% fit chip, calm voice, paywall trust chips, sparse weight chart. These stay BETTER THAN BAR.

### 5. The current Suppr infrastructure (what we already have)

- Tare Phase 0 + 0.5 tokens shipped behind `tare-aesthetic-v1` feature flag (`src/styles/tare-aesthetic.css`)
- Spectral loaded via `next/font/google` in `app/layout.tsx`
- `<TareHighlight>` + `<TareCutoutCard>` primitives in `src/app/components/ui/`
- `apps/mobile/lib/cookHandsfree.ts` — v1 shell, voice listener v2 deferred to a queued decision
- `src/app/components/CookMode.tsx` (web, 1076 lines)
- `apps/mobile/app/cook.tsx` + `cookSession.ts`
- Playwright visual-regression baselines, Lost Pixel + Chromatic in CI
- Feature-flag system via PostHog
- 12 brutal-review patterns documented (8 unfixed)

---

## The synthesis — Suppr design direction v1

### One-paragraph statement of intent

Suppr is a calm, considered, gender-neutral recipe and nutrition
platform. Visually it stands apart from MFP / Cronometer / Cal AI by
holding restraint where they pile on chrome; interactionally it
stands apart from MacroFactor / Lose It by killing friction at the
moments friction matters — cook, log, import. The product feels
considered the way Gentler Streak does (Apple-Design-Award-winning
humanity, native iOS patterns respected, big bold numbers) and
interacts the way Crouton does (counter, not screen). The brand voice
is warm but not editorial — closer to a well-made object than to a
magazine.

### The five principles

**1. Restraint over flourish.** Every visible element earns its
place. ALL-CAPS overlines, gradient placeholders, decorative icons,
persistent celebratory toasts — gone unless they carry information
no other element does. The discipline applies to copy, type, colour,
and shape equally.

**2. Weight does the hierarchy.** Family changes (serif vs sans) are
reserved for ~3 specific moments per surface. Within a card, ONE
family. Inter at varied weights (400 → 700) carries 95% of the type
work. Spectral 600 carries hero numbers and editorial headlines only.

**3. One accent. Six places. No exceptions.** Terracotta
(`#a3522a` light / `#d4824a` dark) appears on: streak count, ring
progress arc, FAB, "Log meal" primary CTA, today marker, active
tab-bar item label. Everywhere else — secondary CTAs, filter pills,
badges, "View all" links, sub-tabs, paywall trust chips — uses
greyscale or weight contrast.

**4. Interpretive copy beats raw numbers.** Gentler Streak's
Apple-commended move. "REMAINING 380" → "380 kcal left for
dinner". The calorie ring centre, macro tile captions, Progress
headlines, weekly digest all switch to sentence-form interpretation.

**5. Cook Mode is where we win an Apple Design Award.** The
interaction track is the differentiation lever. Visual polish makes
screenshots better; Cook Mode excellence makes the app sticky and
nominee-worthy. Both ship — but Cook Mode is no longer "deferred to
v2".

### The token system (locked)

**Surfaces** (the body.tare-on layer, now expanded)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#f6f3ee` | `#0e0d0b` | Page bg — warm cream / warm black |
| `--card` | `#ffffff` | `#1a1815` | Card surfaces — lift cleanly off page |
| `--secondary` | `#f0ede6` | `#14130f` | Subtle inset zones |
| `--muted` | `#ebe7df` | `#1a1815` | Hover / muted bg |
| `--surface-peach` | `#f6e4d6` | `#1d1410` | **Acquisition only** — paywall hero / onboarding intro / weekly digest cover. Never page-bg for daily use. |

**Rules / dividers**

| Token | Light | Dark |
|---|---|---|
| `--border` | `#e6e1d6` | `#2a2620` |
| `--border-strong` | rgba(20,14,8,0.08) | rgba(246,243,238,0.08) |

**Text ramp (true greyscale — no cool/warm cast)**

| Token | Light | Dark |
|---|---|---|
| `--foreground` (fg) | `#0a0a0a` | `#ffffff` |
| `--muted-foreground` (fgMute) | `#5a5a5a` | `#a8a8a8` |
| `--fg-dim` (fgDim) | `#8a8a8a` | `#6e6e6e` |
| `--fg-faint` (fgFaint) | `#b8b8b8` | `#4a4a4a` |

**Accent — terracotta, ONE colour, SIX places**

| Token | Light | Dark |
|---|---|---|
| `--primary` (accent) | `#a3522a` | `#d4824a` |
| `--primary-foreground` (accentInk) | `#ffffff` | `#15090a` |
| `--primary-strong` | `#8a4524` | `#c87544` |

The six approved places (and ONLY these):
1. Streak count tally on Today header
2. Calorie-ring progress arc (under-budget state)
3. FAB ("+") raised tab-bar button
4. "Log meal" primary CTA across surfaces
5. Today marker (highlighted day pill in day strip + `TODAY` overline colour)
6. Active tab-bar item label (mobile) + sidebar 2px accent left bar (desktop)

**Macros — earth tones, functional only**

| Macro | Light | Dark | Mnemonic |
|---|---|---|---|
| Protein | `#6f8056` | `#8a9a6b` | Sage |
| Carbs | `#a87f3e` | `#c8a050` | Wheat |
| Fat | `#a05238` | `#b9694a` | Terra |
| Fiber | `#3a5236` | `#4d6a4a` | Forest (deep) |
| Water | `#06b6d4` | `#06b6d4` | Cyan (kept — not earth-tone candidate) |

Note on fiber-vs-protein green overlap: fibre is deeper olive
(`#3a5236`) versus protein sage (`#6f8056`); position in the macro
stack carries identity beyond colour alone. Reviewed and accepted.

**Typography — two families, weight-driven**

| Class / use | Family | Weight | Size | Notes |
|---|---|---|---|---|
| Body / data / labels | Inter | 400-500 | 12-16px | Default everywhere |
| Section headers | Inter | 600 | 16-20px | Card titles, list section titles |
| Screen titles | Inter | 700 | 28-34px | "Today", "Meal plan", "Library" — heavy Inter, NOT Spectral |
| Hero numbers (ring centre + big-stat) | Spectral | 600 | 32-44px | Editorial moment #1 — tabular figures |
| Weekly digest cover headline | Spectral | 600 | 24px | Editorial moment #2 — used on Progress |
| Paywall hero headline | Spectral | 600 | 28-32px | Editorial moment #3 — peach surface only |
| Highlighted word (italic + wash) | Spectral italic | 600 | inherit | Via `<TareHighlight>` — one per headline max |
| Quantities in recipe steps | Inter | 700 | inherit | Per Mela's "bold for quantities" convention |
| Varieties / cuisine in recipe meta | Inter | 500 italic | inherit | Per Mela's "italic for varieties" |

**Spectral is restricted to ~3 surface-level moments. Default screen
titles are heavy Inter, not Spectral.** This is the corrected
position vs. Phase 0.5 (which made Spectral 600 the default for ALL
screen titles).

### Iconography

- Single icon set: **Lucide React** (web + mobile) — already in use, matches Tare canon
- No emoji icons. No mixed sets.
- Iconography on macro tiles is **dropped entirely** (per Gentler Streak's "trust the label" discipline). Macro labels are TYPE only.
- Iconography on meal slots is **dropped** (per Soho House / Third Space "never decorate a label").
- Iconography retained where it carries information no label can: nav tab icons, scan/voice/photo affordances on the log sheet, dropdown chevrons.

### Empty states

Cards are for DATA. Empty states are SENTENCES. One line + one action.

- "No meals logged today" — replaces the entire empty-state card row
- "Your library is empty. Import your first recipe →" — replaces the gradient-grid empty state on Library
- "Nothing logged for Breakfast yet" — replaces the dimmed "+ Tap to add" row
- "Your meal plan lives on iPhone. Open the app to generate this week's." — already this register, keep

### Photography + illustration (the warmth carrier)

Two parallel commissions, three-tier strategy each:

**Recipe photography** (£1,500 budget):
- 25 commissioned hero shots — top Library + Discover recipes, warm sepia editorial styling (ceramic + linen surfaces, top-down composition)
- 75 licensed shots from Stocksy / Death to Stock with consistent warm-tone curation
- Remaining long-tail via AI generation (Midjourney v6 / Flux Pro) with consistent prompt scaffolding for visual coherence

**Illustration / character system** (£500–1,000 budget — Gentler Streak Yorhart equivalent):
- A small recurring abstract character or geometric shape that reacts to the user's logging state
- Use cases: Today screen empty state (the character "waits"), milestone moments (the character "celebrates" subtly), error states ("the character gently shrugs")
- Pulls the emotional load off photography for surfaces where photos don't fit (Today, Plan, Progress, Settings)
- Owner: Grace + illustrator brief

### The interaction track (Crouton bar)

Three workstreams, each independently shippable:

**Cook Mode excellence** (un-defer the v2 voice listener + add wink-nav):
- Apple Speech Recognition on-device listener — wired to the existing `cookHandsfree.ts` command set
- Wink-to-navigate via TrueDepth camera — right wink = next step, left wink = back. Parallel input to voice.
- Multiple parallel timers per recipe with Lock Screen Live Activity + Dynamic Island
- iPad two-panel layout: ingredients pane left, instructions pane right, designed for kitchen-counter Magic Keyboard placement
- Apple Watch glance for step + active timer

**Import friction kill** (URL paste auto-detect):
- App foreground checks clipboard for known recipe-domain URLs and offers one-tap import (matches Crouton)
- Photo OCR for handwritten / cookbook recipes — already partially shipped, polish + expand
- Share-sheet integration improved — make Suppr a primary share target for Safari + Instagram

**Log friction kill**:
- Long-press meal → portion adjust (verify, polish)
- Swipe-log meal from suggestion row → one-tap
- Apple Watch complication: "Calories left today"
- Siri shortcut: "Log my usual lunch"

---

## The phased implementation plan

The plan has TWO tracks (visual + interaction) running in parallel
after Phase 1. Each phase is independently shippable, flag-gated, and
ramps via PostHog before flag removal.

### Visual track

| Phase | Scope | Files touched (est.) | Risk |
|---|---|---|---|
| **0** ✓ | Token foundation + Spectral font load + feature flag gate | 4 | Done |
| **0.5** ✓ | Cream surface revert + heavy-serif primitives + cutout/highlight components | 4 | Done |
| **0.7** ✓ | **Print-bundle alignment — ink accent default + Newsreader serif default + warmer cream + functional macros revert + greeting/overline restored** | 3 | Token-only |
| **0.8** ✓ | **Macro softening — keep blue/orange/pink/green identity, ~12-15% saturation drop (denim/amber/rose/sage)** | 2 | Token-only |
| **0.9** | Future amendments after Grace's Phase 0.8 review | TBD | Token tweaks only |
| **V1** | **Class-walk every `--primary` blue → demote to GREYSCALE except in the six approved places (ink is the accent)** | ~120 | High but mechanical |
| **V2** | ~~Macro repalette to earth tones~~ → **CANCELLED — Phase 0.7 reverted to functional data macros. Now only: calorie-ring three-state polish + meal-slot tints align to macro identity** | ~8 | Low |
| **V3** | Editorial chrome — Newsreader screen titles + greeting line + overline as the canonical Today/Plan/Library/Progress header pattern | ~15 | Low |
| **V4** | Interpretive copy pass — "REMAINING 380" → "380 kcal left for dinner" + macro captions + Progress headlines | ~20 | Low |
| **V5** | Empty states → sentences (drop cards / glyphs / multi-row chrome) | ~25 | Medium — visible UX change |
| **V6** | ALL-CAPS overline class-walk — keep where they carry info (date, week, section), drop where they say nothing | ~25 | Low — narrower scope than v1 |
| **V7** | Discipline kills — persistent green toast suppression + dev-chrome lock-out + bordered-card-on-grey → hairline rule patterns | ~10 | Medium |
| **V8** | Iconography pass — keep meal-slot tint icons (they carry macro identity per print bundle), drop redundant decorative glyphs only | ~10 | Low |
| **V9** | Photography integration — commissioned + licensed + AI long-tail wired into Recipe Card / Library / Discover. Gradient placeholders removed. | ~10 | High — depends on photography commission landing |
| **V10** | Illustration / character system integration on Today empty state + milestones | ~8 | Medium — depends on illustration commission |
| **V11** | Optional warmth-pack accent presets — terracotta, bronze, sage, etc. as user-selectable themes in Settings | ~6 | Low — additive |

### Interaction track

| Phase | Scope | Risk |
|---|---|---|
| **I1** | Un-defer Cook Mode voice listener v2 — Apple Speech Recognition on-device, wired to canonical 5-command set | High — touches a queued v2 decision |
| **I2** | Wink-to-navigate via TrueDepth — parallel input to voice for kitchen noise | Medium — TrueDepth API integration |
| **I3** | Multiple parallel timers with Lock Screen Live Activity + Dynamic Island | Medium — Live Activity framework |
| **I4** | iPad two-panel Cook layout | Low — layout work |
| **I5** | URL paste auto-detect on app foreground (recipe-domain allowlist) | Low |
| **I6** | Apple Watch complication — "calories left today" + step-advance from wrist during Cook | Medium |
| **I7** | Siri Shortcut — "Log my usual lunch" + voice import | Low |

### Suggested phase ordering

Pre-launch (next 4-6 weeks):
- V0.6 (token amendments) — 1 day
- V1 (accent class-walk) — 3-5 days
- V7 (persistent toast + dev chrome + bordered-card kills) — 2 days
- V5 (empty states → sentences) — 2 days
- V6 (overlines class-walk) — 1 day
- V4 (interpretive copy) — 2 days
- Illustration commission START — async (Grace)

Post-launch (week of 2026-07-08+):
- V2 (calorie ring three-state + macro repalette) — 3 days
- V3 (editorial Spectral moments) — 1 day
- V8 (iconography pass) — 1 day
- I1 (voice listener un-defer) — 5 days
- I3 (Live Activity timers) — 3 days
- V9 (photography integration) — depends on commission landing
- V10 (illustration character integration) — depends on commission

Later:
- I2 (TrueDepth wink-nav) — 3 days
- I4 (iPad two-panel) — 2 days
- I5 (URL paste auto-detect) — 1 day
- I6 (Apple Watch) — separate workstream
- I7 (Siri Shortcut) — 2 days

### Ramp + flag removal

For each phase:
- Ship behind `tare-aesthetic-v1` (visual track) or `cook-handsfree-v2` etc. (interaction track)
- Internal QA → 10% beta → 25% → 50% → 100% over 5-7 days
- Two weeks at 100% with no regressions → flag deletion follow-up PR

---

## Open decisions Grace owns

These need answers before V1 starts:

1. **Approve the synthesised direction** as described above (the five principles + token system + phased plan). Sign-off via the interactive HTML.

2. **Photography commission** — confirm the £1,500 three-tier strategy. Brief due before V9 starts.

3. **Illustration / character commission** — confirm £500-1,000 budget. Brief due before V10 starts. Decision on style: abstract geometric (a "bowl-ish" shape that reacts) vs. character-with-personality (Yorhart-style).

4. **Calorie ring colour mapping** — confirm: empty = faint hairline accent (drops the indigo→pink gradient memory), under = solid terracotta accent (drops the success-green memory), over = destructive red (keeps the alarm). This OVERRIDES `feedback_calorie_ring_colour_mapping.md` — update the memory.

5. **Persistent green toast** — confirm it auto-dismisses on first scroll OR never renders past the welcome session. Either works; need the rule.

6. **Day-of-year reference / greeting / signature** — confirm all three drop (no "No. 142", no "Good evening Grace", no "tare · vol. i · spring"). This is the consistent position; flagging explicitly to lock.

7. **iOS 26 Liquid Glass** — confirm we adopt Apple's iOS 26 design language layer (Gentler Streak shipped this in their iOS 26 update). Free polish, requires iOS 26 + Xcode 16+ targets.

8. **Pre-launch phase scope** — confirm the suggested phase ordering. If launch slips, this is fine. If launch holds, do we accept V0.6 + V1 + V7 + V5 + V6 + V4 as the pre-launch must-haves and defer V9 + V10 + interaction track to post-launch?

---

## Verification + safety net

- Every phase ships behind a feature flag
- Lost Pixel + Chromatic baselines updated only when intentional
- Contrast audit (`tests/e2e/verify/contrast-audit.spec.ts`) runs after V1 + V2
- Web + mobile parity check after every shipped phase
- TestFlight beta cohort gets the flag on at 10% first; metrics watched for paywall conversion + retention before ramping

---

## What this doc explicitly does NOT do

- **Does not** rebrand Suppr to Tare. Name stays Suppr until the next finalist name is picked.
- **Does not** ship a magazine-editorial aesthetic. Heavy serif on 3 moments per surface; greeting / masthead / signature all dropped.
- **Does not** copy any reference whole. Each reference contributes one specific lesson; together they describe one coherent Suppr.
- **Does not** treat photography commission as a token problem. It's a content + spend decision that runs parallel.
- **Does not** authorise any implementation past Phase 0.5 until Grace signs off via the interactive HTML at
  `docs/decisions/2026-05-19-suppr-design-direction-v1/index.html`.
- **Does not** cover the recipe-aggregator (Deglaze-style search) workstream — that's a parallel product/data decision documented separately at
  `docs/decisions/2026-05-19-recipe-aggregator-architecture.md`. The two plans reference each other (the V9 photography commission unlocks the aggregator's hero-recipe imagery) but neither blocks the other.

---

## Sources fully cited

The references this synthesis draws on:

- Tare brand exploration bundle (`/tmp/tare-brand/`)
- Tare App / logo bundle (`/tmp/tare-app/`)
- Round-6 `tare-interactive.jsx` (the canonical Tare token set)
- Round-8 chat transcript (the Noom-comparative-read corrections)
- Repo memory: `project_rebrand_checklist.md`, `feedback_calorie_ring_colour_mapping.md`, `feedback_conformity_trap.md`, `project_competitor_set_and_mfp_exodus.md`, `feedback_no_quick_temp_fixes.md`
- Apple Design Awards research: Crouton (2024 Interaction), Gentler Streak (2024 Social Impact), The Outsiders (2026 finalist), Mela (2025 finalist), Kitchen Stories (2017 winner)
- Apple Developer "Behind the Design: Gentler Streak" interview
- 2026-05-18 TestFlight screenshot brutal review
- PR #307 visual fixes already shipped
- Phase 0 + 0.5 decision doc (`docs/decisions/2026-05-18-tare-aesthetic-foundation.md`)
