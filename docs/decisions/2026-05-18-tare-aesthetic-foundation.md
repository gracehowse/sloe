# Tare aesthetic v1 — foundation (Phase 0 + 0.5)

Date: 2026-05-18
Status: Phase 0 + 0.5 shipped, Phase 1+ pending
Last amendment: 2026-05-18 Phase 0.5 (Noom comparative read)
Area: design system / visual elevation
Owner: Grace
Source bundles (mirrored locally during analysis):
- `/tmp/tare-brand/tare/project/Tare Brand Exploration.html`
- `/tmp/tare-app/tare-logo/project/Tare App.html`
- Final token set in `/tmp/tare-brand/tare/project/tare-interactive.jsx`
- Final Today layout in `/tmp/tare-brand/tare/project/tare-garden.jsx`

## Why

Two TestFlight screenshots (2026-05-18) made the cost of the current
visual language unignorable. The forensic sweep that followed identified
ten cross-cutting patterns making Suppr feel "2018 MyFitnessPal": a
persistent green toast on every screen, dev `N Issues` badge in prod
captures, ALL-CAPS overlines everywhere, bordered-card-on-grey
container, primary-blue-as-wallpaper, three-row-of-identical-pills on
Recipes, empty-state cards taking a quarter of the screen, etc. Per-
screen patches won't move the dial — the language itself is the
problem.

Grace had previously commissioned a brand exploration when the Tare
rebrand was on the table. The Tare name itself was rejected (memory:
`project_rebrand_checklist.md`), but the aesthetic system she landed
on across eight rounds of iteration is exactly the visual direction
Suppr needs:

- True black / true white surfaces, greyscale text ramp
- Inter for functional UI, Spectral upright (no italic) for editorial
  moments
- One warm accent (terracotta) in five-to-six specific places only
- Earth-toned macros (sage / wheat / terra / forest), never as chrome
- No fitness clichés (no flames, no streak guilt)

This decision adopts the **aesthetic** without the **wordmark**. Suppr
keeps its name; the Tare-branded SVGs, app icon, and favicon stay in
the design archive at `docs/brand/tare/` for reference only.

## What "Phase 0" includes

This phase is foundation-only. No surface render changes yet. The
tokens, font stack, and feature-flag wiring are in place; Phase 1
will flip the flag on dev and class-walk every `var(--primary)`
consumer.

### 0.1 New CSS token layer

`src/styles/tare-aesthetic.css` — imported after `theme.css` so the
`body.tare-on` selector overrides defaults atomically. Re-maps:

| Token group | Default Suppr value | Tare value (light → dark) |
|---|---|---|
| `--background` | `#f4f5f7` | `#ffffff` → `#000000` |
| `--card` | `#ffffff` | `#ffffff` → `#141414` |
| `--foreground` | `#111118` | `#0a0a0a` → `#ffffff` |
| `--muted-foreground` | `#56565f` | `#5a5a5a` → `#a8a8a8` |
| `--border` | `#e4e4ec` | `#eaeaea` → `#242424` |
| `--primary` | `#4c6ce0` (blue) | `#a3522a` → `#d4824a` (terracotta) |
| `--macro-protein` | `#4c6ce0` (blue) | `#6f8056` → `#8a9a6b` (sage) |
| `--macro-carbs` | `#ed6b2a` (orange) | `#a87f3e` → `#c8a050` (wheat) |
| `--macro-fat` | `#e04888` (magenta) | `#a05238` → `#b9694a` (terra) |
| `--chart-1..5` | data palette | earth-tone palette |
| `--source-*` | mixed | rebound to new palette |
| `--slot-*` | mixed | rebound to new palette |

Surfaces NOT remapped (deliberate carve-outs documented inline):
- Apple Sign-In button colours (HIG requirement)
- Hydration-stimulant tokens (water/caffeine/alcohol — functional
  indicators)
- `--over-budget` (amber, never red — calorie-ring memory)
- `--destructive` (legitimate alarm states)
- `--success` (kept for the "logged-and-under" celebration moment)
- Water (cyan stays — not an earth-tone candidate)

### 0.2 Font stack

`app/layout.tsx` now loads both **Inter** (already present) and
**Spectral** via `next/font/google`. Spectral pulls weights 400 / 500
/ 600 + italic. The body still defaults to Inter; the `.tare-on`
class swaps `--font-sans` to Inter via variable and exposes
`--font-serif` (Spectral) for the editorial moments.

