# 2026-04-30 best-in-class UI/UX critique vs MFP / Chronometer / Cal AI / Lifesum

**Source:** `ui-critic` agent run, 2026-04-30 afternoon, against the 30 mobile state-* + onb-* captures landed in commit 85199b1 + the post-rename state.

**Question Grace asked:** "are users going to look at this app, start using it and saying yes — I'm going to make the jump from MyFitnessPal or Chronometer or Lose It! etc."

---

## Verdict

**Would a switcher actually move? Today: maybe — for the right user. Not yet for the median MFP user.**

A user who lands in onboarding and reaches the reveal at step 12 will think "this is better than what I have." A user who lands on Library / Discover and sees real photography + macro inline + the "Matches your day" framing will think "this is better than what I have." A user who lands on Recipe Detail with the macro tile band will think "this is more thoughtful than MFP."

But the median switcher opens the app, lands on **Today**, sees a wireframe ring, four 0/X tiles, and a tiny "+" button, and decides in three seconds that this is a beta. They will not stick around long enough to discover that Discover, Plan, and Shopping are actually excellent.

**The switching decision is being made on Today. Today is currently the weakest screen.** Fix Today and the Log sheet and the conversion math flips. The other three weak points (Cook empty, Fasting, Targets) are loss-prevention on retention, not on first-look conversion.

The good news: **the design system already has the answers.** The onboarding reveal at step 12 is the template. Port that visual language to Today, Targets, and the Log sheet, and Suppr leaves "good" and enters "premium" within one sprint.

---

## Top 5 differences vs best-in-class (P0)

### 1. Today is empty when it should be alive
`state-60-today-current.png`. At 9:41 on day-of-use, the hero is a literal wireframe — three concentric grey rings with placeholder string "Start your day". Below it: four macro tiles all reading "0 / 122 g" with empty progress bars. Cal AI puts a single big calorie ring with a pulse animation; MFP shows yesterday's streak + today's first-bite countdown; Lifesum drops in a personalised "Good morning, Grace — your protein target is the thing to nail today" line. Suppr's blank slate looks like a debug screen.

The "What to eat next" card directly below it (Green Goddess Chopped Chicken Salad) is genuinely premium — image, "Close fit", macro inline, single CTA. **It should feel co-equal with the calorie ring, not subordinate to a placeholder.** The empty progress ring above is making a worse first impression than no ring at all.

### 2. There's no obvious "log a meal" gravity
The FAB on Today is a flat indigo circle with a `+` glyph, sitting over the macro grid. MFP's "+ Add" has a halo, Cal AI's camera button has a subtle pulse + is centred in the tab bar, Lifesum's is a raised tab-bar centre button. Suppr's primary action — log food — is competing visually with the macro tiles instead of dominating them.

### 3. The Log sheet feels like a system list, not a food logger
`state-10`. Search bar with three icons crammed in the trailing edge, then nine identical "Food log (XXX kcal) (via MyFitnessPal)" rows with grey image placeholders. MFP-imported logs surfaced as opaque "Food log" entries is a brand-confidence killer. Cal AI has each AI/scan/voice tool as a dedicated full-row action card with an illustration. This screen is doing 1/10th the work it needs to do.

