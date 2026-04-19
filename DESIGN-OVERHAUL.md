# Suppr Design Overhaul: Spec + Implementation Brief

> **Purpose:** This document is both a design direction spec and an actionable implementation prompt. Use it to guide a ground-up visual and UX redesign of Suppr across web (Next.js) and mobile (Expo/React Native).

> **Positioning:** The first app that lets you import recipes from your favourite social media creators (TikTok, Instagram, YouTube, Pinterest) AND gives you full MFP-level macro tracking with intelligent auto-fitting to your daily targets. ReciMe proved people want social recipe saving. MFP proved people want macro tracking. Nobody has fused them. Suppr does. And with its built-in discovery feed and creator publishing tools, Suppr is building toward becoming the LTK of food — a creator commerce platform where food creators publish macro-calculated recipes and build audiences, not just a tracking tool.

> **Audience:** Health-conscious home cooks who discover recipes on social media, meal preppers, macro trackers, food content creators, and anyone who wants to cook what they actually find inspiring — whether from TikTok or from creators publishing natively on Suppr. Appeals equally to men and women.

> **Platform evolution:** Tool → Network → Marketplace. Phase 1: best-in-class import + tracking. Phase 2: discovery feed with seeded + user-published recipes. Phase 3: creator platform with audience-building, analytics, and eventually monetisation (brand partnerships, affiliate ingredients, sponsored recipes).

---

## 1. Competitive Landscape & Where We Win

### What competitors do well (and we must match)

| Competitor | What they nail | Where they stop short |
|---|---|---|
| MyFitnessPal | Barcode scan + photo logging in 2-3 taps. Massive food database. | No real recipe experience. Can't import from social media. Recipes are an afterthought bolted onto a calorie counter. |
| Lose It! | Approachable onboarding. Non-intimidating first session. | Shallow nutrition data. Macro tracking feels secondary to calories. No recipe import pipeline. |
| Cronometer | Micronutrient depth. Scientific accuracy. Trusted by dietitians. | Steep learning curve. No social recipe import. UI overwhelms casual users. |
| MacroFactor | Adaptive macro targets. Algorithm-driven coaching. Premium feel. | No recipe ecosystem at all. Pure tracking tool. $20+/mo pricing. |
| ReciMe | Social media recipe import from TikTok, Instagram, YouTube, Pinterest. 10M+ users. Folder organisation. | Basic calorie calculation only. No real macro tracking. No auto-fitting recipes to daily targets. No meal planning that respects your macros. The nutrition side is an afterthought. |
| LTK | Creator commerce platform. $5B+ annual sales. Creators build audiences, earn commissions. Proven model for creator-driven discovery. | Fashion/lifestyle only — no food vertical. But the model (creator publishes → audience discovers → platform facilitates) is exactly what Suppr's discovery feed can become for food. |

### The gap nobody fills

ReciMe proved that millions of people discover and save recipes from social media creators — not from nutrition app recipe libraries. But ReciMe stops at saving. It doesn't give you MFP-level macro tracking, it doesn't auto-fit meals to your targets, and it doesn't tell you "this TikTok pasta recipe hits 80% of your remaining carb budget for the day."

Meanwhile, MFP/Cronometer/MacroFactor have deep tracking but zero social recipe import. You can't forward a TikTok reel to MFP and have it parse the recipe, calculate macros, and slot it into your meal plan.

**Suppr sits in the middle — and owns it.**

### Where every competitor also falls short (additional openings)

1. **Desktop is an afterthought.** Every competitor is mobile-first with a neglected web experience.
2. **Logging is a chore, not a moment.** The act of logging feels transactional, not satisfying.
3. **One-size-fits-all UI density.** Power users want data density; casual users want simplicity. Nobody lets you choose.
4. **No confidence signals.** Users never know if a food match is accurate or a rough guess.

### Suppr's differentiators to protect and amplify

- **Social recipe import pipeline** — forward/share recipes from TikTok, Instagram, YouTube, Pinterest, Facebook. AI parses the video/post, extracts ingredients and steps, calculates full macro breakdown with confidence scoring. This is the killer feature.
- **Auto-fit to macros** — "I want to make this TikTok recipe for dinner" → Suppr shows how it fits your remaining daily macros, suggests portion adjustments, or proposes complementary meals to balance the day.
- AI photo + voice logging (already built — make it the hero)
- Recipe-to-log pipeline (cook it → log it in one tap)
- Count-to-weight normalisation with confidence scoring
- Cook mode with timers and scaling
- Cross-platform parity (web and mobile are equals)