Editorial utility classes shipped:
- `.tare-editorial` — Spectral upright, weight 400, tightened tracking.
  Use on greetings ("Good evening, Grace.") and section openers.
- `.tare-hero-number` — Spectral upright, weight 500, tabular figures.
  Use in the ring centre value ("380") and big-stat cards.
- `.tare-masthead-ref` — Spectral italic, weight 400. The ONE
  deliberate italic exception, used for "No. 142" magazine-masthead
  day-of-year reference.

**Two families maximum.** If you reach for Newsreader / Playfair /
Instrument Serif / anything else: stop and use Inter weight + tracking.

### 0.3 Feature flag

`tare-aesthetic-v1` (PostHog). Default **off**.

`app/tare-aesthetic-gate.tsx` lives directly under `<Providers>` in
the root layout. When the flag resolves true on a given session,
the gate adds `tare-on` to `<body>`. Every CSS-var consumer reads
the new tokens automatically; no downstream code change required.

**Why a body class, not a context provider:** every existing
component already reads tokens via `var(--name)`. A single class
flip remaps all of them in one GPU pass with no React re-render.
A context approach would require every consumer to opt in
individually, which is a Phase 5 amount of work.

## The accent discipline rule (enforced from Phase 1 onward)

The terracotta accent (`--primary` in the Tare layer) is used in
**exactly six places**. Everywhere else, primary blue is demoted to
greyscale / weight contrast / hairline rules.

1. **Streak count** — the day-N tally on Today's header
2. **Calorie-ring progress arc** — under-budget state (destructive
   red stays for over-budget; faint hairline accent for empty)
3. **FAB** — the raised "+" tab-bar button
4. **"Log meal" link** — primary CTA across surfaces
5. **Today marker** — the highlighted day pill in the day strip
   AND the date-eyebrow `TODAY` overline colour
6. **Active tab-bar item label** — the selected tab name + a 2px
   accent left bar on the desktop sidebar active item

Everywhere else — secondary CTAs, filter pills, badges, "View all"
links, sub-tab active states, paywall trust chips, 99+ count
indicators — go greyscale or use weight contrast for hierarchy.

This rule will be policed by code review during Phase 1 and a
dedicated audit spec (`tests/e2e/verify/accent-discipline-audit.spec.ts`)
in Phase 2.

## Critique — what I challenged

The bundle's older brand pack (`brand/tokens.css`) is **stale**. It
still carries cream + ink + Newsreader + data-blue macros. I rejected
it in favour of the round-6 `tare-interactive.jsx` token set, which
is what Grace actually approved.

Other open items I'm NOT shipping in Phase 0 without further
confirmation:

1. **Hero ring colour mapping.** The locked memory says
   empty=gradient / under=success-green / over=destructive-red. The
   Tare design uses accent for all three. My recommendation: keep
   destructive-red for over-budget (legitimate alarm), drop the
   gradient on empty in favour of a faint hairline accent, swap
   the under-budget green for terracotta accent. **Phase 2 work.**

2. **"No. 142" day-of-year reference on Today's daily header.**
   Magazine touch that reads as affectation when shown every day.
   I'd put it ONLY on the weekly recap card ("No. 19 · Week 19").
   Asking Grace before shipping daily.

3. **Light-mode macro contrast.** Sage `#6f8056` on white is 3.7:1
   — passes AA for fill (bar background) but borderline for any
   text use. Phase 2 audit will surface every consumer; we'll
   either tune the colour or restrict it to fill-only.

4. **Fiber's forest green overlaps with protein's sage.** Phase 2
   may need to retune fiber → oxblood or deep olive to keep the
   four macros visually distinct. Bar position carries identity
   too, so the overlap may be tolerable. Visual test required.

5. **Sub-tab pill active state.** The recently-shipped solid-fill
   Linear-pattern active state (P1-1) now reads in terracotta
   instead of blue. That's correct under the new accent — but
   sub-tab pills are NOT in the approved 6 places. Phase 1 task:
   demote sub-tab pills to greyscale active state (border + bg
   tint, no accent fill).

## What Phase 1+ will deliver

