# Premium-feel papercut sketches — initial doc (2026-04-29)

> **Update 2026-04-29 (later):** This doc was originally written from a single Today screenshot. After running the screenshot tour we now have **12 unique surfaces** captured. Today-screen findings stay below; the full multi-surface review is appended at the bottom under "Multi-surface review (post-tour)".

---

# Today screen — premium-feel papercut sketches (2026-04-29)

**Source:** screenshot baseline review of `today-01-loaded.png` (fresh-day, no logs, "What to eat next" card showing). Five papercuts ranked by user impact. For each: file location, current behaviour, proposed change, rough effort.

These are **sketches**, not committed code. Read overnight, pick which to ship, then implement.

---

## Papercut 1 — empty calorie ring dominates first impression

**Where:** `apps/mobile/components/charts/CalorieRing.tsx` + `apps/mobile/components/today/TodayHeroRing.tsx`

**Current:** `CalorieRing` renders a large concentric ring with the consumed kcal value (`0` in empty state) at centre, label "LOGGED" beneath, and budget line "of 2000 kcal" below that. The ring outline shows up faintly even at 0% fill. On a fresh day this is the largest element on screen, presenting a giant visual `0` to the user.

**Proposal:** soft-mode the ring when `consumed === 0` for the day.

```tsx
// CalorieRing.tsx — around line 196 onward
const isEmpty = consumed === 0;

// In render block (line ~314):
<Text
  style={{
    fontSize: expanded ? 22 : isEmpty ? 18 : 28,        // smaller in empty
    fontWeight: isEmpty ? "500" : "700",                 // lighter in empty
    color: isEmpty ? secondaryColor : (isOver && displayMode !== "consumed" ? Accent.destructive : textColor),
    fontVariant: ["tabular-nums"],
  }}
>
  {isEmpty ? "Start your day" : animatedCenterValue}
</Text>

{!isEmpty && (
  <Text style={{ fontSize: expanded ? 8 : 10, fontWeight: "700", color: ..., letterSpacing: ... }}>
    {centerLabel}
  </Text>
)}
```

Also consider lowering the ring's `trackColor` opacity in empty state (e.g. multiply by 0.5) so the outline is softer.

**Effort:** 30-45 min including a snapshot test for the empty state.

**Risk:** existing tests assert against "LOGGED" / numeric value in empty state — check `apps/mobile/__tests__/` or wherever CalorieRing is tested.

**Trade-off:** loses the "0" as a literal numeric anchor. If you've A/B'd this and the current design wins on engagement (some users motivated by seeing the zero), keep it. Worth checking analytics before shipping.

---

## Papercut 2 — macro tiles in empty state are noise without value

**Where:** `apps/mobile/components/today/TodayDashboardMacroTiles.tsx`

**Current:** four 2x2 tiles render with "0 / 122 g" + "122 g remaining" repeated four times. No visual progress indicator (no bar, no fill). On empty state this is 4 tiles of noise.

**Proposal A (light-touch — recommended):** add a thin progress bar at the bottom of each tile. Currently each tile is just text + icon; add a 3-4px filled bar that fills from left at `pct%`. In empty state the bar is a thin grey line; once the user logs, it animates to fill. This gives the tiles purpose in both states.

```tsx
// TodayDashboardMacroTiles.tsx — after line ~233 (end of existing tile content), add:
<View style={{
  marginTop: Spacing.sm,
  height: 3,
  borderRadius: 1.5,
  backgroundColor: borderColor,
  overflow: "hidden",
}}>
  <View style={{
    width: `${pct}%`,
    height: "100%",
    backgroundColor: def.color,
    borderRadius: 1.5,
  }} />
</View>
```

**Proposal B (more aggressive):** in zero-state, collapse the four tiles into a single "Targets: 122P · 75C · 31F · 16Fi" summary row. Expand to the full grid only after the first log of the day.

```tsx
// In TodayDashboardMacroTiles.tsx, wrap the existing tile rendering:
const totalMealsLogged = mealsToday;  // already a prop
if (totalMealsLogged === 0) {
  return (
    <Pressable
      onPress={() => onPressMacro("protein")}  // tap to expand or open targets
      style={{ ... cardish styling ... }}
    >
      <Text style={{ fontSize: 12, color: textSecondaryColor }}>Targets</Text>
      <Text style={{ fontSize: 14, fontVariant: ["tabular-nums"] }}>
        {targets.protein}P · {targets.carbs}C · {targets.fat}F · {targets.fiber}Fi
      </Text>
    </Pressable>
  );
}
// else fall through to the existing tile grid
```

