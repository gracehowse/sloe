# Product-lead strategic challenge — 2026-04-27

**Owner:** product-lead specialist (audit)
**Status:** Proposal — pending Grace's accept/reject per call
**Frame:** Grace's brief — "the whole app needs to be competition-beating, modern, impressive, best-in-class screen-to-screen."

---

## 1. The decisive verdict

**No. The current app shape is not compatible with "best-in-class" — and not because any one screen is bad. Because the product is trying to be three products.**

What the roadmap and the 6-tab structure describe today:

- **Product A — a macro tracker** (Today, hydration, caffeine, alcohol, adaptive TDEE, HealthKit, deficit projection, weight trends, weekly recap, streak freeze, voice/photo log).
- **Product B — a recipe + meal-planning tool** (Library, Discover, Plan, drag-drop, leftovers, plan templates, shopping list, cook mode, household dinners).
- **Product C — a creator/social network** (Discover feed, publish moderation, social import, follower notifications, multi-format authoring, "post once, share everywhere").

Best-in-class trackers (MacroFactor) win by being **opinionated about adherence and adaptation**. Best-in-class recipe apps (Mob, Whisk, Paprika) win by being **brilliant at the cook-and-keep loop**. Best-in-class social food apps (TikTok-for-food, IG cooking creators) win on **feed gravity and creator economics**. Suppr is currently a B+ at all three with a roadmap that adds depth to each.

That is the failure mode of consensus product-building. It is not what beats anyone.

**Three bullets that summarise the call:**

- **Pick one promise. Cut the second. Defer the third.** The wedge in the roadmap ("targets → plan → shop → cook → log in one place") is the actual product. Everything that doesn't serve that loop should be demoted, deferred, or removed from the primary surface.
- **Six tabs is two too many.** It is a tell that nothing is canonical. Best-in-class apps run 3-5 tabs. Suppr can land at 4 without losing function — the comment in `_layout.tsx` arguing each tab "earns its slot" is itself the hedge.
- **The Today hero "three variants, user picks" decision is the loudest piece of evidence that the team does not know what good looks like yet.** Ship one canonical Today and design it brilliantly.

---

## 2. What gets cut (or demoted out of primary surface)

Ranked by how much they dilute the core promise.

### 1. Creator/social ambitions in their current framing — DEFER

**Why it's not load-bearing:** The wedge is "I cook the recipes I save and they hit my macros." Multi-format creator authoring, "post once share everywhere", LTK-style syndication, follower notifications — none of these change whether one user closes the loop. They are a Phase D depth play that requires a creator base we don't have, on top of a moderation surface we have barely started.
**What's lost:** Long-tail growth narrative. Creator economy story for fundraising.
**What's gained:** Six months of focus on the actual loop. Less moderation surface area, less compliance burden (affiliate disclosure deferred to when commerce ships, not because we're hedging).
**Action:** Strip multi-format authoring + creator follow loop from the public roadmap. Keep the URL/social-import path because that's a *user* feature, not a creator feature. Discover stays as community-recipe browse, not as a feed.

### 2. Household / shared-plans — DEMOTE

**Why it's not load-bearing:** Phase F.1 shipped early on a hunch. With N=1 tester, we have zero evidence anyone wants this. Phase F.2 has 3 open decisions (invite model, portion math, gap-fill macros) we cannot resolve without users.
**What's lost:** A differentiator vs MacroFactor (which is single-user).
**What's gained:** A serious chunk of cognitive load — household RLS, privacy boundary tests, share presets, partner sync — gone from the v1 surface. The infrastructure stays. The product surface comes off.
**Action:** Hide household behind a Settings opt-in flag for v1. Don't market it. Don't put it in onboarding. Reopen when single-user retention is real.

### 3. Voice + photo AI logging as Pro features — KEEP, BUT NOT AS A HERO