---

## 2. Design Principles

These govern every decision. When in doubt, refer back here.

1. **Food is the hero, not the interface.** The UI should feel like it disappears. Content — recipes, ingredients, nutrition data — should dominate the visual hierarchy.

2. **Two taps or less for the daily loop.** Logging breakfast should never take more than two taps from the home screen. Friction kills compliance.

3. **Confidence over completeness.** Show users how certain we are about a food match. A confident 90% match is better than a shaky 100% guess. Use visual confidence indicators everywhere nutrition data appears.

4. **Light and dark are equal citizens.** Neither mode is an afterthought. Light mode: warm, airy, food-photography-forward. Dark mode: premium, data-dense, cinematic. Both must feel intentional and polished.

5. **Progressive disclosure.** Casual users see calories and a simple ring. Power users can drill into 40+ micronutrients. The UI adapts to the user, not the other way around.

6. **Motion with purpose.** Every animation communicates state change or provides feedback. No decorative motion. Transitions should feel swift and physical — never floaty or slow.

7. **Cross-platform coherence, not cloning.** Web and mobile share the same design language but respect platform conventions. Web gets hover states, keyboard shortcuts, and spatial layouts. Mobile gets gestures, haptics, and compact density.

---

## 3. Visual Language

### 3.1 Color System