**Effort:** A is ~30 min, B is ~1.5 hours including the expand interaction.

**Recommendation:** ship A. It improves both states without a state-conditional render that adds complexity.

---

## Papercut 3 — "Log lunch" CTA outshouts the FAB

**Where:** the "What to eat next" suggestion card. Likely in `apps/mobile/components/today/TodayEatAgainBanner.tsx` or a "WhatToEatNext" component (couldn't find by exact name — grep for "Log lunch" or "Close fit" to locate).

**Current:** the violet button sitting in the suggestion card matches the primary FAB colour and is bolder than the FAB because it's wider + has filled background + bold copy. Two violet buttons within a thumb's reach.

**Proposal:** demote the suggestion-card button to a secondary style. Either:
- **Stroke variant** — transparent background, violet border + text
- **Subtle fill** — `Accent.primary + "12"` (8% opacity) background, violet text

```tsx
// In whichever component renders "Log lunch":
<Pressable
  onPress={...}
  style={{
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Accent.primary + "14",   // or "transparent" + borderWidth: 1
    // borderWidth: 1, borderColor: Accent.primary,  // if going stroke
  }}
>
  <Text style={{ color: Accent.primary, fontWeight: "600", fontSize: 14 }}>
    Log lunch
  </Text>
</Pressable>
```

**Effort:** ~10-15 min. Trivial.

**Trade-off:** less click-through on the suggestion card. Worth A/B'ing if engagement on that card is a north-star metric.

---

## Papercut 4 — top-right cluster has three things doing three jobs

**Where:** `apps/mobile/components/today/TodayDateHeader.tsx` (and possibly the StreakPip wrapper elsewhere).

**Current:** the top-right of the Today screen has, in order: theme toggle pill (sun/moon icons), grid layout icon, "G" avatar circle. Plus the streak pill ("23 days" with flame) floats above this on the next visual row. Four interactive elements competing for attention.

**Proposal:** remove the theme toggle. Move it to Settings (where most apps put it). The grid icon's purpose is unclear from context — either remove or rename with a label. Keep the avatar (it's a useful tap target for profile access on every screen).

Concrete edit guesses (find the theme toggle in `TodayDateHeader.tsx` by searching for `lucide-react-native` icons `Sun` / `Moon` or `viewMode === "day"`):

```tsx
// In TodayDateHeader.tsx, remove or comment out the theme toggle JSX block.
// Keep the avatar render. Either remove the grid icon or replace with a clearer affordance.
```

If removing the theme toggle is a big enough change that you want to A/B it, an interim move is to make it muchsmaller (16pt icon, no pill background, just an icon at half opacity).

**Effort:** ~30 min if it's a clean delete. Add 30 min for moving the theme toggle into Settings (it may already be there per `(tabs)/settings.tsx:557` "Appearance" section).

**Trade-off:** users who toggle theme often will need an extra tap. Likely a tiny minority.

---

## Papercut 5 — day strip mixes ✓ checkmarks with bare date numbers

**Where:** `app/(tabs)/index.tsx` — the day strip is rendered inline (search for `weekData` or `dayLabels` around line 1378 onward). Likely renders within a horizontal `<View>` of `Pressable` cells.

**Current:** Mon ✓ / Tue ✓ / Wed (selected, big blue circle, "29" inside) / Thu / Fri / Sat / Sun. Past completed days show check icons. Today is highlighted as a filled circle. Future days show only the day name + date number in plain text. Three different visual languages on one row.

**Proposal:** unify on one visual treatment. Recommended: each cell is a small circle with the date inside, with the colour/style indicating state:

| State | Treatment |
|---|---|
| Past completed (logged) | Filled circle, `Accent.success` background, white date text |
| Past incomplete | Empty circle, dashed border, muted date text |
| Today | Filled circle, `Accent.primary` background, white date text |
| Future | Empty circle, solid border, muted date text |

This is consistent — every cell is a circle with a date inside. State is communicated by colour + fill, not by glyph swap (✓ vs date number). Reads cleanly at a glance.