**Why it's not load-bearing:** They are great features, but they are not why anyone picks the app. They are why someone *upgrades* once they're already in. Surfacing them as primary capabilities ("press and hold to log") competes for attention with the canonical log path and the recipe loop.
**What's lost:** Nothing. They stay buried in the Add menu.
**What's gained:** The Today screen stops fighting itself.
**Action:** Demote from hero placement. Keep the entry points compact. Don't onboard them.

### 4. Streak freeze + weekly recap as primary retention surface — DEMOTE

**Why it's not load-bearing:** Streaks are the laziest retention loop in tracker design. They generate adherence guilt and don't differentiate. Weekly recap is fine as a Sunday card, but it should not anchor Progress.
**What's lost:** Habit-app borrowing. A small adherence nudge.
**What's gained:** Progress can be about something more useful — adaptive maintenance, weight trend, what's actually changing.
**Action:** Streak shrinks to a pip on Today, not a celebration. Weekly recap stays once a week, dismissible.

### 5. Caffeine + alcohol tracking — REMOVE FROM PRIMARY

**Why it's not load-bearing:** This is feature creep dressed as wellness. Macro trackers' job is macros. Caffeine and alcohol are nice-to-haves that bloat the daily card.
**What's lost:** The "we track everything" pitch (which isn't a wedge).
**What's gained:** A cleaner Today. Fewer chips. Fewer rules about when rows hide.
**Action:** Move caffeine + alcohol behind a Settings opt-in. Default off. Hydration stays because it's a near-universal target.

### 6. Cook Mode as a separate screen — RECONSIDER, NOT NOW

**Why it's not load-bearing:** Cook Mode exists, it's fine, but it's the kind of "we built it because it's easy" feature. Mob and Paprika do it better. Don't build to compete with them; build the macro+log integration nobody else has.
**What's lost:** Nothing — keep it as is.
**What's gained:** Don't invest more here. No "Cook Mode 2".
**Action:** Freeze. Do not add features.

### 7. Shopping list — KEEP, DO NOT EXPAND

**Why it's not load-bearing as a hero:** The roadmap hints at "shoppable links" + affiliate. Don't. Shopping list is a function, not a product. The moment you add commerce, you take on disclosure complexity, vendor curation, and consumer trust burden — for revenue that won't move the needle vs subscription.
**What's lost:** A monetisation lever that wasn't going to work anyway.
**What's gained:** No affiliate compliance work. Trust intact.
**Action:** Strike from roadmap. Keep the existing "auto-generate from plan" feature, keep the share-out. Stop there.

---

## 3. What gets added (table-stakes for the bar)

Ranked by how much each one closes the gap to "best-in-class".

### 1. A single canonical "log a meal" path that is genuinely two taps from anywhere

**Why it's table-stakes:** MacroFactor, Cronometer, MFP all let you log a meal in two taps from any screen. Suppr today has Quick Add (collapsed), search, barcode, voice, photo, recipe-detail-log, planned-meal-log, household, copy-meal, usual-meal — and that's before someone tries to add a custom food. The number of paths is the problem.
**Cost:** A focused two-week project consolidating to one canonical sheet with progressive disclosure.
**Lands in:** A persistent "Log" FAB on Today + a single sheet that handles search/barcode/recent/saved/voice/photo as tabs inside it.

### 2. A real "what should I eat now to hit my targets" engine on Today

**Why it's table-stakes:** This is the wedge. Macro trackers don't do it. Recipe apps don't do it. Suppr's planner gets close but you have to leave Today. The Today hero should *suggest from your library* in real time as you log. "Dinner could hit" gated suggestions exists per memory — it should be the centrepiece, not a gated card.
**Cost:** Threading the planner scoring into Today's render path. Two weeks.
**Lands in:** Today, replacing one of the macro tile rows.

### 3. Trust posture on every diary row

**Why it's table-stakes:** Nutrition apps live or die on whether users believe the numbers. Suppr is *better than competitors* at this (verified pipeline, source attribution, confidence dots) but it is **uneven across surfaces** — the planner-row "estimated · verify" chip from P1-19 exists, but the same posture is patchy in Quick Add, in saved meals, in voice/photo. Make it consistent everywhere.
**Cost:** Small. It's mostly UI consistency on existing data.
**Lands in:** Every row that displays macros — diary, planner, recipe ingredients, saved meals, voice/photo review.

