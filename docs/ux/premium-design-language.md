# Suppr premium design language

**Status:** living · **Owner:** Grace · **Established:** 2026-05-26 (from the ENG-740 Week-Digest redesign, ratified by Grace: "much better — apply this same eye to the whole app")

This is the bar every Suppr surface is held to. It's the "eye" that turned the Week Digest from "functional but not premium" into premium. Distilled from the ui-product-designer spec for ENG-740 + the Oura / Whoop / Headspace reference set. `design-system-enforcer` and `ui-critic` enforce this; `ui-product-designer` designs to it; `executor` builds to it.

The reference artifact: `docs/prototypes/2026-05-26-progress-digest-blend/index.html` (the canonical "this is premium" example).

---

## The 8 principles

1. **One filled region per card, max.** A premium card has a single focal fill (a soft-tint hero). Everything else sits on the card surface, separated by **hairlines + whitespace**, never nested boxes. The #1 thing that reads as "not premium" is box-inside-box-inside-box (a bordered stat grid next to a bordered insight box next to a bordered footer). Flatten it.

2. **Hero stat with context, not a sentence.** The most important number gets rendered large, with a visual that gives it meaning — a value on a target-relative track (Oura), a ring, a delta. "Saturday — 680 kcal on a track toward 901 target" beats "Sat was your closest day (680 vs 901)." Show, don't narrate.

3. **Borderless metric strips.** Secondary numbers go in an open number-over-label row (Whoop), separated by whitespace, with at most a single hairline above. No per-cell borders or fills. Tabular-nums always.

4. **Insights are elegant rows or mini-viz, never prose-in-a-box.** A trend/pattern gets a short labelled row (`PATTERN` eyebrow + one neutral sentence) and a small visual (two-bar comparison, sparkline) — not a gray box of paragraphs. If you're tempted to put two sentences in a tinted box, you've found a not-premium spot.

5. **Colour earns its place — one signal per card.** Default is ink + muted gray. Colour appears only where it carries meaning: the calorie-ring 3-state (under→green, over→red, ±4%→neutral), protein-on-target green, a single calm accent for neutral comparisons. **Over-budget is amber, never red** (except the calorie ring). Diet-culture red/green grading is forbidden. A calm card with one coloured thing reads more premium than a rainbow.

6. **Consistent spacing rhythm.** Even vertical rhythm (one spacing step between every tier) is most of what "premium" actually is. Generous padding. Resist cramming. Whitespace > dividers > borders, in that order of preference.

7. **Type hierarchy does the work.** Eyebrow (caps, tracked, muted) → hero (large, bold, tight tracking) → body (medium) → caption (muted). No italics for data (reads as a caveat). Let weight + size establish importance so you don't need boxes to do it.

8. **One primary action, clearly the heaviest.** The CTA (Share, Log, Save) is the only filled button in its footer; secondary actions are muted text. Never two equal-weight buttons competing.

---

## Voice (carries from brand)

Calm, observational, never corrective or diet-culture. The app **observes** ("Sundays ran higher than Fridays"), it does not **coach** ("even out your week"). Past tense for the week that happened. Numbers are estimates — hedge the adaptive/health-adjacent claims ("landed around X"), don't caveat every number.

---

## Per-surface premium checklist

Run this on any surface before calling it premium (it's the `ui-critic` / `visual-qa` rubric):

- [ ] How many bordered/filled boxes are stacked? Target: **one** focal fill, rest hairline/whitespace.
- [ ] Is the most important number a hero with visual context, or buried in a sentence/row?
- [ ] Are secondary metrics a borderless strip, or boxed tiles?
- [ ] Is any insight presented as prose-in-a-box? (→ convert to a labelled row + mini-viz.)
- [ ] How many colours, and does each carry meaning? (Target: 0–1 signal colour.)
- [ ] Is the spacing rhythm even, or cramped/irregular?
- [ ] Is there exactly one primary action, visually heaviest?
- [ ] Any diet-culture framing (grades, red "bad", corrective CTAs)?
- [ ] Web/mobile parity on the above (platform deviations enumerated, not accidental).

---

## Process (non-negotiable, per existing rules)

1. **Pixel-grounded audit first** — capture the real surface (Maestro / TestFlight / Playwright), don't redesign from code (`feedback_premium_audit_requires_pixels`).
2. **Subtractive first** — prefer removing chrome to adding flourishes (`feedback_premium_audit_subtractive_first`).
3. **HTML prototype before code** — web + iPhone-framed "after", Grace red-lines pixels (`feedback_html_prototypes_before_coding`).
4. **Don't erase differentiators** — best-in-class ≠ identical to the comparable; keep what Suppr already does better (`feedback_conformity_trap`).
5. **Ship behind a feature flag** with before/after screenshots; validate in sim before push.

---

## Maps onto the existing "Premium experience — launch bar" program

This is the bar for the existing phased Linear program (initiative *Premium experience — launch bar*, projects **Premium P0–P5**) — it doesn't replace it, it's the standard P0's enforcement gates should reference and P1–P4's surface work should hit:

- **P0 — Evidence & enforcement** → this doc is the canonical bar; the token/lint + capture gates enforce it.
- **P1 — Cold open & trust** → Today cold-open, auth, paywall, welcome (surface #1–2 below).
- **P2 — Daily loop excellence** → log sheet, meals, north-star (Today depth).
- **P3 — Food & plan surfaces** → Discover, cook, import, plan/shopping (surfaces #2, #4).
- **P4 — Progress, settings & membership** → Week Digest (ENG-740, the canonical example), trajectory (ENG-741), settings (surfaces #3, #6).

## Surface priority (first-impression × daily-use)

The order to apply the eye, highest leverage first (mirrors the P1→P4 phase order):

1. **Today** — daily-active loop, the screen opened most. Ring, macro tiles, meal list, quick-log.
2. **Recipes / Discover** — viral-push landing zone (recipe-import-from-Reel); first impression for new users.
3. **Progress** — Week Digest (ENG-740, ✅ designed) + trajectory box (ENG-741) + weight chart + streak detail.
4. **Plan** — meal-plan cards (fit-badge already removed, ENG-744), generate flow.
5. **Onboarding + Auth** — first-run; high stakes but already closest to the Claude Design prototype bar.
6. **Settings / More** — import card (ENG-743 ✅), export, account.
7. **Landing / marketing** — separate web surface.

Each surface = its own audit → prototype → red-line → flag-gated build → validate loop.