### 4. Cook empty state was a blank page with "Go back"
`state-80-cook-entry`. Pre-fix: centred "No instructions available" + a pill button. No illustration, no copy explaining when this happens, no link to Recipe Detail. (Fixed in commit `b86eba8` — now styled with heading + sub + primary button. Still needs a path from Cook → Recipe detail, see #5 in IA section.)

### 5. There is no "moment"
No streak art, no completion celebration, no progress visualisation that's memorable. Cal AI has the day-end summary card with food montage. MFP has the streak flame. Lifesum has the Life Score wheel. Chronometer has the nutrient completeness honeycomb. Suppr currently has a "24 days" counter pill in the top right of Today and that's the entire emotional surface area of the product. The onboarding reveal at 12/15 ("2,296 kcal/day" in a gradient ring) is genuinely beautiful — that visual language exists in the codebase but never reappears in daily use.

---

## Top 10 specific upgrades by surface (P1)

| # | Surface | Before | After | Tier impact |
|---|---|---|---|---|
| 1 | Today hero | 3 concentric grey rings + "Start your day" | Single live calorie ring (gradient match to onb-12), big number centred, macros as horizontal segment underneath | Prototype → Premium |
| 2 | Today empty-day | Calorie ring as primary, suggestion below | When kcal=0: keep canonical order but make the suggestion card visually richer; primary CTA on suggestion = "Log this meal" | Generic → Premium |
| 3 | Log sheet | Search field + 3 trailing icons + flat list | 4 stacked action cards (Scan / Snap / Speak / Search), each with icon + title + sub | Prototype → Premium |
| 4 | Fasting timer | Light grey ring, hardcoded red End Fast, no narrative | Dark gradient ring, animated pulse, demoted End Fast text-button, narrative line ("you're 1h13 in — body just starting to deplete glycogen") | Prototype → Good |
| 5 | Cook empty | "No instructions available" + pill | Illustration + heading + Open recipe primary CTA + Find similar secondary; deep-link to source URL where available so this state becomes rare | Cheap → Good |
| 6 | Library chips | Cramped chip row truncates "Vegeta..." | Counts on chips ("All · 21" / "Saved · 13"), max 4 chips visible + "More" | Good → Premium |
| 7 | Recipe detail macro band | Thin green-bordered card + 4 small pill cards | Bigger calorie number, bigger emoji glyphs in tiles, "Fits your day: 28% of remaining cals" badge | Good → Premium |
| 8 | Plan week | "Plan setup" body-copy card dominates above meals | Demote to settings icon top-right; meals are the hero | Generic → Good |
| 9 | Shopping progress | "Progress 0/103" with 1px line | 4px gradient bar; section-level progress in group headers ("CARBS & GRAINS · 0/3") | Good → Premium |
| 10 | Targets summary | Flat number + 4 0/X cards | Mirror onb-12-reveal: calorie gradient ring, three glanceable macro cards, BMR + TDEE, methodology card | Generic → Premium |

---

## What to remove

1. **The "Start your day" wireframe ring on Today.** [PARTIAL — commit `9c38512+1` hides the macro rings in empty state; the outer ring still shows but no longer reads as 4 nested wireframes.]
2. **The "Plan setup" body-copy card on Plan.** Settings entry point dressed up as content. Move to a settings icon.
3. **MFP-imported "Food log (250 kcal)" rows in Log sheet recents.** Resolve to real food name, hide, or collapse to a single "Imported · 9 entries" disclosure.
4. **The bare red "End Fast" button on Fasting.** Demote to text. Red CTA for non-destructive action is jarring.
5. **The "G" abbreviation pill in Today header.** Not legible at thumbnail scale. If avatar, use an actual avatar circle.
6. **The 24-day counter pill, top-right of Today.** Either make streaks a real surface (animated flame, milestones, recap) or remove. Currently no narrative — worse than no streak.
7. **"Try a sample recipe" button on `onb-14`.** Competes with URL field, dilutes the source picker.
8. **"By emthenutritionist" attribution at same weight as "Lunch" pill** on recipe detail. Demote.

---

## What to reorganize (IA delta)

1. **Today hero stack order.** Per 2026-04-27 strategic direction: date strip → live calorie ring → "what to eat next" → macros remaining → meals → persistent Log FAB. Macros do not need to be 2x2 — secondary to ring, tertiary to suggested meal.

2. **Library / Discover persistent search.** The two pill segmented control is fine; the search field repeats inside each tab. Hoist search to header, persistent across both tabs — "search across my saved + Suppr catalogue" is one motion.

3. **Targets is buried.** Reachable via state-70 but should appear as a card on Today (or quick-access in You). Right now there's no daily reminder of *what the targets even are*.

4. **Cook lives orphaned.** Empty state has no relationship to Recipe Detail. Should be one navigable flow: Recipe Detail → "Cook this" → Cook screen with steps, timers, ingredient strikethrough.

5. **Onboarding "Pick 5 recipes" terminal step gate (`onb-15`).** Currently hard-disabled until 5 picked. Cal AI lets the user proceed at 1. Consider: "Pick at least 1 — we'll suggest more as you cook" with a softer floor.

---

## Immediate fix landed (this commit)

**CalorieRing empty state — hide macro rings.** When `expanded && !isEmpty`, the 3 macro rings render. Previously they rendered in empty state too, producing 4 nested grey wireframe rings. Now the empty state shows one clean track + soft "Start your day" copy. Closes the most acute visual defect without re-architecting the hero.

---

## Follow-up briefs (for ui-product-designer)

1. **Today hero redesign** — port `onb-12-reveal` visual language. Calorie ring with gradient. Macros as horizontal segment. Suggestion card co-equal hero on empty days.
2. **Log sheet redesign** — 4-card action stack replacing the search-with-trailing-icons layout. Resolve or hide imported recents.
3. **Fasting visual upgrade** — dark gradient ring, narrative line, demoted End Fast button.
4. **Cook flow consolidation** — link Cook ↔ Recipe Detail; deep-link to source URL when no instructions.
5. **Targets tile system port** — mirror onb-12 calorie ring + macro tiles.
6. **Streak / milestone system** — define what the surface tells the user, what happens at days 7/30/100. Or remove the surface entirely.

---

## Open product questions

1. Today hero — is the calorie ring the canonical hero, or is "What to eat next" supposed to be? Per 2026-04-27 strategic direction: ring is canonical second element, suggestion is third. Document this decision so designer briefs don't propose swaps.
2. Streak/milestone language — what's the streak telling the user? Define moment or remove.
3. Fasting — MVP feature or flagship? Current treatment says MVP; if flagship, needs dark-mode + narrative + history surface.
4. Macro tile system — the prototype has the emoji-glyph variant (used on `onb-12`, `state-31`); Today uses a quieter variant. Pick canonical and use everywhere.

---

## Files referenced

- `apps/mobile/screenshots/latest/state-60-today-current.png` — the conversion-blocking screen
- `apps/mobile/screenshots/latest/state-10-log-sheet-default.png` — generic Log surface
- `apps/mobile/screenshots/latest/state-20-fasting-idle.png` — generic Fasting surface
- `apps/mobile/screenshots/latest/state-80-cook-entry.png` — Cook empty (now styled, but still orphaned)
- `apps/mobile/screenshots/latest/state-70-targets-summary.png` — needs onb-12 port
- `apps/mobile/screenshots/latest/onb-12-reveal.png` — **the design ceiling — reference everywhere**
- `apps/mobile/screenshots/latest/state-30-library-saved.png` — already premium (reference for chip polish)
- `apps/mobile/screenshots/latest/state-31-recipe-detail-saved.png` — already strong, needs "fits your day" badge
- `apps/mobile/screenshots/latest/state-50-plan-week.png` — demote setup card
- `apps/mobile/screenshots/latest/state-90-shopping-top.png` — section progress would help