### 4. A "this is what changed" weekly story on Progress

**Why it's table-stakes:** MacroFactor's recap is the gold standard — "your maintenance calories adjusted up by 80, here's what we observed". The data is in the adaptive TDEE engine. The narrative isn't built. Best-day-by-protein and weight delta are stat-card thinking, not story thinking.
**Cost:** Three weeks of design + content + edge-case handling.
**Lands in:** Progress as the primary surface — *not* a card on Today.

### 5. Onboarding that produces a first plan, not just a target

**Why it's table-stakes:** Onboarding v2 just landed (per memory, deletion countdown for legacy). The current end-state is "you have a target, now go figure out the app." Best-in-class onboarding ends with the user having a working artifact — for Suppr, that's their first auto-generated week, populated from 5-10 saved recipes the onboarding helped them pick.
**Cost:** Two weeks. Reuses Discover + planner.
**Lands in:** End of onboarding flow. First-run state on Today + Plan.

---

## 4. What gets reordered

### Tabs: 6 → 4

**Today / Recipes / Plan / You.**

- **Today** — daily log, macros, water, what-to-eat-next suggestion. (Steals from current Today + Quick add.)
- **Recipes** — Library + Discover merged. Default tab is your saved (per the 2026-04-26 tester feedback that own collection should be more prominent — that fix is correct, but the answer is to merge, not to add a sixth tab). Discover lives as a second segmented sub-tab inside Recipes.
- **Plan** — weekly planner + shopping list. Shopping is a sub-view of Plan, not a hidden screen.
- **You** — Progress + Settings + everything in More. The current "Progress" tab and "More" tab are both about the user. Merge them. Progress is the primary content; settings/account/legal/help are below.

