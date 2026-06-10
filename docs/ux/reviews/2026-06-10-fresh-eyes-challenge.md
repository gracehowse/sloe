# Fresh-eyes challenge — every standing design decision, re-judged from pixels

2026-06-10, from ~60 same-day captures (light + dark, all tabs, sheets,
secondary screens; `e2e-walk-2026-06-10/`, `lanes-verify-2026-06-10/`,
`tile-ab-2026-06-10/`, `fresh-eyes-2026-06-10/`). Audience frame: Oura /
Apple Watch aesthetes; NYT Cooking + macros; Julienne + macros; IG
recipe-savers. Verdicts: **HOLD** (survives challenge, with evidence) /
**MODIFY** / **OVERTURN**.

---

## 1. The material system is too subtle to register — that's the real
## "inconsistency" (MODIFY — this is the deepest finding)

Standing decision: white page ground, cream `#F6F5F2` cards, soft lift.
Challenged: the white→cream delta is ~3 RGB points. In the captures the
card edges barely exist — which means the *system* never registers as a
system, so every small real divergence (radius, border, lift) reads as
chaos rather than variation on a theme. Grace keeps seeing
"inconsistency" even after convergence passes because **the grammar is
whispering**. Meanwhile the app's own splash + onboarding use a CREAM
ground — the two strongest brand moments contradict the tabs' white.

Comps: Lifesum (cream ground, white cards — real contrast), Julienne
(editorial white, almost no containers), Oura (dark ground, strong card
contrast). All three commit loudly to a material story; we hedge.

**Call: pick ONE ground story and make it audible.** My recommendation:
**cream ground (`#FAF7F2`-family) + white cards + soft lift** — it
matches the splash/onboarding brand moments, it's the Lifesum/warm-
editorial grammar the direction board chose, and white cards give the
food photography (ENG-1015) a gallery surface. This inverts the current
fill assignment — and notably the recipe-detail screen ALREADY does
this and it's the best-looking screen in the app (see §2). One decision,
app-wide, flag-gated, A/B'd in pixels before commit.

## 2. Recipe detail's inverted cards — I was wrong this morning (OVERTURN
## my own same-day call)

I ruled "converge recipe detail's white-on-cream to the canonical
cream-on-white" (decision doc §3). Fresh eyes on the captures: recipe
detail is the screen that LOOKS most premium — hero photography, serif
title, white cards with real presence on a warm ground. It isn't the
deviant; it's the prototype of §1's answer. **Reverse the convergence
direction: the app converges toward recipe detail's material story, not
away from it.** (§1 and §2 are one decision.)

## 3. Today is a wall of containers — content-over-chrome (MODIFY the
## card-stack IA, not the card style)

Today renders 8+ rounded rectangles in one scroll: hero card, 4 tiles,
meals card(s), log CTA slab, insight card, planned card, activity card,
hydration card. The premium comps put content forward and chrome back:
Julienne is photography + type with almost no boxes; NYT Cooking is an
open list. Our meals already proved the pattern works — macro-detail's
OPEN LIST reads cleaner than the meals CARD.

**Call:** de-card the mid-page: meals as an open list under a serif
section header (keep slot glyphs + rows), insight as a typographic
callout (eyebrow + line, no lilac slab), activity/hydration as one
combined card at most. Target: ≤4 contained surfaces per viewport.
This — not shell polish — is what makes the page feel designed.

## 4. The header stack spends 25% of the viewport before any data
## (MODIFY)

Wordmark row + "Morning, Grace" + date line + week strip = four stacked
header moments. NYT Cooking/Julienne compress identity to one line.
**Call:** merge the greeting into the wordmark row (or drop the greeting
on return visits), tighten strip-to-hero spacing. One header moment, one
context moment, then data.

## 5. Multi-ring hero (HOLD concept / MODIFY empty state + scale)

The populated multi-ring is the most ownable element in the category —
HOLD, the director was right. But the EMPTY state is a giant pale circle
filling ~45% of the viewport saying "Start your day" — the weakest first
impression in the app, and new users see it first. **Call:** empty-state
hero shrinks (~60% height) and leads with the plan-your-day action +
(post-ENG-1015) appetising imagery; the ring earns its size with data.

## 6. Serif discipline (MODIFY — display-only)

Newsreader serif at screen-title and hero-numeral scale: HOLD, it's the
brand voice. But it has crept into card titles, insight headlines, and
an italic coaching line ("Plan your day — about 1,252 kcal left. No
rush.") where at small sizes it reads quaint — and cream+serif is now
the documented AI-default look (calibration note), so the serif must be
deployed like a signature, not a wallpaper. **Call:** serif = screen
titles, hero numerals, editorial headlines (Discover cards, recipe
titles). Sans = card titles, labels, body, coaching lines. Kill the
italic accent lines.

## 7. Week strip selected-state (MODIFY — reopen the 2026-06-03 call)

The minimal dot indicator (Grace's own June-3 call against the clay
pill) is nearly invisible in captures; the selected day doesn't read at
a glance. The pill was too loud; the dot is too quiet. **Call:** middle
option — tinted number + small underline/dot pairing, A/B'd in pixels.

## 8. Palette + macro hues (HOLD) / status semantics (MODIFY)

Aubergine + sage/clay/amber/teal: HOLD — coherent, ownable, and dark
mode is genuinely good. But amber does double duty as "fat colour" and
"over budget" (the %-of-kcal confusion was real). **Call:** semantic
tones (over/under/on-track) get their own consistent treatment distinct
from macro identity hues; encode in the colour census migration
(ENG-1013).

## 9. Tab bar (HOLD structure / watch list)

4 tabs + centre FAB: HOLD (ratified IA, working). The FAB's visual
weight vs the quiet lucide icons is slightly top-heavy but acceptable;
revisit only after §1's ground change (a cream ground will rebalance it).

## 10. One-card elevation grammar (HOLD as amended)

Cards soft / tiles flat (today's A/B amendment) survives challenge — but
under §1's inversion the shadow values must be re-tuned for white-on-
cream (shadows read stronger on cream). Re-A/B during §1.

---

## Priority re-order (what actually moves "premium")

1. **§1+§2 ground/material decision** — the system becomes visible.
2. **ENG-1015 imagery** — unchanged: the single biggest unlock.
3. **§3 Today de-carding** — content over chrome on the home surface.
4. **§4 header compression + §5 hero empty state** — the cold-open.
5. **§6 serif discipline + chips/headers unification (census maps)** —
   supporting consistency, not leading it.

Shell-convergence work (cards/chips/headers/colour) continues — it's
necessary hygiene — but it is explicitly NOT the path to "premium" on
its own; §§1–5 are.