```tsx
// Pseudocode for each day cell:
<Pressable onPress={() => selectDay(d.date)}>
  <Text style={{ fontSize: 11, color: textSecondaryColor }}>{d.short}</Text>
  <View style={{
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: getDayBackground(d, isToday, isPast, hasLog),
    borderWidth: getDayBorderWidth(d, isToday, isPast, hasLog),
    borderColor: getDayBorderColor(d, isToday, isPast, hasLog),
    alignItems: "center", justifyContent: "center",
  }}>
    <Text style={{ color: getDayTextColor(...) }}>
      {d.date.getDate()}
    </Text>
  </View>
</Pressable>
```

**Effort:** ~1.5-2 hours — the rendering logic is more involved than the others, and it interacts with selection state, week navigation, "today" highlighting, and the streak/log indicators.

**Trade-off:** users currently relying on the ✓ to spot logged days lose that explicit checkmark. The proposed colour-coded fill should be at least as readable but worth a quick test.

---

## What to ship first

If forced to pick the order I'd ship them in:

1. **#3 (Log lunch CTA demotion)** — 10 min, zero risk, immediately quieter screen.
2. **#1 (calorie ring soft empty state)** — 30-45 min, biggest perceptual lift on first-impression screens.
3. **#2A (macro tile progress bars)** — 30 min, makes the tiles useful rather than noise.
4. **#4 (top-right cluster cleanup)** — 30 min, removes visual competition from the header.
5. **#5 (day strip unified visual language)** — 2 hours, biggest change but most complex.

#1, #2A, #3 together are an afternoon's work and would meaningfully shift the "feels premium" needle on the most-seen screen in the app.

---

## What's not on this list

These exist on the screen but I'd leave alone for now:

- **"What to eat next" card** — the *concept* (specific, prescriptive, actionable suggestion) is exactly right. The execution issues are smaller (thumbnail size, "Close fit" labelling) and worth saving for a dedicated review of the suggestion engine.
- **Light/airy palette + ample whitespace** — working well, premium feel comes through.
- **Bottom tab bar** — clean and on-spec for iOS HIG.
- **Type hierarchy** — overline → big title → body is consistent and on-brand.

These are strengths to protect, not weaknesses to fix.

---

# Multi-surface review (post-tour)

## Critical product finding — deeplink routing broken for `(tabs)` routes

Of 20 deeplinks attempted in the screenshot tour, **10 silently failed**: `/planner`, `/progress`, `/settings`, `/more`, `/fasting`, `/health-sync`, `/notifications`, `/whats-new`, `/create-recipe`, `/profile`. All landed on Today (or whatever the previous screen was). Routes that worked were all root-level: `/shopping`, `/weight-tracker`, `/targets`, `/paywall`, `/import-shared`, `/nutrition-sources`.

**Pattern:** routes inside `app/(tabs)/` (especially those marked `href: null`) don't route via `Linking.openURL("suppr:///<path>")`. The URL handler in Expo Router doesn't surface them.

**User impact:** push notifications, share-sheet handoffs, and any "remind me later" / "deep link to Settings" UX is silently broken. A user clicking a push notification reminder linking to `/notifications` would land on Today and have no idea why.

**This is the same root cause** as the Maestro flow failures we couldn't fix earlier today. The `/more` orphan and the Apple Health / Settings flow failures are not just IA migration issues — even with Group G complete, **deeplinks to settings.tsx or any (tabs)/-grouped route would still fail**. This needs investigation before Group G ships.

**Recommended fix:** investigate `app/_layout.tsx` and the Expo Router config. Likely missing route handlers in the deep-link map, or the (tabs) layout is intercepting incoming URLs and redirecting to its own default.

---

## What we got clean captures of (12 surfaces)

### Library (`tour-03-library`)

**Working well:**
- Sub-tab pills (Library | Discover) at top.
- "20 recipes · 12 saved" counter under header — gives library volume context.
- Filter chip row (All / Saved / High-Protein / Quick / Vegeta...) — but "Vegeta" is truncated mid-word.
- Recipe cards with hero photo + title + author + nutrition pills + bookmark icon.