| Phase | Branch | Scope | Risk |
|---|---|---|---|
| **1** | `claude/tare-aesthetic-phase-1` | Class-walk every `--primary` / `bg-primary` / `text-primary` / `border-primary` consumer. Move to greyscale where not in the 6 approved places. Surface the exhaustive list at `docs/decisions/2026-05-18-accent-discipline.md`. | High — touches ~120 files |
| **2** | `claude/tare-aesthetic-phase-2` | Calorie ring three-state under the new palette. Macro repalette propagation through every chart, tile, ring. Contrast audit run + tune. | High — Today + Progress + Macro detail screens |
| **3** | `claude/tare-aesthetic-phase-3` | Editorial chrome: greeting on Today, Spectral hero numbers, "No. NN" weekly masthead, quiet streak pip (drop flame). | Medium — surface adds |
| **4** | `claude/tare-aesthetic-phase-4` | Sentence-style empty states, drop ALL-CAPS overlines except system-nav, **kill the persistent green toast** (independent of the brand but on the same kill list). | Medium — copy + render condition changes |
| **5** | `claude/tare-aesthetic-phase-5` | Concierge-voice copy sweep. Curated, not blanket. | Low — copy only |
| **6** | `claude/tare-aesthetic-ramp` | 25% → 50% → 100% over 5 days. Two weeks at 100% with no regressions → flag deletion PR. | Low — observability |

## Verification (Phase 0)

- Web `tsc --noEmit` exit 0
- Lighthouse / Lost Pixel: existing baselines unchanged because the
  `body.tare-on` class is OFF by default
- New tokens file imported in the correct order (after theme.css)
- Spectral loads cleanly via next/font (variable + italic both
  available)

## Re-entry criteria — when to revisit the brand decisions

- If the next-name pick changes the brand mark, the `--accent`
  colour, or the editorial-chrome rules, this doc gets re-opened.
- If contrast-audit fails the earth-tone macros on any surface,
  Phase 2 retunes the colours and updates the token file here.
- If a real user (TestFlight beta) reports the new palette feels
  off, we revert via the feature flag (zero-cost rollback) before
  patching.

---

## Phase 0.5 — Noom comparative read amendments (2026-05-18)

Grace's pushback on Phase 0: the Tare round-6 spec (true white surface,
Spectral-400 editorial, no italic anywhere) was over-corrected. Noom
(used here as a *softness* benchmark, NOT a functional-product
benchmark — their hooks, gamified streaks, and paywall pressure are
explicitly rejected) does five things better:

1. **Heavy serif headlines (600+).** Spectral / Newsreader at weight
   400 reads fashion-magazine fragile; at 600 reads structural and
   authoritative. Weight does the lifting, not family change.
2. **Selective italic with a highlight wash.** Italic isn't the lift —
   the wash is. ONE word per headline gets italic + sage wash. Used
   like a hand-placed parchment mark, not a marker stripe.
3. **Warmer surfaces.** Pure white is clinical; their peach/blush at
   low saturation does emotional work without being literal about
   food. **Cream stays for daily-use; peach is an opt-in surface for
   marketing / paywall / onboarding only.**
4. **Curved architectural cutouts.** A quarter-circle "bite" out of
   one card corner, with optional arc text following the curve. Pure
   shape language. Extends the brand's arc/bowl visual DNA into
   surface treatment.
5. **Photography is non-negotiable.** Recipe thumbnails rendering as
   gradient/glyph placeholders is the single biggest visual gap. **No
   token retune fixes this** — it requires a photography commission.
   Tracked as a separate workstream below.
6. **Serif/sans split principled.** Headlines = serif heavy. Body /
   UI / data = sans. Never mix within a card.

### What shipped in Phase 0.5