**What this kills:** the 6-tab anxiety, the "Library is hard to find" problem (it's the default of Recipes), the "Progress vs More" indecision.

### Things that move out of primary nav into Recipes or You

- Cook Mode → still launched from a recipe (no change).
- Household → behind a Settings flag in You.
- Notifications, search, barcode → entry points stay where they're useful (Today FAB, Recipes search), they don't need top-level slots.

### Things that move *up*

- The "what should I eat now" suggestion. Currently a gated card. Should be a permanent block on Today — the second thing the eye lands on after the day's progress.

---

## 5. The Today hero call

**Ship one canonical Today. Kill the three-variant choice.**

The fact that there are three variants is not pluralism, it is design indecision. Linear didn't ship three inboxes. Things didn't ship three task views. Strava didn't ship three feeds. They picked, and they argued for it.

**The canonical Today:**

1. **Day strip** (existing, keep).
2. **Calorie hero** — single ring, big, with remaining number front and centre. No streak ribbon. No motivational copy.
3. **What to eat next** — one suggested recipe from the user's library that fits the remaining macros for the next slot. One. Not three. Tap to log, swipe to skip.
4. **Macros remaining bar** — protein/carbs/fat (+ fibre when set). Amber over-budget per existing rule.
5. **Meals** — the day's logged meals.
6. **Persistent Log FAB.**

Hydration card, steps card, adaptive hint, weekly recap card — all behind progressive disclosure rules that already exist (M4). They are not the hero.

**Why one not three:** A macro tracker that lets you choose your dashboard is a macro tracker that has not decided what mattered. We can A/B later when we have N>1. Today, with N=1, picking is a hedge, not a feature.

**Reconsider on:** if external research (3+ users) consistently asks for a different primary view, revisit. Don't revisit on internal taste disagreements.

---

## 6. The north-star surface

**"What to eat next, from your own library, that hits your remaining macros."**

Not Today as a whole. Not the planner. Not the recipe detail. The single moment where Suppr does something neither a macro tracker nor a recipe app does:

> It's 6pm. Suppr looks at what you've eaten, what's in your library, your remaining macros, and says: "Sheet pan chicken hits your macros within 3%. Cook this." One tap to start cook mode. One tap to log when done.

**Why this:**

- MacroFactor cannot do this — it doesn't have your recipes.
- Mob/Paprika cannot do this — they don't know your macros.
- MFP cannot do this — it doesn't have curated recipes you trust.
- The data exists. The planner scoring exists. The recipe loop exists. The integration is what's missing.

**This is the demo.** Every screenshot, every TestFlight description, every landing-page hero should be this moment. If a feature doesn't make this moment better, it's not a launch feature.

---

## 7. Where the product is hedged today

Seven hedges. One call for each.

1. **Macro tracker vs recipe app vs creator network.** → Macro tracker that uses recipes as the input layer. Creator network is a future product, not a v1 surface.
2. **Six tabs vs five vs four.** → Four. (Section 4.)
3. **Three Today hero variants.** → One. (Section 5.)
4. **Web vs mobile.** → Mobile is the primary surface. Web is the long-form companion (recipe import, planner editing, account management). Stop trying to build mobile-grade tracking on web. Web is for sit-down work; mobile is for the daily loop.
5. **Free vs Base vs Pro.** → Two tiers. Free + Pro. Base is a hedge against churn that obscures the value prop. The £3.99/£7.99 split is testing two prices on no users; collapse to one Pro at one annual price (£59.99/yr, £7.99/mo) and remove Base.
6. **Adaptive TDEE confidence-gated vs always-on.** → Always show the user what the engine sees. Confidence is metadata, not gating. The user is an adult; tell them "we think your maintenance is X with medium confidence" and let them choose.
7. **"We support every dietary preference" vs allergen depth.** → Pick one allergen and do it brilliantly (gluten — coeliac is the most acute case). The current "we tag eight diets" is breadth-without-depth, which is the worst of both worlds.

---

## 8. The 90-day path to "best-in-class"

90 days is not enough to do everything. It is enough to do the right things.

### Weeks 1-4: Cut and consolidate

- Collapse to 4 tabs (`apps/mobile/app/(tabs)/_layout.tsx` + web equivalent).
- Merge Library + Discover into Recipes with sub-tabs.
- Merge Progress + More into You.
- Demote household behind a Settings flag.
- Remove caffeine + alcohol from Today; move behind Settings opt-in.
- Collapse pricing to Free + Pro. Base goes away. (Owner: monetisation-architect; needs Stripe/RevenueCat reconfiguration.)
- Pick one canonical Today; delete the other two variants.
- Streak shrinks to a pip; recap stays as a Sunday card.

**Outcome:** the surface area shrinks by ~30%. Nothing user-meaningful is lost.

### Weeks 5-8: Build the north-star moment

- "What to eat next" engine on Today: planner scoring threaded into the daily render path. One suggested recipe at a time, swipeable.
- Onboarding ends with a populated first week (5-10 recipes selected during onboarding seed Plan + Library).
- Trust posture (estimated/verify chip) consistent on every macro row across web + mobile.
- One canonical Log FAB + sheet replacing the current 8 entry points.

**Outcome:** the demo moment exists. We can show it.

### Weeks 9-12: Sharpen Progress as a story

- Adaptive TDEE recap line as the headline of Progress, not a card on Today.
- Weight + maintenance trend with the engine's commentary ("we adjusted up by 60 kcal this week — your average intake on weeks you lost weight was X").
- One allergen done brilliantly (coeliac/gluten). Ingredient-level filter, confidence flag on every recipe.
- TestFlight expansion: this is when we open beyond N=1, because the core loop now justifies showing it.

**Outcome:** retention story has actual content. Honest, factual, not motivational.

### What is NOT in 90 days

- Multi-format creator authoring.
- Friends graph, plan sharing, partner sync.
- Affiliate/commerce.
- Android Health Connect.
- Strava/Garmin partner APIs.
- Apple Watch + iOS widget native target.
- Net-carbs lens UI rollout.
- Web push.
- Web HealthKit-equivalent (does not exist; manual is fine).

These are post-90-day. Saying so out loud is the point of this doc.