**Papercuts:**
- **"High-Protein" filter chip looked like "Hiah-Protein" in the screenshot.** False alarm: source is correct (`src/lib/recipes/libraryFilters.ts:267`); the rendering at 13pt in San Francisco's single-storey `g` glyph misread as `a` on first review. Real polish opportunity worth noting: filter chips at 13pt could benefit from slightly more height to give descenders breathing room — but not a correctness bug.
- **Filter chip overflow** — "Vegeta..." cuts off at the right edge. Either drop letters via ellipsis less aggressively, scroll horizontally, or shorten copy ("Veg" / "Plant").
- **Author byline inconsistency** — "Cookie and Kate" vs "emthenutritionist". One title-cased name, one lowercase handle. Pick a convention.
- **Nutrition pills on cards are very dense** — `464 kcal` `16g` `52g` `18g` `11.4g` `55 min` is six chips with mixed icons. The icons are small + similar in colour. Reading them at a glance is hard. Consider showing kcal + time on the card and macros only when tapping in.
- **Bookmark icon top-right of each card** is a duplicate cue — the user is on Library so they've presumably already saved it. The icon's purpose is "unsave," but its filled state suggests "saved." Confusing.

### Discover (`tour-04-discover`)

**Working well:**
- Clean header: "BROWSE" overline + bold "Discover" title.
- Search field with magnifying glass + placeholder.
- Filter pills: For You / Following / Popular / Quick / High Pro... (truncated).
- Big food photography on the recipe card — "Sheet-pan harissa chicken with chickpeas." This works. Discover should look hungry.
- "Suppr onboarding" attribution line.

**Papercuts:**
- **"Matches your day" section header** — subtle but a strong UX signal. The card itself has "Matches your day" as the section title... but how does it match? No explanation in the card. A tiny "84% fit" or "fits 540 of your 1700 kcal budget" would tell the user *why* the algorithm picked it.
- **"High Pro..." filter pill truncated.** Same issue as Library — abbreviate or scroll.
- **No sub-tab pill bar at top** of Discover (Library/Discover should both show the same sub-tab bar). Looking again — it IS there but in different visual treatment than Library. Library has both pills filled (purple/grey gradient); Discover has Library with grey background + Discover with white background. **Different visual style for the same component on two screens** = ship a single SubTabPill primitive treatment.
- **Card footer pills** — same density issue as Library. Six chips with small icons.

### Shopping (`tour-06-shopping`)

**Working well:**
- "Shopping list" title with a working sub-tab pill (This week | Shopping with "99+" badge).
- Progress bar "0/103" at top — quantifies the work ahead.
- Sections (CARBS & GRAINS, DAIRY & EGGS) with checkbox rows.
- Each item shows quantity + unit + recipe attribution ("Sweet potato & peanut curry").
- Share + delete icons in header for export / clear.

**Papercuts:**
- **"99+" badge on Shopping pill** — dramatic. With 103 items, that's a lot of friction to feel from the moment you open Plan. Maybe show an actual count up to 999. Or split by aisle so you don't see "99+" but "12 / 103 done".
- **Quantity formatting is inconsistent** — "1 cooked rice to serve (optional)" / "2 Rice, to serve" / "875 g 175 g Instant Oats" / "3 6 large eggs" / "1 5 large eggs". The last two look like data corruption — possibly two ingredients with quantities concatenated. Worth investigating in the shopping list aggregation logic.
- **"Sweet potato & peanut curry" subtitle is the recipe origin**, but it's the same colour as the item text and barely distinguishable. Either smaller, lighter, or move to a tooltip on tap.
- **Empty checkboxes look identical to "0/103 done"** — no checked items shown. With 103 unchecked items, the screen feels like a very long todo list. A "checked" state preview at the top would help establish the pattern.
- **The progress bar is at 0% and almost invisible** — it's a hairline at this width. Consider a colour-tinted track that shows even at 0%.

### Weight tracker (`tour-10-weight-tracker`)

**Working well:**
- "Weight & Trends" title + back button.
- Range pills (1M / 3M / 12M / All) with current 3M selected. Standard pattern.
- "Historical import depth" explainer card — educates the user on chart behaviour. Premium-feel detail.
- Range chips inside the explainer (3 mo / 6 mo / 9 mo / 12 mo / All) with 12 mo selected.
- Big stats: "55.3 kg Current" + "↑ 0.7 kg past 3 months" (red/amber) + "50 kg Goal" (green).
- Weight chart with goal line + current data point + "25 Apr · 55.3 kg" label.
- Save button at bottom (the input field above is empty — "55.3" placeholder).
- Date range labels on the chart axis.