**Surface tokens reverted from pure white to warm cream:**
- `--background` (light): `#ffffff` → `#f6f3ee` (cream — same hue
  family as Tare's original "paper" surface, low saturation)
- `--background` (dark): `#000000` → `#0e0d0b` (warm-black, paired
  with cream's warmth on light)
- `--card` (light) stays `#ffffff` so cards lift cleanly off the
  cream page
- `--border` (light): `#eaeaea` → `#e6e1d6` (cream-bias hairline)
- `--border` (dark): `#242424` → `#2a2620` (warm-black hairline)

**New peach surface token for acquisition only:**
- `--surface-peach: #f6e4d6` (light) / `#1d1410` (dark)
- `--surface-peach-ink` for text-on-peach contrast
- Applied per-surface via `style={{ background: 'var(--surface-peach)' }}`
  or the `data-cutout-surface="peach"` attribute on cutout cards
- **Never** the page-bg for daily-use surfaces

**Editorial type primitives — heavy weight by default:**
- `.tare-title-serif` — NEW. Spectral 600, screen titles ("Today",
  "Meal plan", "Library", "Progress", hero headlines on paywall +
  onboarding). The daily-driver editorial class.
- `.tare-editorial` — weight bumped 400 → 500. Smaller editorial
  moments inside cards.
- `.tare-hero-number` — weight bumped 500 → 600. Ring-centre value,
  big-stat hero numbers.
- `.tare-masthead-ref` — unchanged (italic 400 — the masthead
  exception).

**Highlight primitive:**
- `.tare-highlight` CSS class + `<TareHighlight>` React wrapper at
  `src/app/components/ui/tare-highlight.tsx`
- Italic serif + soft sage wash behind (forest sage at 18% alpha
  light / 22% dark)
- Inset slightly so it reads as parchment + watercolour, not a
  marker stripe
- `box-decoration-break: clone` so wrapped highlights get a clean
  wash per line
- **Discipline: one per headline maximum.** Reserved for the
  weekly-recap card opener, onboarding intro, paywall hero. Never
  on body / UI / data / button copy.

**Curved cutout primitive:**
- `.tare-cutout-card` CSS class + `<TareCutoutCard>` React wrapper at
  `src/app/components/ui/tare-cutout-card.tsx`
- Quarter-circle "bite" out of any of the four corners via
  `data-cutout-corner` attribute
- Surface-behind colour driven by `--cutout-surface` CSS var
  (`var(--background)` default; switch to `var(--surface-peach)` via
  `surfaceBg="peach"` prop on the React wrapper)
- Optional arc label (`POWERED BY SCIENCE.`-style) renders via SVG
  `<textPath>` so the type traces the curve
- Implementation: faked by an absolute-positioned circle overlapping
  the corner with the surface-behind colour. Faster + more reliable
  than `clip-path` or `mask-image`, looks identical at any scale.
- **Scope of use:** paywall hero, onboarding "Why Suppr" intro,
  weekly digest editorial card. NEVER on Today / Plan / Library /
  daily-use surfaces — the cutout retains signal value only when
  rare.

### Photography workstream (separate from this code commit)

The 2026-05-18 Noom comparative read landed on this: **no token
retune fixes gradient/glyph recipe thumbnails.** The single biggest
visual elevation we can make is real food photography on the top
~50 recipe cards (Library + Discover).

This is a **content commission + spend decision**, not engineering
work:

- Budget estimate: £2,000 – £5,000 for 50 dishes at editorial
  quality (warm sepia stylist + photographer, half-day shoot)
- Alternative: licensed stock from Stocksy / Death to Stock with
  consistent warm-tone styling — cheaper (£500-1,500) but loses
  the "owned" feel
- Worst-acceptable: AI-generated food photography via Midjourney
  v6 or Flux Pro with consistent prompt scaffolding — £30 in
  credits, but ethical + brand-positioning questions
- Recommendation: commission 25 hero dishes (most-viewed Discover
  + Library), license-stock the next 75, AI-generate the long-tail
  rest — three-tier strategy, ~£1,500 total

Tracked as a parallel workstream; this code commit cannot ship the
photography. Owner: Grace.

### Where Phase 0.5 challenged the original Noom direction

1. **Noom is a marketing benchmark, not a daily-use benchmark.** Their
   peach surface lives on acquisition; their in-app daily UI is much
   quieter. Adopted accordingly: peach is a SEPARATE token, never the
   page-bg for Today / Plan / Library.
2. **Their gendered marketing-style colour application would alienate
   our MFP-refugee cohort.** Held the line on calm cream for daily-use.
3. **Real photography matters more than any token change.** Logged
   as a parallel workstream rather than pretending we can ship it
   with tokens.
4. **Their italic-everywhere Instagram content is brand voice
   exercise, NOT product UI.** The italic in `<TareHighlight>` is
   strictly one-per-headline; the masthead reference is the only
   other italic moment.

### Re-entry to challenge Phase 0.5

- If contrast-audit fails on the cream surface or the sage-wash
  highlight on any combination, retune and update here.
- If the photography workstream lands before Phase 1 ships, the
  recipe-card render conditions in Phase 1 should assume photos
  exist and remove the gradient-placeholder fallback path.
- If user testing flags the cutout-card primitive as too
  "marketing-coded" on the weekly digest, demote to paywall +
  onboarding only.
