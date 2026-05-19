# Tare aesthetic v1 — foundation (Phase 0)

Date: 2026-05-18
Status: Phase 0 shipped, Phase 1+ pending
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