**Papercuts:**
- **Two range selectors stacked.** The "1M/3M/12M/All" pills at the top set the chart range; the "3 mo / 6 mo / 9 mo / 12 mo / All" pills inside the explainer set the historical import depth. They look very similar but mean different things. A user could easily change the wrong one. Either visually differentiate (different shape, different colour, different position) or consolidate.
- **Chart labels overlap** — "54.0 kg" sits right next to a data point and the line passes through it. Hard to read.
- **"54.0 kg" label position** — looks like it's labelling a specific data point but is placed mid-trend. Move to right of the point.
- **Goal line + label** — "Goal: 50 kg ↓" is good. The downward arrow plus green colour reinforce the direction. Working.
- **"Tap the chart to see weight on that day"** instruction is good but feels temporary — would be cleaner as a tiny help icon.
- **The Save button at the bottom has a huge purple block** dominating the bottom 15% of the screen. Without an actual weight typed, this feels premature — disable until input is non-empty, or replace with subtle text affordance.
- **Date range tag** "16 Feb / Range: 54.2 kg — 55.5 kg / 25 Apr / Goal: 50 kg" is information-dense but legible. OK.

### Targets (`tour-12-targets`)

**Working well:**
- "Targets" title + back + Edit button. Clean.
- "DAILY CALORIE TARGET" overline + huge "1,132 kcal" + small "Estimated TDEE based on Mifflin-St Jeor · light activity · 550 kcal deficit" — best contextual explainer in the app. A user knows *exactly* why their target is what it is. This is excellent.
- Macros section with 2x2 tiles (Protein / Carbs / Fat / Fiber). Same pattern as Today but more readable here because there's only one element competing for attention.
- "Reach 50 kg" projection card with "Currently 55.3 kg · more than a year at current rate" + "On track" pill. Useful context.
- "Projections assume a 14-day moving average. Targets adapt weekly based on logged intake." footer caveat. Good honesty.

**Papercuts:**
- **"Reach 50 kg" + "more than a year at current rate"** — for a user trying to hit a goal, "more than a year" is psychologically deflating. Suggest framing: "On track for 50 kg by [Apr 2027]" with a date. Concrete dates feel closer than abstract "more than a year".
- **The "Edit" button in the header** is the only action on the screen but it's quiet. Consider promoting if editing targets is a frequent flow, or making the whole DAILY CALORIE TARGET card tappable (chevron right).

### Paywall (`tour-15-paywall`)

**Working well:**
- Strong gradient header (purple → pink) with "CHOOSE YOUR PLAN" overline + "Pick the plan that fits" title.
- "Subscriptions unavailable / In-app purchases aren't configured in this build / Continue on the free plan" — honest dev-build messaging. Won't ship this way to production but worth noting we have a clear unavailable state.
- "Continue for free" button as primary action when paywall is unavailable.
- "Have a promo code?" expander.
- "Restore purchase / Terms / Privacy" links — required by App Store guidelines.
- "Payments handled by the App Store" trust line.

**Papercuts:**
- **"Subscriptions unavailable" card visually dominates** — in dev builds this is fine, but if this state can ever show in production (network error, store issue), consider a less-blocking treatment.
- **Header gradient ends abruptly** at the white card. A subtle fade or scrim under the card would feel more crafted. Currently it looks like two screens stitched.
- **"Cancel anytime. Price in your currency, taxes included."** under the title is good copy but small / pale. Bump up.
- **Lots of empty white space** below the "Subscriptions unavailable" card before the trust line. Feels broken because the plan cards aren't there. In production with plans visible this won't be an issue.

### Import shared recipe (`tour-17-import-shared`)

**Working well:**
- "IMPORT" overline + "Back" button. Clean header.
- Big "P" gradient circle (the avatar pattern) at top of the card — soft, approachable.
- "Paste a recipe link" headline + supportive copy explaining the share-from-app flow.
- Input field with "https://..." placeholder.
- Big purple "Import" CTA + "Use clipboard" + "Import from photo" secondary actions.
- "IMPORT FROM" overline + 4 source tiles (TikTok, Instagram, YouTube, Website) — clear visual taxonomy.
- "RECENT IMPORTS" section with a previously imported recipe shown.