Move away from the current near-black primary (#030213) and generic grays. Build a palette rooted in food and nature that works across both modes.

**Light mode palette:**
- Background: warm white `oklch(0.985 0.005 80)` — not sterile blue-white, slightly warm
- Surface: `oklch(0.97 0.003 80)` — cards, panels
- Surface elevated: `oklch(1.0 0 0)` — pure white for modals, popovers
- Text primary: `oklch(0.20 0.02 50)` — warm near-black, not pure black
- Text secondary: `oklch(0.45 0.01 50)` — muted warm gray
- Text tertiary: `oklch(0.60 0.008 50)` — hints, timestamps
- Border: `oklch(0.90 0.005 80)` — barely visible, warm

**Dark mode palette:**
- Background: `oklch(0.13 0.01 280)` — deep charcoal with faint cool undertone
- Surface: `oklch(0.17 0.01 280)` — cards, panels
- Surface elevated: `oklch(0.21 0.01 280)` — modals, popovers
- Text primary: `oklch(0.93 0.005 80)` — warm off-white
- Text secondary: `oklch(0.65 0.005 80)` — muted
- Text tertiary: `oklch(0.50 0.005 80)` — hints
- Border: `oklch(0.25 0.008 280)` — subtle

**Accent colors (shared across modes):**
- Primary action: `oklch(0.55 0.18 145)` — rich green (fresh, natural, food-adjacent). Use for primary buttons, active states, progress indicators.
- Secondary action: `oklch(0.65 0.14 55)` — warm amber. Use for highlights, warnings, streaks.
- Destructive: `oklch(0.55 0.20 25)` — muted red. Errors, deletions.
- Info: `oklch(0.60 0.14 250)` — calm blue. Tips, coaching.

**Macro colors (consistent everywhere):**
- Protein: `oklch(0.60 0.18 250)` — blue
- Carbs: `oklch(0.65 0.18 55)` — amber/gold
- Fat: `oklch(0.58 0.18 330)` — rose/pink
- Calories: primary action green

**Confidence indicators:**
- High (≥85%): primary green
- Medium (60-84%): amber
- Low (<60%): muted red with "verify" prompt

### 3.2 Typography

Use a modern geometric sans-serif with excellent readability at all sizes. Recommended: **Inter** (already widely available, excellent for data-heavy UIs) or **Geist** (Vercel's typeface — pairs well with Next.js ecosystem).

**Type scale (modular, 1.2 ratio):**
- Display: 2.25rem / 700 weight — hero numbers (daily calories, weekly summary)
- H1: 1.75rem / 600 — page titles
- H2: 1.25rem / 600 — section headers
- H3: 1.0rem / 600 — card titles
- Body: 0.9375rem (15px) / 400 — default text
- Caption: 0.8125rem (13px) / 400 — metadata, timestamps
- Overline: 0.6875rem (11px) / 500 / uppercase / letter-spacing 0.08em — labels, categories

**Numeric display:** Use tabular (monospaced) figures for all nutrition numbers so columns align. If using Inter, enable `font-variant-numeric: tabular-nums`.

### 3.3 Spacing & Layout

**Grid:**
- 4px base unit. All spacing is multiples of 4.
- Mobile: 16px page margins. 12px between cards. 8px internal card padding.
- Web: 24px page margins. 16px between cards. 16px internal card padding.
- Max content width on web: 1120px centered. Sidebar: 280px.

**Border radius:**
- Small elements (chips, badges): 6px
- Cards: 12px
- Modals/sheets: 16px
- Full-round (avatars, FABs): 50%

**Elevation (dark mode uses border tinting, not shadows):**
- Light mode: subtle warm shadows. `0 1px 3px oklch(0.20 0.02 50 / 0.08)` for cards. `0 8px 24px oklch(0.20 0.02 50 / 0.12)` for modals.
- Dark mode: no box-shadow. Use 1px border in surface-elevated color + slightly lighter background.

### 3.4 Iconography

Continue with Lucide icons but enforce a consistent weight and size:
- Navigation icons: 24px, 1.5px stroke
- Inline icons: 16px, 1.5px stroke  
- Action icons (buttons): 20px, 1.75px stroke
- No filled icons except for active navigation states

### 3.5 Motion

**Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` — fast-in, gentle-out. Feels snappy and physical.

**Durations:**
- Micro (color change, opacity): 120ms
- Small (expand/collapse, tooltips): 200ms
- Medium (page transitions, modals): 300ms
- Large (sheet slides, onboarding): 400ms

**Signature interactions:**
- Logging a food: ring fills with a satisfying arc animation + subtle haptic on mobile
- Completing a meal: card gently settles into place with a 1px scale bounce
- Reaching a macro target: number counter ticks up to final value

---

## 4. Core Screen Redesigns

### 4.1 Home / Dashboard

**Current problem:** Generic dashboard that tries to show everything. No clear daily narrative.

**New approach — "Today" view:**

The home screen tells the story of your day. It's a single scrollable column (mobile) or a two-column layout (web: main + sidebar).

**Layout (top to bottom):**

1. **Greeting bar** — "Good morning, Grace" + date. Minimal. No heavy header.

2. **Daily ring** — A single, large, animated ring showing calorie progress. Tap to expand into macro breakdown (protein/carbs/fat as concentric arcs). This is the emotional anchor of the app.
   - Below the ring: remaining calories in large display type
   - Macro pills underneath: P: 45g / 150g | C: 120g / 250g | F: 30g / 65g
   - Each pill uses the macro color as a subtle progress fill behind the text

3. **Quick log strip** — Horizontal row of action chips: 📷 Photo | 🎤 Voice | 🔍 Search | 📊 Barcode | ⭐ Favorites
   - This is always visible. It's the fastest path to logging.
   - On mobile: sticky at bottom of screen as a floating bar (not tab bar — the tab bar is separate)

4. **Meal timeline** — Vertical timeline of meals logged today (Breakfast → Lunch → Dinner → Snacks). Each meal is a card:
   - Collapsed: meal name + total calories + food count + time
   - Expanded: individual foods with per-item calories and confidence badges
   - Empty meals show a ghost card: "Tap to log breakfast" with suggested foods based on history
   - Swipe left to delete a food. Long press to edit.

5. **Today's recipe** (if meal plan exists) — Card showing the next meal to cook from the plan. Photo, prep time, macro summary. "Start cooking" button leads to cook mode.

6. **Insights strip** — One contextual insight per day, rotated: "You've hit your protein goal 5 days in a row" or "Today's dinner is 200kcal under target — add a snack?"

**Web sidebar (right):**
- Weekly calorie trend (sparkline)
- Water intake tracker
- Upcoming meal plan
- Quick links: recipes, shopping list

### 4.2 Food Logging Flow

**Current problem:** Too many steps between intent and logged food.

**New approach — converged input:**

One unified logging screen with multiple input modes. The screen opens with a large search field at top + input mode switcher below it.

**Flow:**

1. User taps any quick-log chip (or the "+" FAB on mobile)
2. **Logging sheet** slides up (mobile) or opens as a panel (web):
   - Large search field, auto-focused, keyboard open
   - Below search: mode tabs — Search | Scan | Photo | Voice | Recent | Favorites
   - Recent items appear immediately (no typing needed for repeat meals)
3. **Search results** show:
   - Food name + brand (if applicable)
   - Per-serving calories in bold
   - Confidence badge (green/amber/red dot)
   - Source label (USDA, Open Food Facts, User-created)
4. **Tap a result** → portion selector:
   - Smart defaults based on user history ("you usually log 1 cup")
   - Slider for quantity
   - Unit picker: grams | oz | cups | tbsp | pieces | serving
   - Live-updating macro preview as you adjust
5. **Confirm** → food logged, sheet dismisses, ring animates

**Target: 2 taps for a recent/favorite food. 3 taps for a search result. Under 5 seconds for the common case.**

### 4.3 Social Recipe Import (The Killer Feature)

**This is what nobody else does.** ReciMe lets you save recipes from social media but doesn't track macros. MFP tracks macros but can't import from TikTok. Suppr does both.

**Import flow — "Share to Suppr":**

1. User sees a recipe on TikTok, Instagram, YouTube, or Pinterest
2. Taps the native share button → selects Suppr (or copies link and pastes in-app)
3. Suppr receives the URL and shows a **processing card** with a shimmer animation:
   - AI extracts the recipe from the video/post/reel (ingredients, quantities, steps)
   - Matches each ingredient to the nutrition database (USDA, Open Food Facts)
   - Calculates full macro breakdown per serving
   - Assigns confidence scores to each ingredient match
4. **Import result screen** appears:
   - Recipe title + thumbnail pulled from the source
   - Creator attribution with link back to original post
   - Parsed ingredients list — each with a confidence badge. Amber/red items have an "edit" affordance so the user can correct the match.
   - Full macro summary: calories, protein, carbs, fat per serving
   - **"How this fits your day"** panel: shows how adding this recipe to today's plan affects remaining macros. e.g. "This uses 45% of your remaining carbs. Pair with a high-protein snack to balance."
5. User taps **Save** → recipe goes to their library, organised by folder/tag
6. Optional: **"Add to meal plan"** → slot it into a specific day/meal. Suppr auto-adjusts surrounding meals to keep daily macros on target.

**In-app browser (fallback):**
- For platforms where share-to-app isn't frictionless, Suppr has a built-in browser
- User pastes a URL or browses TikTok/Instagram within the app
- Tap "Import this recipe" on any page showing a recipe

**Supported sources (launch):**
- TikTok (video recipes, recipe posts)
- Instagram (reels, posts, stories with recipe content)
- YouTube (cooking videos with description/comments containing ingredients)
- Pinterest (recipe pins)
- Any website with structured recipe data (schema.org Recipe markup)
- Screenshots / photos of handwritten recipes (AI OCR extraction)

**What makes this better than ReciMe:**
- Full macro breakdown, not just calories
- Confidence scoring on every ingredient match — user knows what's accurate vs estimated
- Auto-fitting to daily macro targets — "this recipe leaves you 30g short on protein, here's a suggestion"
- One-tap logging after cooking — the recipe is already nutrition-calculated, so logging it is instant
- Meal plan integration — import a week of creator recipes and Suppr builds a macro-balanced plan around them

### 4.4 Recipe Library & Detail

**Recipe card:**
- Full-bleed photo (hero image, pulled from source or user-uploaded)
- Title overlaid at bottom with gradient scrim
- Source badge: small icon showing where it came from (TikTok, Instagram, YouTube, web, manual)
- Below photo: prep time | cook time | servings | difficulty
- Macro summary bar (same visual language as daily ring)
- Confidence score for the nutrition calculation

**Recipe detail page:**
- Tabbed: Overview | Ingredients | Steps | Nutrition
- **Overview:** photo, description, original creator attribution with link to source post. Ratings.
- **Ingredients:** each ingredient shows its individual macro contribution as a subtle inline bar. Users can see that the olive oil contributes most of the fat at a glance. Tap an ingredient to see its USDA match and confidence. Edit to correct.
- **Steps:** clean numbered steps (extracted from video/post by AI, editable by user). In cook mode, these become full-screen cards with timers.
- **Nutrition:** full breakdown — macros, micros, per-serving and per-recipe. Comparison view: "How does this recipe compare to your typical lunch?" Confidence summary: "87% of ingredients are high-confidence matches."

**Recipe → Log bridge:**
- "I made this" button on every recipe
- Tap it → select servings eaten → logged instantly
- If you modified the recipe (swapped ingredients), the app recalculates and shows a diff

**Cook mode redesign:**
- Full-screen, distraction-free
- One step per screen, large type (readable at arm's length from a kitchen counter)
- Swipe to advance steps
- Floating timer that persists across steps
- Voice control: "next step", "start timer", "repeat"
- Wake-lock: screen doesn't sleep during cooking

### 4.6 Discovery Feed & Creator Platform

**What exists today:** A discovery feed seeded with curated recipes from internet sources, properly credited. Users can also create their own recipes and either save them privately or publish them (with copyright declaration). This is the foundation for a much bigger play.

**Current state → near-term → long-term vision:**

| Phase | Feed content | Creator tools | Monetisation |
|---|---|---|---|
| Now | Seeded/curated recipes from credited internet sources + user-published recipes | Create recipe, save private or publish (with copyright declaration) | None |
| Near-term | Mix of seeded, imported (social media), and growing user-published content. Algorithmic ranking by macro-fit, dietary preference, popularity | Creator profiles, follower counts, recipe analytics (views, saves, "I made this" count), recipe collections | None yet |
| Long-term (LTK model) | Creator-driven feed. Top creators build audiences. Suppr becomes where food creators publish, not just cross-post | Full creator dashboard: audience demographics, engagement analytics, earnings. Verified creator programme. Brand collaboration tools | Affiliate ingredient links, sponsored recipes, brand partnerships, creator subscriptions |

**Discovery feed design:**

The feed is NOT a traditional social media timeline. It's a recipe discovery surface optimised for "what should I cook that fits my macros?"

**Feed layout:**
- **Mobile:** Single-column, full-width recipe cards. Swipe vertically to browse. Pull-to-refresh.
- **Web:** Masonry grid (2-3 columns) for visual density. Infinite scroll.

**Each recipe card shows:**
- Hero photo (full-bleed on mobile, large thumbnail on web)
- Recipe title + creator name/avatar (or source attribution for seeded recipes)
- Source badge (Suppr original, imported from TikTok, etc.)
- Macro summary pills (P/C/F per serving)
- **Macro fit indicator** — personalised to the viewer: "Fits your dinner budget" (green) or "High carb for your targets" (amber). This is the differentiator vs every other recipe feed. Every card tells you how it fits YOUR day.
- Save button (bookmark icon) + "I want to make this" button
- Engagement signals: save count, "I made this" count

**Feed filtering & intelligence:**
- Filter tabs: For You | Popular | Quick (<30 min) | High Protein | Low Carb | [custom tags]
- "For You" uses: dietary preferences, macro targets, remaining daily budget, past saves, cuisine preferences
- "Fits your remaining macros" filter: show only recipes that work for dinner tonight given what you've already eaten

**Creator profiles (published recipes):**
- Profile page: avatar, bio, recipe count, follower count, total "I made this" count
- Recipe grid (their published recipes)
- "Follow" button — their new recipes appear in your For You feed
- Creator badge for verified/prolific publishers

**Publishing flow:**
- Create recipe manually OR import from social media → edit → publish
- Copyright declaration checkbox required
- Nutrition auto-calculated with confidence score shown to creator before publish
- Optional: add creator notes, difficulty rating, dietary tags, prep tips
- Published recipes are discoverable in the feed; private recipes stay in personal library only

**What makes this the LTK of food (long-term):**
- Creators build a following around their recipes — real audience, not just likes on a TikTok that disappears
- Every recipe has built-in nutrition accountability — creators can't publish junk-macro recipes without it being visible
- The feed is personalised by nutrition fit, not just engagement — so a high-protein creator naturally reaches the right audience
- Future monetisation: affiliate links on ingredients ("buy this exact olive oil on Amazon"), brand-sponsored recipe challenges, creator subscription tiers for exclusive recipes/meal plans

### 4.7 Meal Planning

**Weekly view:**
- 7-column grid (web) or horizontal scrollable day cards (mobile)
- Each day shows planned meals as stacked cards with photos
- Drag to reorder or move meals between days (web). Long-press to move (mobile).
- Daily macro totals at the bottom of each column
- "Auto-fill" button: AI generates a day/week based on macro targets, preferences, and pantry

**Shopping list (generated from plan):**
- Grouped by aisle/category
- Quantities auto-aggregated across recipes
- Checkboxes for in-store use
- "Share" to send as text/email

### 4.8 Progress & Insights

**Current problem:** Basic charts that don't tell a story.

**New approach — narrative analytics:**

- **Weekly report card:** a single summary screen showing: calories vs target (bar chart), macro adherence (%, with trend arrows), body weight trend (if tracked), streak count, one AI-generated insight
- **Trends tab:** line charts for weight, calories, individual macros over 7d / 30d / 90d. Each chart has annotation markers for notable events (started new plan, hit goal, etc.)
- **Nutrient deep-dive:** for power users. Toggle on from settings. Shows micronutrient targets like Cronometer but with a cleaner, less overwhelming presentation — grouped by category (vitamins, minerals, electrolytes) with expandable sections.

### 4.9 Onboarding

**Goal: first food logged in under 60 seconds.**

1. Welcome screen — "Suppr helps you cook better and eat smarter." One sentence. One CTA.
2. Goal selection — lose weight | maintain | gain | eat healthier | track for medical reasons. Single tap.
3. Quick profile — age, height, weight, activity level. One screen, four inputs.
4. Macro targets generated — shown as the daily ring preview. "We recommend 2,100 kcal. Adjust?"
5. First log — "What did you eat today?" with photo/voice/search options front and center.
6. Done. User is on the home screen with their first food logged and the ring partially filled.

No account creation required upfront. Delay sign-up until the user has experienced value.

---

## 5. Component Architecture

### New / redesigned components needed

| Component | Description | Used in |
|---|---|---|
| `DailyRing` | Animated circular progress for calories + expandable macro arcs | Home, widgets |
| `MacroPill` | Inline macro display with progress fill | Home, recipe cards, logging |
| `ConfidenceBadge` | Green/amber/red dot + label for food match certainty | Search results, ingredients, recipe nutrition |
| `MealCard` | Collapsible meal entry with food list, swipe actions | Home timeline |
| `QuickLogBar` | Floating action strip with input mode chips | Home (sticky), tab bar area |
| `FoodSearchSheet` | Bottom sheet (mobile) / side panel (web) with converged search | Logging flow |
| `PortionSelector` | Slider + unit picker with live macro preview | Logging flow |
| `SocialImportSheet` | Share-extension / URL-paste flow with processing animation | Recipe import |
| `ImportResultCard` | Parsed recipe preview with ingredient matches, confidence, and macro-fit panel | Recipe import |
| `MacroFitPanel` | "How this fits your day" visualization showing remaining macro budget impact | Recipe import, meal planning |
| `SourceBadge` | Small platform icon (TikTok, Instagram, YouTube, etc.) on recipe cards | Recipe library, meal plan |
| `RecipeHero` | Full-bleed image card with overlay text, source badge, and macro bar | Recipe browsing, meal plan |
| `IngredientRow` | Ingredient with inline macro contribution bar + confidence + edit affordance | Recipe detail |
| `CookModeStep` | Full-screen step card with large type, timer, voice control | Cook mode |
| `WeeklyPlanGrid` | 7-column draggable meal plan with daily macro totals | Meal planning |
| `FeedCard` | Discovery feed recipe card with hero image, creator attribution, macro pills, and personalised fit indicator | Discovery feed |
| `MacroFitIndicator` | Personalised "fits your dinner budget" / "high carb for your targets" label per recipe | Feed cards, search results, meal planning |
| `CreatorProfile` | Profile page with avatar, bio, recipe grid, follower count, follow button | Creator profiles |
| `CreatorBadge` | Verified/prolific publisher badge | Feed cards, recipe detail, profiles |
| `PublishFlow` | Recipe publish sheet with copyright declaration, tags, difficulty, preview | Recipe creation |
| `InsightCard` | Contextual tip/achievement with icon and action | Home, progress |
| `TrendChart` | Line/bar chart with annotation markers and period selector | Progress |
| `NutrientGroup` | Expandable micronutrient category with target bars | Nutrition deep-dive |
| `AdaptiveHeader` | Greeting + date that collapses on scroll | Home |

### Design tokens to update

Update `/src/styles/theme.css` with the new color system, type scale, spacing, radius, and motion values defined in Section 3. Ensure all tokens have both light and dark variants using CSS custom properties and the existing `dark:` class approach.

---

## 6. Implementation Priorities

### Phase 1: Foundation (do first)
1. New color system + typography + spacing tokens in theme.css
2. Light/dark mode refinement with warm palette
3. DailyRing component (the emotional core of the app)
4. QuickLogBar + FoodSearchSheet (the functional core)
5. Redesigned home screen ("Today" view)
6. Updated onboarding flow

### Phase 2: Social Recipe Import (the killer differentiator)
7. Share extension / URL paste import flow (mobile + web)
8. AI recipe extraction from TikTok, Instagram, YouTube, Pinterest URLs
9. Ingredient → nutrition database matching with confidence scoring
10. Import result screen with macro breakdown and "how this fits your day" panel
11. Recipe library with source badges and folder organisation

### Phase 3: Recipe Excellence
12. RecipeHero + recipe detail page redesign with creator attribution
13. Ingredient-level macro visualization with edit affordance
14. "I made this" → instant log bridge
15. Cook mode redesign (full-screen, voice, wake-lock)
16. Auto-fit: suggest portion adjustments / complementary meals to hit macro targets

### Phase 4: Intelligence & Delight
17. Meal planning weekly grid with drag-and-drop
18. AI auto-fill for meal plans (using imported + saved recipes)
19. Progress/insights narrative redesign
20. Streak and achievement system
21. Confidence indicators throughout

### Phase 5: Polish & Parity
22. Web ↔ mobile audit for feature parity
23. Keyboard shortcuts and power-user features (web)
24. Gesture system audit (mobile)
25. Accessibility audit (WCAG AA minimum)
26. Performance audit (Core Web Vitals, app startup time)

---

## 7. Non-Negotiables Checklist

Before shipping any phase, verify:

- [ ] Both light and dark modes look intentional and polished
- [ ] No feature exists on web that doesn't exist on mobile (and vice versa)
- [ ] Food logging takes ≤2 taps for recent/favorite items
- [ ] Every nutrition number has a confidence indicator
- [ ] Typography uses tabular figures for all numbers
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Color contrast meets WCAG AA in both modes
- [ ] Touch targets are ≥44px on mobile
- [ ] Tests are updated for every changed component
- [ ] Documentation reflects the new design system

---

## 8. What "Winning" Looks Like

Suppr wins when:

- A ReciMe user switches because they want actual macro tracking on the recipes they import — not just a calorie estimate
- A MyFitnessPal user switches because they can finally import the TikTok recipes they actually cook, instead of manually searching for "chicken pasta" and hoping the macros are close
- A Cronometer user switches because the recipe experience is better without sacrificing data depth
- Someone sees a recipe on Instagram, shares it to Suppr, and 10 seconds later knows exactly how it fits their macros for the day — then adds it to their meal plan with one tap
- A home cook who never tracked nutrition starts because importing recipes from their favourite creators is so easy they don't realize they're "tracking"
- The web experience is so good that users prefer it for meal planning, while mobile handles on-the-go logging and social media imports
- Users say "it just feels good to use" — the motion, the feedback, the confidence signals all create a sense of trust and craft
- A food creator chooses to publish on Suppr instead of just TikTok because their audience here actually *cooks* their recipes — and they can see the "I made this" count to prove it
- The discovery feed becomes a destination: users open Suppr not just to log, but to browse what creators are posting and find tonight's dinner
- The short pitch: **"Import any recipe from TikTok or Instagram, and Suppr tells you exactly how it fits your macros."**
- The platform pitch: **"The place where food creators publish recipes and health-conscious people actually cook them — with full nutrition tracking built in."**

---

---

## 9. Implementation Status (design/overhaul-v2 branch)

_Last updated: 2026-04-13_

### Phase 1: Foundation — COMPLETE

| Deliverable | Status | Notes |
|---|---|---|
| New color system in `theme.css` | Done | Full light/dark CSS custom properties. Primary #4c6ce0, success #22a860, warning #e8a020, destructive #e04848. Macro colours: protein (blue), carbs (amber), fat (pink), calories (green). |
| Typography (Inter, modular scale) | Done | `fonts.css` + `layout.tsx` wired via `next/font/google`. Tabular nums enabled. |
| Centralised icon system | Done | `ui/icons.ts` — ~90 semantic names → lucide-react. Single import point for all features. |
| `IconBox` tinted container | Done | `ui/icon-box.tsx` — cva variants for size (sm/md/lg/xl) and tone (primary/success/warning/destructive/protein/carbs/fat/muted/ghost). |
| `DailyRing` SVG progress ring | Done | `suppr/daily-ring.tsx` — animated circular progress for calorie target. |
| `MacroCard` colour-coded macro display | Done | `suppr/macro-card.tsx` — compact + full modes with progress bar. |
| `ConfidenceDot` indicator | Done | `suppr/confidence-dot.tsx` — high (green), medium (amber), low (red). |
| ~~`FitBadge` macro-fit pill~~ | Removed | Build 10 F-11 (2026-04-19, TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`) — tester reported the score felt irrelevant. Component + file deleted; no ranking consumed it. |
| `SourceBadge` platform origin | Done | `suppr/source-badge.tsx` — Instagram, TikTok, YouTube, Pinterest, Web, User. |
| Barrel export | Done | `suppr/index.ts` |
| Home "Today at a Glance" | Done | `TodayAtAGlance.tsx` — DailyRing + MacroCard grid + fiber/water tiles. |
| TrackerSummaryCard redesign | Done | Uses IconBox + Icons + semantic tokens. |
| CalorieDeficitInsight redesign | Done | Uses IconBox + Icons + section-label utility. |

### Design component wiring into feature screens — COMPLETE

| Screen | Components wired | Notes |
|---|---|---|
| NutritionTracker | Icons, IconBox, semantic tokens | ~130 hardcoded colours replaced. |
| DiscoverFeed | SourceBadge, Icons, IconBox | FitBadge removed in build 10 F-11 (2026-04-19). SourceBadge shows when `sourcePlatform` set on recipe. |
| RecipeDetail | MacroCard, ConfidenceDot, Icons | Macro grid uses MacroCard compact. Ingredients show ConfidenceDot per verification status. |
| MealPlanner | DailyRing, MacroCard, Icons | Daily summary uses DailyRing + MacroCard grid for P/C/F. |
| ProgressDashboard | IconBox, Icons | Section headers use IconBox (activity, scale, target). |
| Profile | IconBox, Icons | Stat displays and section headers use IconBox. |
| Library | Icons, semantic tokens | Kind badges use design tokens. |
| App (navigation) | Icons | Tab icons use centralised icon map. |
| CookMode | Icons, semantic tokens | Full token migration. |
| FoodSearch | Icons, semantic tokens | Full token migration. |
| Settings | Icons, semantic tokens | Full token migration. |
| ShoppingList | Icons, semantic tokens | Full token migration. |
| RecipeUpload | Icons, semantic tokens | Full token migration. |
| NotificationsCenter | Icons, semantic tokens | Full token migration. |
| FirstRunChecklist | Icons, semantic tokens | Full token migration. |
| UpgradePrompt | Icons, semantic tokens | Full token migration. |
| EmptyState | Icons, semantic tokens | Full token migration. |
| AppLoadingSkeleton | semantic tokens | Full token migration. |

### Mobile parity

| Item | Status | Notes |
|---|---|---|
| Theme tokens (`apps/mobile/constants/theme.ts`) | Done | Migrated from #7c3aed violet to #4c6ce0 blue primary. New `Accent` object aligned with web CSS vars. MacroColors match web `--macro-*` properties. |
| Mobile feature screens | Pending | Mobile screens still use old Neon.* references in some places. Full screen-by-screen audit needed. |

### Stale files to remove

| File | Reason |
|---|---|
| `suppr-mockup.jsx` | Early prototype — superseded by implemented design system. |
| `suppr-variations.jsx` | Design exploration — Variation C chosen and implemented. |
| `suppr-prototype.jsx` | Prototype — features now live in production components. |
| `suppr-final.jsx` | Can be moved to `docs/reference/` if desired, otherwise remove. |

### Remaining work

1. **Mobile screen-by-screen migration** — Update each Expo screen to use `Accent.*` and `MacroColors.*` consistently (some still reference old `Neon.*` directly).
2. **RecipeCard type expansion** — `sourcePlatform` field added; populate it from Supabase recipe import metadata.
3. **Phase 2 features** (social recipe import pipeline, AI extraction) — not yet started.
4. **Phase 3 features** (recipe hero, ingredient macro bars, "I made this" bridge) — partially started via MacroCard/ConfidenceDot in RecipeDetail.
5. **Phase 4 features** (meal plan drag-and-drop, AI auto-fill, insights narrative) — DailyRing/MacroCard wired into MealPlanner; narrative analytics not yet built.
6. **Phase 5 polish** — accessibility audit, performance audit, keyboard shortcuts, gesture audit pending.

---

*This document should be treated as the source of truth for the Suppr redesign. Every PR, every component, every design decision should trace back to a principle or specification here.*