**Papercuts:**
- **"Instagr / am" wraps awkwardly** in the source tile — the word "Instagram" doesn't fit one line at the tile width and breaks mid-word. Either narrower font, smaller text, or shorter label ("IG"). Most polished apps just abbreviate.
- **"YouTube"** also wraps — "YouTu / be". Same issue.
- **"Website"** doesn't wrap. Inconsistent.
- **Source tile icons** — TikTok shows a stylised musical note in B&W, Instagram shows the camera+gradient, YouTube shows a play triangle, Website shows a globe. Brand legitimacy of TikTok/IG/YT requires care — third-party trademarks. Worth a legal pass before shipping. (Suppr is using brand-style icons for those services; might be considered fair use for an integration but worth confirming.)
- **The big "P" gradient avatar** at the top of the import card has nothing to do with importing. It's the user's profile avatar. Consider removing — the icon space could be used for a more on-brand element (Suppr logo? An import-themed glyph like a chain link?).
- **"Import from photo"** — what does this do? OCR a screenshot of a recipe? Worth a one-line subtitle.

### Nutrition sources (`tour-19-nutrition-sources`)

**Working well:**
- "INFO" overline + "About nutrition data" title. Sets context.
- Honest paragraph explaining the multi-source approach.
- Database cards: USDA FoodData Central / Edamam / Open Food Facts — each with a description, attribution, and link. Trust-building, premium-feel detail.
- Linked URLs (`fdc.nal.usda.gov`, `www.edamam.com`, `world.openfoodfacts.org`) styled as visible affordances.

**Papercuts:**
- **No FatSecret in the visible list.** Earlier the test code referred to FatSecret as a source. Either it's below the fold (we'd need to scroll) or it's not yet documented here — worth confirming all the sources currently used are credited.
- **Long descriptive paragraphs in each card** — premium would either be tighter copy ("USDA · government nutrition data for whole foods") or accordion expand. Currently each card is dense.
- **"`Backed by the Edamam Food & Measures database used by major food publishers. Powered by Edamam.`"** — the "Powered by Edamam." sentence is required attribution but reads as marketing repetition. Consider stylising as a footer tagline.

---

## Roll-up: top 10 papercuts across all surfaces

Combining Today findings + multi-surface review, ranked by impact-to-effort:

1. **Fix deeplinks to (tabs) routes** — currently a silent product bug affecting push notifications and share-sheet handoffs. Investigate `app/_layout.tsx` + Expo Router config. (Effort: ~2-4 hours of investigation, fix likely smaller.)
2. **Soft-mode the empty calorie ring** on Today (paper #1 above). 30-45 min.
3. **Demote the "Cook ahead →" / "Log lunch" CTA** colour on Today suggestion card (paper #3 above). 10 min.
4. **Add progress bars to macro tiles** on Today + Targets screens (paper #2A above). 30 min.
5. **Fix "Hiah-Protein" typo** on Library filter pill. 1 min.
6. **Fix shopping list quantity aggregation** — "3 6 large eggs" / "1 5 large eggs" looks like a real data bug. Investigate `lib/shopping/` aggregation logic. ~1-2 hours.
7. **Fix Instagram / YouTube text wrapping** on import source tiles. 10 min (tighter font / abbreviate).
8. **Reframe "more than a year at current rate"** on Targets card to a concrete date ("On track for 50 kg by [Apr 2027]"). 15 min.
9. **Unify the SubTabPill visual treatment** across Library and Discover (Discover renders pills with different background). 30 min.
10. **Fix filter pill truncation** on Library + Discover ("Vegeta..." / "High Pro..."). Either scroll horizontally or shorten copy. 30 min. **Update 2026-04-29:** investigated; this isn't a real bug. Both rows already use horizontal scroll (`<ScrollView horizontal>`), and the partial pill at the right edge is a valid scroll affordance. The user can swipe to see the rest. A right-edge fade gradient would be a premium-feel polish but requires `expo-linear-gradient` (not installed) for marginal gain. **No action taken.** If we add `expo-linear-gradient` for some other reason later, this is a low-effort follow-up.

Items 1, 6 are real bugs (data + routing). Items 2, 3, 4, 7, 8 are style polish. Items 5, 9, 10 are inconsistencies. Half-day's work to ship 5-9 of these.
