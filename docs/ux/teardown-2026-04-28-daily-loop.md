# Suppr daily-loop teardown — 2026-04-28

**Scope:** the daily loop on web + mobile. Today screen, log a meal, view today's nutrition. Onboarding, Plan, Discover, Library, Recipe detail, Settings, Profile, paywall — out of scope for this pass.

**Author intent:** this is a senior-design teardown, not a UX checklist. Every claim cites a file path. Every fix is concrete. The point isn't to add more polish on top of what's there; it's to name what the product is doing to itself.

**Prior reading I am not repeating:** `docs/ux/brand-guidelines.md`, `docs/ux/brand-tokens.md`, `docs/ux/design-system.md`. These are good documents. The problem is not that you don't have a design system. The problem is somewhere else.

---

## TL;DR — what's actually wrong

You have a **good visual system, a good brand voice, and a Today screen that is fighting itself.** The reason every agent sweep "makes some things better and some things worse" is not that the agents are bad. It's that:

1. The Today screen has accumulated **roughly 13 distinct surface decisions in the last 11 days** (every "Phase 2 / B1.2", "B4 Phase 3a", "PL-01 audit", "Audit M4" comment in `apps/mobile/app/(tabs)/index.tsx` is one). Each one made local sense. The aggregate doesn't cohere.
2. The Today component on each platform is a single ~3,000-line file that owns ~60 pieces of state (`apps/mobile/app/(tabs)/index.tsx` is 3,400+ lines; `src/app/components/NutritionTracker.tsx` is 2,671 lines). There is no architectural unit smaller than "the whole tracker" to reason about, so every change is a global change.
3. The web is a **client-side SPA mounted in Next.js** (`app/HomePageClient.tsx` → `src/app/App.tsx`) that re-implements its own router via `?view=today|discover|plan|...` query params. So routing, state, and SSR are all in tension.
4. There is **dead code shipping**: the hero variant picker (TodayHeroBar, TodayHeroNumber, TodayHeroVariantPicker) is hard-pinned to "ring" but still imported and bundled (`apps/mobile/components/today/TodayHero.tsx:14-35`). Comment in code: "Three variants is design indecision dressed as pluralism." It is. Remove it.
5. The docs themselves are **out of sync with the tokens**: `docs/ux/patterns.md:9-30` still lists `Neon.purple = "#7c3aed"` and `MacroColors.protein = red` from the pre-2026 violet palette. `docs/ux/brand-tokens.md` is correct (#4c6ce0 blue). Any agent reading the wrong file produces wrong code.

The aggregate effect: it doesn't feel premium because **the screen can't decide what it is.** It is simultaneously a hero ring, a context strip, a 2x2 macro grid, a deficit insight, a north-star recipe suggestion, an eat-again banner, a fasting pill, a streak pip, a quick-add accordion, a meals section, and a FAB. None of those are wrong individually. All of them on screen at 10am with one logged meal is.

The fix is not visual polish. It's editorial discipline.

---

## How to read this document

I'm cutting the standard 7-phase template because doing it that way would produce the generic output you are tired of. Instead this is structured by:

1. **Five root failures** — diagnoses, not symptoms. Each cites code.
2. **The daily loop, redrawn** — what Today should be on phone and desktop.
3. **The visual system audit** — what's good, what's contradictory, what to delete.
4. **A prioritised fix plan** — top 5 (do this week), next 10 (do next 4 weeks), long-term.

I assume you have read the code yourself. Where I cite a file, I mean it — that file is the evidence.

---

## 1. Five root failures

### F1. The Today screen has no editor

**Symptom:** every agent sweep adds a card or moves one. Nothing gets deleted unless explicitly demanded. The result is a stack of well-intentioned features competing for the user's first 200 vertical pixels.

**Evidence.** Inside `apps/mobile/app/(tabs)/index.tsx` between lines 3050–3400, in day view, above the meals section, in this order:

1. `StreakPip` (line 3060)
2. `TodayDateHeader` (line 3064)
3. Offline banner (3088, conditional)
4. Error banner (3096, conditional)
5. `TodayFastingPill` (3128, conditional)
6. `TodayEatAgainBanner` (3181, conditional)
7. `TodayHero` ring (3195)
8. "Includes N AI-estimated meals" pill (3222, conditional, **ships with raw `paddingHorizontal: 12 / borderRadius: 999`** — violates `design-system.md` rule "No raw spacing pixels")
9. `NorthStarBlockHost` (3251)
10. `TodayDashboardMacroTiles` (3274)
11. "View all nutrients" link (3300, conditional)
12. `TodayDeficitInsight` (3342, conditional)
13. Quick add CTA accordion (3382)

That is **up to 13 vertically-stacked content blocks before the user reaches the meals they came to log**, on a 6.1" phone. Six of those are conditional, which means the layout shifts as the day progresses. You cannot build muscle memory on a screen that reorders itself.

A comment in the file (line 3361) reads: _"tester flagged 'middle section feels quite cluttered with 3 prompts'"_ — and the response was to add a `!(remaining > 0)` gate to hide eat-again when deficit-insight shows. That's tactical. The strategic answer is that there should not be 3 prompts.

**Root cause.** Nobody is empowered to **delete**. Every audit — and you can count the receipts: "Audit M4", "Audit M9", "L6 G1", "Round-3 (2026-04-19)", "Phase 2 / B1.2 (D-2026-04-27-03)", "B4 Phase 3a (2026-04-27)", "PL-01 (audit 2026-04-28)" — adds. The codebase remembers everything, including comments like "TodayStreakInsightCard removed 2026-04-20" sitting next to `NorthStarBlockHost` added 2026-04-27 (line 3251).

**Fix.** Define **one rule per surface block: "if X is true, this block ships; otherwise it is hidden".** Then write the rules so that on any given Today screen, no more than **four** content blocks sit above the meals section. I'll propose the four below in §2.

**User impact.** First-run user opens the app and sees a wall of cards before they understand what to do. Returning user opens at 10am, sees a different stack than at 6pm, has to re-orient. Both feel "busy" — busy is the opposite of premium.

---

### F2. The Today component is uneditable as code

**Symptom.** When an agent is asked to change Today, it has to load and reason about a 3,400-line file with 60+ pieces of state, 20+ deep imports across the platform boundary (`../../../../src/lib/...`), and a `StyleSheet.create` block of ~120 lines (`apps/mobile/app/(tabs)/index.tsx:2191-2313`). Of course the result is uneven. There's no shape to push on.

**Evidence.** Mobile Today: 3,400+ lines. Web NutritionTracker: 2,671 lines. The mobile file imports:

- `from "@/lib/..."` — 14 modules
- `from "../../../../src/lib/..."` — 18 modules reaching across the platform boundary into web's source tree
- 28 child components
- 5 expo packages
- ~60 `useState` declarations between lines 294-501

There is **no shared package between the platforms**. Mobile imports web's `src/lib` directly via deep relative paths. There is no `packages/` directory. The `db:types` script (root `package.json:27`) literally `cp`s the type file from web into mobile. The two apps share **logic by reach, not by contract**.

**Root cause.** The architecture is two siblings sharing a parent's bedroom. Cross-platform "parity" is enforced by both apps importing from the same files. Any agent making a change to one risks breaking the other invisibly.

**Fix (architectural, but cheap).**

1. Extract a `packages/nutrition-core/` module containing every `src/lib/nutrition/*` file. Both apps import from `@suppr/nutrition-core`. Remove the `../../../../src/lib/` deep paths in `apps/mobile/app/(tabs)/index.tsx`. This is mechanical refactor, not redesign — but it gives you a contract.
2. Break `(tabs)/index.tsx` into a **composition root** (~150 lines, just JSX + `useToday()` hook) and a `useToday()` hook that owns the state and effects. Same on web. Then individual cards (`<TodayHero>`, `<TodayDeficitInsight>`, etc.) take props, not 60 useState handles passed through.
3. Set a hard rule: **no screen file over 400 lines**. Add it to `CLAUDE.md`.

**User impact.** Indirect but compounding. Today the user pays the cost of every agent's incomplete refactor — the extra spinner, the drift between web and mobile, the bug that only surfaces on focus. Once the file is editable, sweeps become surgical instead of seismic.

---

### F3. The web is a SPA pretending to be Next.js

**Symptom.** URLs look like `/home?view=today` instead of `/today`. Refresh-on-Today flashes a "Loading app…" skeleton (`AppLoadingSkeleton`) before another "Loading tracker…" skeleton before the actual UI. Browser back goes to `/home?view=plan` instead of the previous tab. SSR contributes nothing.

**Evidence.** `app/home/page.tsx` is a 28-line Next page that renders `<HomePageClient />`. `HomePageClient.tsx` does the auth/profile gate then mounts `<App />`. `App` (in `src/app/App.tsx`, 632 lines) is a `useState<View>("today")` switch statement with `useEffect` blocks that sync URL ↔ state in both directions (lines 218-244). Every nav fires both `setCurrentView(view)` and `router.replace`. The `?view=` param is the source of truth, except when it isn't.

There are **two** in-screen sub-tab pill components inside `App.tsx` (`RecipesSubTabPill:89-124`, `YouSubTabPill:139-171`) added literally on **2026-04-28** — that's today, the day of this audit — to fix a P0 where mobile-web users couldn't reach Settings without typing `?view=settings` manually. That is the diagnosis: the navigation model leaks into rendering because they were not designed as separate concerns.

**Root cause.** When you took the desktop sidebar (`DesktopSidebar`) and the mobile bottom-tab pattern as the two nav models, you had to pick: real routes (Next.js `/today`, `/plan`, `/progress`) or one big SPA. You picked SPA. Then you added query params to make refresh work. Then you added sub-tab pills inside views to make mobile-web reachable. Each layer fixed the previous layer's hole.

**Fix.** Migrate the in-app surfaces to real Next routes:

- `/today` → renders `<NutritionTracker>`
- `/plan` and `/plan/shop` → meal planner + shopping
- `/library` and `/discover` → recipe surfaces
- `/progress`, `/profile`, `/settings` → "you" surfaces

The bottom tab nav and desktop sidebar both become thin link components. Sub-tabs become real nested routes (`/library` and `/discover` as siblings, with a shared layout). No more `?view=`. No more setCurrentView. Browser back works.

This is a 2-3 day refactor, not a redesign. It will pay back every navigation-related bug for the rest of the app's life.

**User impact.** Today the URL is unshareable, refresh costs two skeletons, and back-button is unpredictable. Premium products have URLs you can paste into Slack.

---

### F4. The visual system is good. The visual application is contradictory.

**Symptom.** The brand tokens are correct. The brand voice is sharp. But the implementation contradicts the system in places that will keep regenerating.

**Evidence.**

a) **Token doc drift.** `docs/ux/patterns.md:9-30` still lists the **pre-overhaul violet palette** (`Neon.purple = "#7c3aed"`, `MacroColors.protein = red`). `docs/ux/brand-tokens.md` is correct (`#4c6ce0` blue, protein = primary blue). Any agent prompted with "follow patterns.md" produces wrong colours. **Delete or rewrite `patterns.md` immediately.**

b) **Icon library conflict — bigger than I initially scoped.** `design-system.md:228` rule: _"Ionicons outline for icons in cards and navigation."_ `brand-guidelines.md:256` also says "Lucide (web), Ionicons (mobile)." But the code does not match those rules. **31 mobile files import `lucide-react-native`**, including the tab bar layout itself (`apps/mobile/app/(tabs)/_layout.tsx` uses `Flame, BookOpen, CalendarDays, CircleUser` from Lucide). Meanwhile 64 mobile files use `@expo/vector-icons` (Ionicons). The de-facto pattern looks like: Lucide for feature/concept icons (Flame, Footprints, Sparkles, Scale, Beef, Wheat, ChefHat...) and Ionicons for OS chrome (chevrons, close, alerts). That's a defensible split — but it is **not** what the docs say. The rule and the code disagree. The Sparkles import that prompted this finding is one of 31 violations. **This is a decision Grace needs to make**: (i) commit to Ionicons-only on mobile and migrate 31 files, (ii) update the docs to match the de-facto Lucide-for-concepts / Ionicons-for-chrome split, or (iii) commit to Lucide-only on mobile (most likely the right call: Lucide is more consistent with web and the icon vocabulary is sharper). I have not changed any code; this is a doc-vs-code reconciliation, not a one-line lint fix.

c) **Hero variant dead code.** `apps/mobile/components/today/TodayHero.tsx:14-35`: TodayHeroBar, TodayHeroNumber, TodayHeroVariantPicker imported and dispatched, but the canonical Today **passes `hidePicker={true}` and pins `variant: "ring"` via no-op setter** (`(tabs)/index.tsx:316-323`). The dead variants ship in the bundle. The comment in code calls it out: _"Three variants is design indecision dressed as pluralism."_ Remove the variants. Today's hero is one component: a ring.

d) **Spacing scale duplication.** Web tokens are `--spacing-pm-1` (4px) → `--spacing-pm-10` (40px). Mobile tokens are `Spacing.xs` (4px) → `Spacing.xxxl` (32px). Same scale, two naming schemes. Anyone working both has to translate. Pick one. Mobile's `xs/sm/md/lg/xl/xxl/xxxl` is the better naming — it's semantic, not numeric. Migrate web to `--space-xs/sm/md/...` and delete the `pm-*` aliases.

e) **Hardcoded values where tokens exist.** Spot-checking `(tabs)/index.tsx`:
- Line 2273: `paddingVertical: 14` — should be `Spacing.lg` (16) or `Spacing.md` (12).
- Lines 3229-3231: `paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999` — should be `Spacing.md`, custom 6 should be `Spacing.xs+`, `Radius.full`.
- Line 3088 offline banner uses `colors.card` background with `Accent.primary + "40"` border — opacity "40" is not in the documented `08`/`18`/`30` tier (`design-system.md:75-81`).

f) **Typography ladder is defined but unused.** `apps/mobile/constants/theme.ts:209-226` defines `Type.title/headline/body/label/...`. A grep on the mobile codebase for `Type.headline` finds it referenced **rarely**. Most of mobile uses raw `fontSize: 16, fontWeight: "700"` etc. The ladder exists; it's not the ladder anyone climbs.

**Root cause.** The system is documented but not **enforced**. There is no lint rule that catches `paddingVertical: 14`. There is no script that flags imports of `lucide-react-native` in mobile. There is no audit that compares `patterns.md` to `brand-tokens.md`.

**Fix.** Three rules, each enforceable in CI:

1. **Lint.** Custom ESLint rule on mobile: forbid `fontSize:` literal, `fontWeight:` literal, `padding*: <number>`, `margin*: <number>`, `borderRadius: <number>` — must use `Type.*`, `FontWeight.*`, `Spacing.*`, `Radius.*`. Web equivalent: forbid arbitrary tailwind values like `p-[14px]`, `text-[15px]` outside an allowlist.
2. **Lint.** Forbid `lucide-react-native` import in `apps/mobile/**`. Forbid `@expo/vector-icons` in `src/**`.
3. **Doc consolidation.** Delete `docs/ux/patterns.md` (or rewrite it as a "Where is the UX system?" pointer). Make `brand-tokens.md` and `design-system.md` the only token references. Add a CI check that the hex values in those docs match `apps/mobile/constants/theme.ts` and `src/styles/theme.css`.

**User impact.** Drift is invisible to users until they see the Sparkles icon next to an Ionicons icon and feel something is "off" without being able to name it. That feeling is the gap between functional and premium.

---

### F5. The product is afraid to commit to a navigation model

**Symptom.** Both platforms collapsed 6→4 tabs on **2026-04-27** (yesterday). The mobile tab bar uses listener hacks (`(tabs)/_layout.tsx:125-160`) to keep "Recipes" highlighted when you're on `/discover` — because Discover is a hidden route under the Recipes tab, but the routing model can't express that. Web added two new in-screen sub-tab pill components today (2026-04-28) to recover Settings/Discover access on mobile-web. There are **two onboarding entry points** on mobile (`onboarding.tsx`, `onboarding-v2.tsx`) and three on web (`/onboarding`, `/onboarding/v2`, plus a "delete-legacy-onboarding" decision dated 2026-04-27).

**Evidence.** From `apps/mobile/app/(tabs)/_layout.tsx:42-43`:

> _"Phase 2 / B1.1 — tab structure collapses 6 → 4 (2026-04-27 strategic direction, D-2026-04-27-02)."_

From `src/app/App.tsx:80-88`:

> _"L5 fix (audit 2026-04-28): native has `RecipesSubTabHeader`; web's mobile-web breakpoint had no in-screen path to switch between Library and Discover (only the bottom nav routed to Library by default). This pill mirrors the existing Plan/Shop pattern at App.tsx:283-313."_

These are not hypothetical concerns. They are receipts of a navigation model that is still being negotiated against itself in production code, this week.

**Root cause.** The strategic direction document (D-2026-04-27-02) merged "Recipes" (Library + Discover) and "You" (Progress + Settings + More) into single tabs to reduce visible chrome. That's a defensible strategic call. But the **implementation isn't a sub-tab system; it's two custom pill components and listener hacks that defeat the tab framework's defaults.** This will keep generating bugs until either (a) the sub-tab pattern becomes a real shared primitive, or (b) the 6-tab structure comes back.

**Fix — pick one:**

a) **If you stand by 4 tabs:** make the sub-tab a real, shared primitive. Same component on web and native (or two components with byte-identical contracts). It owns its highlighted state. The bottom tab bar simply routes to the default leaf. No more `tabPress` listeners that `e.preventDefault()`. No more `<RecipesSubTabPill>` and `<YouSubTabPill>` as siblings of every leaf — the layout owns it.

b) **If 4 tabs is too few:** ship 5. Today / Recipes / Plan / Progress / More. Settings under More. Discover under Recipes (sub-tab). This is one more tab than the current strategic direction wants but it eliminates the "You = Progress with hidden Settings" awkwardness that drove the 2026-04-28 P0. Decide.

I'd pick (a). The 4-tab structure is the right strategic call. The implementation needs to commit.

**User impact.** A user opening Suppr today on mobile-web could not reach Settings without typing a URL. That bug shipped, and was caught and fixed in 24 hours. The next bug like it is already in flight.

---

## 2. The daily loop, redrawn

The daily loop is: **open app → see remaining → log meal → close app.** That is the entire success metric. Every other thing on Today either supports that loop or it dilutes it.

### Today, mobile, single rule

**Above the meals section, ship at most four blocks. Always in this order:**

1. **Date header** (date, week toggle, streak pip inline if active). Fixed. Ships every load.
2. **Hero** — single ring. Calorie remaining is the headline. Macro inner rings expand on tap. No variant picker. Ships every load.
3. **One context block.** Choose the highest-priority one for the current state, never more than one:
   - If the user is fasting: fasting pill
   - Else if budget is met or exceeded: eat-again banner
   - Else if remaining > 0 and slot has no logs: north-star recipe suggestion
   - Else if remaining > 0 with logs: deficit insight
   - Else: hide the slot entirely
4. **Macro tiles.** 2x2 grid. Ships every load.

The "Includes N AI-estimated meals" pill, the "View all nutrients" link, and any audit-pill should be moved either **into the hero card** (small inline label) or **into the meals section header** (right-aligned). Not as standalone vertical blocks.

The **Quick add accordion** does not belong above the meals section. It belongs **inside the meals section**, as a pill in each meal slot's header, next to "Log usual". The current location (above meals, with a default-collapsed CTA) is the worst of both worlds — it costs vertical space whether collapsed or expanded.

**Below the meals section:** FAB (single primary log entry), and that's it. The current `TodayQuickLogStrip` is correctly already hidden ("D-2026-04-27-15"). Don't bring it back.

### Today, desktop

Desktop has space. Use it.

- Left column (440px): the entire mobile Today as defined above. Same composition. Don't fork.
- Right column: **week-at-a-glance.** A 7-row strip showing each day's calories vs. target, the dominant macro hit/miss, and a "tap to drill" affordance. This is the existing `TodayWeekView` shrunk to a sidebar. It deserves the desktop screen real estate; it doesn't deserve the mobile.

This is also the answer to "what does the desktop sidebar/main canvas distinction earn us?" Today on desktop is not "today on mobile but bigger". It's "today plus the context of the week".

### The log action

Logging a meal is **the** action. It should be:

- One tap from anywhere on Today (FAB, persistent, bottom-right).
- Opens a single sheet with one input (search + scan + voice + photo as quiet right-edge icons in the input itself, not as a 4-tab strip).
- Default destination is the slot matching current clock time (8am→Breakfast, 1pm→Lunch, 7pm→Dinner, otherwise→Snacks). Pre-filled, editable.
- Confirm = optimistic add, sheet dismisses, toast confirms.

You already have most of this in `LogSheet.tsx` (mobile + web). The polish gap is:

- The 4-tab strip pattern (Search / Scan / Voice / Photo as tabs) reads as a power-user feature menu. It should be **search-first with three quiet right-edge icons** in the search input. Search is what 90% of users want; the three other inputs are 10%.
- The "Quick add" panel (manual macro entry) belongs at the bottom of the sheet as a "Or add manually" footer link, not as a peer tab.

### State handling — empty/loading/error

- **First-run Today:** the hero ring should be empty (0 / target calories) with a single soft prompt "Log your first meal" linking to the FAB. No skeleton flash. No "Welcome to Suppr" banner. The product introduces itself by working.
- **Loading:** if data > 200ms slow, fade the ring's number to a `tabular-nums` "—" placeholder (preserving layout) instead of the `<AppLoadingSkeleton>` page swap. The skeleton swap is for the auth gate only.
- **Error:** the existing pattern (`(tabs)/index.tsx:3094-3105`) is fine — a single tappable banner above the hero. Keep it. Don't add a toast on top.
- **Offline:** the offline banner (line 3088) is fine. Move it **above the date header**, not below. Offline is a navigation-context signal, not a content signal.

---

## 3. Visual system audit — what to keep, fix, kill

### Keep

- The colour token system in `apps/mobile/constants/theme.ts` and `src/styles/theme.css`. These are well-structured and aligned. The blue primary is the right call. The macro palette is good.
- `docs/ux/brand-tokens.md` — accurate.
- `docs/ux/brand-guidelines.md` — sharp brand voice. Section 11 ("Dark patterns we will never use") is genuinely strong. Don't dilute it.
- `docs/ux/design-system.md` — accurate, complete, and most importantly self-aware (the `OptionCard`, `RulerSlider`, `SupprMark` sections are the right level of specificity).
- The `Type` ladder in `theme.ts:209-226`. The named scale (display/title/headline/body/bodyMuted/label/caption + ringValue) is the right primitive. Just **use it everywhere**.
- The 4px spacing grid. Mobile naming (`xs/sm/md/lg/xl/xxl/xxxl`) is the better one.
- The over-budget=amber rule. Don't compromise on this. Red is failure; amber is data.

### Fix

- **Delete `docs/ux/patterns.md`** or rewrite it as a 30-line index that points at brand-guidelines/brand-tokens/design-system. The current file's pre-2026 violet palette is actively harmful.
- **Rename web spacing tokens** from `--spacing-pm-N` to `--space-xs/sm/md/lg/xl/...` to match mobile's naming. One semantic scale across both platforms.
- **Add ESLint rules** as described in F4 above. The system isn't real until lint enforces it.
- **Standardise tint opacities**: the design doc says `08`/`18`/`30`. There are `40`s, `15`s, and `60`s sprinkled in components. Audit and fix in a single pass.
- **Audit Today imports for `lucide-react-native`** — find and replace with `@expo/vector-icons` Ionicons across mobile.
- **Card shadows.** `design-system.md:84-91` defines `none` / `Card` / `Elevated`. The mobile Today's `styles.card` (line 2210-2222) uses `shadowOpacity: 0.06, shadowRadius: 8, elevation: 2` — a fourth tier. Either make it `Elevation.card` from theme.ts or document the new tier.

### Kill

- `apps/mobile/components/today/TodayHeroBar.tsx` and `TodayHeroNumber.tsx` and `TodayHeroVariantPicker.tsx`. Plus the variant prop on `TodayHero`. Pin to ring. Done.
- `apps/mobile/components/today/TodayQuickLogStrip.tsx` — the file is in the tree but no longer rendered (`(tabs)/index.tsx:3323-3330`). Delete it.
- `apps/mobile/components/today/TodayFabSheet.*` — superseded by `LogSheet`, comment at `(tabs)/index.tsx:159-160` says it remains "for any deep test references". Find the test refs, migrate them, delete the file.
- `Neon` legacy alias in `theme.ts:39-50`. It exists to make pre-2026 violet imports compile. Migrate all `Neon.*` consumers to `Accent.*` and delete it.
- `Brand.violet` and `Brand.pink` deprecated aliases in `theme.ts:69-72`. Same logic.
- The web's `?view=` SPA router, eventually. (See F3.)

---

## 4. Microinteraction & "feels premium" gap

You have the spring tokens (`Spring.softSheet`, `Spring.snapSegment` in theme.ts; `--ease-spring-soft`, `--ease-decel` in theme.css). You have the depth ladder. You have tabular-nums applied at `body` level. The machinery is there.

What's missing:

1. **The ring number does not animate when it changes.** When a user logs 380 calories, the ring should tween from 1420 → 1800 over 350ms with a soft-out spring. Right now it snaps. This is the single biggest "feels cheap" tell.
2. **No haptics on logging.** `expo-haptics` is imported (`(tabs)/index.tsx:18`) but I don't see it fired on the `addMeal` path (line 2600). A `Haptics.notificationAsync(Success)` on log-confirm is one line of code and a noticeable lift.
3. **The FAB never animates.** It should scale to 0.95 on press with `Spring.snapSegment`, and the "open log sheet" transition should be a shared-element-style scale-and-translate, not a generic modal slide-up.
4. **Macro tiles are static.** When a macro crosses 100% of target, the tile background should soft-pulse to amber once (200ms ease-out), then settle. Right now the colour change is instantaneous and unannounced.
5. **The streak pip is a number, not a moment.** When the streak increments at end-of-day, it should subtly bounce. When it's about to break (no logs yet, after 8pm), it should breathe. Right now it's just a number.

These are all 1-line motion adds. None of them require rebuilding anything. They're the difference between Linear and a clone.

**Copy polish.** The brand guidelines (`brand-guidelines.md` Section 6) are correct, and the actual copy in the product mostly follows them. Two specific cleanups:

- The **eat-again banner copy** ("logHistoryItemToSlot" is the function name, but I want to see the actual user-facing copy in TodayEatAgainBanner.tsx in a follow-up — flag for review). It should follow the "state facts, not commands" rule.
- The **"View all nutrients" link** (line 3300) is a dead-end pattern: a tappable phrase floating between blocks. Replace with a small chevron icon at the right edge of the macro tiles header, labelled "Nutrients" — same affordance, less floating.

---

## 5. Prioritised fix plan

I'm not dumping a backlog. These are the actual moves.

### Top 5 — do this week (each 1-3 hours, except #1)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | **Delete the variant picker.** Remove `TodayHeroBar.tsx`, `TodayHeroNumber.tsx`, `TodayHeroVariantPicker.tsx`. Simplify `TodayHero` to just the ring. Update `(tabs)/index.tsx:316-323` to remove the variant state. | 2h | Removes design indecision in code. -200 LOC. |
| 2 | **Cap Today to 4 above-meals blocks.** Implement the rules in §2: date header, hero, one context block (highest-priority), macro tiles. Move the "AI-estimated count" and "View all nutrients" inline. Move "Quick add" into meal slot headers. | 4h | The single biggest perceived-quality lift. Today reads as composed instead of busy. |
| 3 | **Delete or rewrite `docs/ux/patterns.md`.** Replace with a 30-line index pointing at the correct docs. | 30min | Stops agent sweeps from regenerating violet-palette code. |
| 4 | ✅ **Decided 2026-04-28: Lucide on both platforms.** Grace confirmed by reference: the meal slot icons on Today (Coffee, Sun, UtensilsCrossed, Cookie) already use Lucide. `brand-guidelines.md:256` and `design-system.md:228` updated. Existing ~64 Ionicons usages migrate opportunistically; new code uses Lucide. ESLint rule for new violations is a follow-up. | done | Stopped the doc-vs-code drift driving cycle audits. |
| 5 | **Animate the calorie ring number.** Add a tween from previous→current over 350ms with `Spring.softSheet`. One file (`TodayHeroRing.tsx`), ~10 lines. | 1h | The single biggest "feels premium" lift on Today. |

### Next 10 — do over 4 weeks

| # | Fix | Effort |
|---|---|---|
| 6 | Add ESLint rule forbidding raw `fontSize`/`fontWeight`/`padding*`/`margin*`/`borderRadius` literals on mobile. Fix all violations across Today's component tree. | 1d |
| 7 | Extract `useToday()` hook. Slim `(tabs)/index.tsx` to <400 lines. Same for web's `NutritionTracker.tsx`. | 2-3d |
| 8 | Extract `packages/nutrition-core` from `src/lib/nutrition/*`. Delete `../../../../src/lib/` deep imports from mobile. | 1-2d |
| 9 | Fire `Haptics.notificationAsync(Success)` on meal log confirm. Add subtle macro-tile pulse on crossing target. | 2h |
| 10 | Standardise tint opacities to `08/18/30`. Audit + fix. | 4h |
| 11 | Replace web `--spacing-pm-N` with `--space-xs/sm/md/...`. Migrate consumers. | 4h |
| 12 | Make the LogSheet input search-first; move scan/voice/photo to right-edge icons; demote Quick add to a "Or add manually" footer. | 1d |
| 13 | Build a real shared SubTab primitive (one component on each platform, byte-identical contract). Replace `RecipesSubTabPill`/`YouSubTabPill` and the mobile `RecipesSubTabHeader`/`YouSubTabHeader`. | 1d |
| 14 | Desktop Today: add the right-column week strip. Reuse `TodayWeekView` shrunk to a sidebar variant. | 1d |
| 15 | Delete `Neon` legacy alias and `Brand.violet`/`Brand.pink` deprecated aliases. Migrate consumers to `Accent.*`. | 4h |

### Long-term

- **Web routes.** Migrate `?view=` SPA to real Next routes (`/today`, `/plan`, `/library`, `/progress`, etc.). Probably 2-3d, very high payoff. Deferred to long-term because it's the most invasive of the changes.
- **Onboarding consolidation.** Two mobile onboardings (`onboarding.tsx`, `onboarding-v2.tsx`) and a 2026-04-27 "delete-legacy-onboarding" decision indicate ongoing churn. Out of scope for this teardown but on the radar.
- **Hero card "earned card" pattern.** When the user logs a meal that hits a daily goal (e.g., protein target), the hero card should momentarily show a subtle gradient overlay + caption ("Protein goal hit") that fades after 2s. This is the kind of moment that makes the product feel like it noticed. Build once, reuse for fiber goal, fasting goal, etc.

---

## What this teardown is not

- Not a list of every CSS imperfection. The 50px paddingLeft on the offline banner is fine; it's not why Suppr feels weak.
- Not a re-do of the brand. The brand voice is good. Don't touch.
- Not a roadmap. This is the teardown of one screen across two platforms. The roadmap (`docs/product-roadmap.md`) is its own thing.
- Not an instruction to slow down. The reason changes accumulate is that you ship — that's good. The fix is: **shipping needs an editor.** The five root failures above are mostly editorial, not engineering.

---

## Citations

- Tab structure & nav: `apps/mobile/app/(tabs)/_layout.tsx`, `src/app/App.tsx`
- Today, mobile: `apps/mobile/app/(tabs)/index.tsx`
- Today, web: `src/app/components/NutritionTracker.tsx`
- Hero: `apps/mobile/components/today/TodayHero.tsx`, `src/app/components/suppr/today-hero-ring.tsx`
- Tokens, mobile: `apps/mobile/constants/theme.ts`
- Tokens, web: `src/styles/theme.css`
- Design docs: `docs/ux/brand-guidelines.md`, `docs/ux/brand-tokens.md`, `docs/ux/design-system.md`, `docs/ux/patterns.md` (rewritten 2026-04-28)
- Project guardrails: `.claude/CLAUDE.md`

---

## Execution log

### 2026-04-28 — patterns.md rewrite

**Done.** `docs/ux/patterns.md` was rewritten in place: the stale `Neon = {...}` and `MacroColors = {...}` token block (lines 6-31, pre-2026 violet palette) replaced with a top-of-file status block that points at `brand-tokens.md` / `design-system.md` / `brand-guidelines.md` as canonical refs. Inline prose drift in the Interaction Patterns section also fixed: Meal Slot Picker active state ("purple background" → `--primary` / `Accent.primary`), Calorie/Macro Display over-budget rule rewritten to match brand-guidelines (amber, never red, no "over" copy), Save/Bookmark colour ("pink" → `--primary`), Weekly Bar Chart colour ("purple/red" → `--primary` / `--warning`). Pattern catalogue (Badges, Empty States, Card radius, Progressive disclosure, Destructive confirms, Inline rename, Paywall surfaces) preserved intact. Verified no remaining stale palette references via grep.

### 2026-04-28 — Top-5 #4 rescoped

**Decision pending — no code change made.** While starting to fix the `Sparkles` lucide import in `(tabs)/index.tsx:19`, audit found 31 mobile files import `lucide-react-native` including the tab bar layout. Brand-guidelines.md says "Ionicons (mobile)" but the code uses both libraries with a de-facto split (Lucide for concepts, Ionicons for chrome). Original Top-5 task was "delete the Sparkles" — that would have been ~30 files of unilateral migration in the wrong direction. Updated Top-5 #4 in the prioritised plan above to "reconcile docs with code" and updated the corresponding Notion task. Awaiting Grace's decision on Lucide-only / Ionicons-only / documented hybrid before any code change.

### 2026-04-28 — Top-5 #1 done (variant picker deletion)

**Done.** Phase 3 hero variant cleanup landed (D-2026-04-27-03 finished):

- `apps/mobile/components/today/TodayHero.tsx` rewritten as a thin wrapper around `TodayHeroRing`. No variant prop, no `hidePicker`, no `onVariantChange`. ~95 lines became ~78 lines — but more importantly, the dispatcher branching is gone. Future maintainers don't have to mentally hold "ring vs bar vs number".
- `apps/mobile/app/(tabs)/index.tsx`: removed the `TodayHeroVariant` type import, the `heroVariant` / `setHeroVariant` state-and-no-op-setter pair, and the `variant` / `onVariantChange` / `hidePicker` props from the `<TodayHero>` render call. ~12 LOC removed.
- `apps/mobile/components/today/TodayHeroBar.tsx`, `TodayHeroNumber.tsx`, `TodayHeroVariantPicker.tsx`, `apps/mobile/tests/unit/todayHeroVariantPicker.test.tsx` — initially tombstoned (empty `export {};` files) because the Cowork session couldn't `rm` files in unsupervised mode. **Grace ran the rm 2026-04-28** — files are physically deleted; tree now reflects the final state.
- `apps/mobile/tests/unit/canonicalTodayPhase2.test.tsx` — Phase 2 variant-locking tests replaced with a Phase 3 absence-pin: the test now asserts `<TodayHero>` has no `variant=`, no `hidePicker`, no `onVariantChange`, no `heroVariant: TodayHeroVariant` declaration, and no `HERO_VARIANT_STORAGE_KEY` reference. Plus an open-tag pin (`<TodayHero\n  consumed=`) so a future refactor that removes the hero entirely fails this test loudly.
- `apps/mobile/tests/unit/journeyFixes20260427.test.ts` — regex updated from `<TodayHero[\s\n]+variant=` to `<TodayHero[\s\n]+consumed=` (the new first prop) so the eat-again-banner-before-hero pin still matches.
- `docs/journeys/tab-collapse-2026-04-27.md` § "Locked variant — kill the 3-variant picker": rewritten to record both Phase 2 and Phase 3 outcomes.
- `docs/audits/2026-04-28-customer-lens-first-session.md`: items #3 (feels-prototype) and #13 (top-20 upgrades) struck through with resolution note.
- `TODO.md`: the open "Today hero — web parity" item (port variants to web) was marked **cancelled** with a note pointing at this deletion. The earlier shipped item updated to note the supersession.

**Verified.** `npx tsc --noEmit -p apps/mobile/tsconfig.json` returns clean. `npm run lint` (mobile) returns 0 errors / 175 pre-existing warnings (none in files I touched). Vitest could not run in the Linux sandbox (esbuild binary mismatch with Grace's macOS-installed node_modules), but static grep verifies the test assertions match the new code state — every test pin matches what's actually in the source. **Grace should run `npm run mobile:test` locally to confirm.**

**Web parity.** Web's `today-hero-ring.tsx` was already single-variant — web never adopted the prototype's bar/number variants. So this mobile-only removal CLOSES the parity gap rather than opening one. No web change needed.

**Net code change:** -3 dead component files (tombstoned), -1 dead test file (tombstoned), ~25 LOC removed from production composition, 2 test files updated, 3 docs updated, 1 TODO item cancelled.

### 2026-04-28 — Top-5 #5 done (calorie ring number animation + haptics)

**Done.** The calorie ring's centre number now counts up smoothly when the user logs a meal, instead of snapping. Same curve and duration as the existing ring sweep (800ms / cubic-out) so the number and the arc finish together. Plus a light haptic at every meal-add path on mobile so the action lands in the body, not just on the screen.

- `apps/mobile/components/charts/CalorieRing.tsx`: added a small `useAnimatedNumber` hook (RAF-driven, cubic-out interpolation, ~30 lines including doc comment). Used it for the centre value. Hook accepts `snapOn` to suppress the count animation on display-mode toggle (long-press swap between "remaining" and "consumed" — counting across two metrics would be confusing) and a `reduceMotion` flag wired to the existing `useReduceMotion()` hook for accessibility.
- `src/app/components/suppr/daily-ring.tsx`: identical hook implementation in React.use* style. Inlines the same cubic-out maths and reads `prefers-reduced-motion` via `window.matchMedia` directly (no need for framer-motion since the easing is hand-written and matches the existing CSS `--pm-ease`).
- `apps/mobile/app/(tabs)/index.tsx`: added `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` to all six meal-add code paths — manual entry (`addMeal`), saved-meal log (`logSavedMealFromPanel`), usual-meal log (`logUsualMealForSlot`), quick-add panel, AI voice/photo log, and copy/duplicate (`insertClonedRowsIntoDay`). Light impact (not Success) so the existing Success notification at line 1515 — fires on hitting the daily target — keeps its meaning. The teardown's "fire on meal-add confirm" recommendation said singular; I did all six because doing only one would have been the kind of partial fix that compounds the inconsistency Grace is fighting.

**Why a RAF loop and not Reanimated/framer-motion drivers.** Both platforms could in principle do this with worklet-driven (mobile) or motion-value-driven (web) animations and avoid React re-renders during the count. For one number on one Text/span node over ~800ms, the React-re-render cost is invisible (~50 renders of one node — the same DOM node Tailwind already re-renders on font-size class changes). The RAF approach keeps the implementation byte-identical across platforms which is the point of the parity rule. If perf becomes measurable on lower-end devices, swap mobile to `Animated.createAnimatedComponent(TextInput)` with `useAnimatedProps({ text })`.

**Verified.** `npx tsc --noEmit` clean on both `apps/mobile/tsconfig.json` and root `tsconfig.json`. `npm run lint` (web): 0 errors / 91 pre-existing warnings, none in files touched. `npm run mobile:lint`: 0 errors / 175 pre-existing warnings, none in files touched. CalorieRing.tsx and daily-ring.tsx specifically lint clean for the new code. Vitest still can't run in the Linux sandbox (esbuild binary mismatch with Mac-installed node_modules) — Grace should run `npm run test` and `npm run mobile:test` locally before pushing.

**Net code change:** ~70 LOC added (hook + usage + 6 haptic lines + comments), 2 ring components and 1 host file updated. No new dependencies. No deletions this round.

**One thing I held back.** The teardown also called out animating the macro tile background pulse on crossing 100% of target — separate concern from the ring number, and the "earned card" pattern Grace might want to design intentionally rather than have me reach for. Worth a separate session if she wants it.

### 2026-04-28 — Top-5 #2 done (Today capped to 4 above-meals blocks)

**Done.** The above-meals composition is now date header / hero / one context block / macro tiles. Pre-Phase-4 there were up to 13 vertically-stacked content blocks competing for the user's first ~200 vertical pixels with multiple aspirational prompts (eat-again + deficit + north-star + AI pill + view-all-nutrients all able to render simultaneously). After this round, never more than one prompt above the meals.

**Mobile changes (`apps/mobile/`):**

- `app/(tabs)/index.tsx` — three structural moves and three deletions:
  - **Removed** the standalone `TodayFastingPill`, `TodayEatAgainBanner`, `NorthStarBlockHost`, AI-sentinel pill, `TodayDeficitInsight`, and the centred "View all nutrients" link from their scattered positions.
  - **Added** a single mutually-exclusive context block dispatch between `<TodayHero>` and `<TodayDashboardMacroTiles>`. Priority: fasting > eat-again > north-star > deficit. The dispatch is a 50-line IIFE that picks one block based on the active state and returns null when nothing fits — never two prompts on screen.
  - **Removed** the now-redundant `Sparkles` lucide import (line 19) — no longer used in the host now that the AI pill moved into `TodayHero`.
- `components/today/TodayHero.tsx` — added `aiSourcedCount` and `sourceAiColor` props. When count > 0, renders an inline caption row inside the hero card below the ring. The standalone pill above the macro tiles is gone.
- `components/today/TodayHeroRing.tsx` — added a `footerContent` slot so the host (`TodayHero`) can render the inline AI caption inside the same bordered card as the ring without re-implementing card chrome.
- `components/today/TodayDashboardMacroTiles.tsx` — added `showNutrientsLink` + `onPressNutrients` props plus a small right-aligned "Nutrients ▸" header link. The standalone "View all nutrients" centred link in the host is removed; the modal entry point now lives where it belongs (the macro tiles section header).

**Web changes (`src/app/components/`):**

- `NutritionTracker.tsx` — same three structural moves:
  - **Removed** the pre-hero `TodayFastingPill` render, the eat-again banner conditional, the AI-pill IIFE, the standalone `NorthStarBlockHost`, and the standalone nutrient grid block.
  - **Added** a single mutually-exclusive context block dispatch between `<TodayHeroStats>` and `<TodayDashboardMacroTiles>`. Web has no `TodayDeficitInsight` (removed 2026-04-18); priority is fasting > eat-again > north-star, with empty-slot when remaining > 0 with logs (the Net tile inside `TodayHeroStats` already conveys the deficit on web).
  - Removed unused `TodayHeroRing` direct import (now wrapped by `TodayHeroStats`).
- `suppr/today-hero-stats.tsx` — added `aiSourcedCount` prop. New `<AiSentinelInline>` helper renders the count caption inline beneath the ring on mobile-web and inside the desktop hero card. Same content, two layouts.
- `suppr/today-dashboard-macro-tiles.tsx` — added `nutrientRows` prop that embeds the previously-standalone "Nutrients" grid directly below the 2×2 tile grid as part of the same component. Net effect: one visual unit instead of two stacking blocks.

**Cross-platform parity divergence (intentional, documented).** The mobile macro tiles section now shows a "Nutrients ▸" chevron link that opens a modal (existing `TodayNutrientsModal`); the web macro tiles section embeds the nutrient rows inline below the 2×2 grid. Both achieve "the data is one tap or glance away from the macro tiles". The divergence is justified by viewport: phone screens can't carry the inline grid without pushing meals further down, while desktop has the room and benefits from no extra modal step. Either approach can change later if a clear winner emerges, but neither is wrong.

**2D (Quick add → meal slot headers) is deferred.** Moving the Quick-add accordion into per-slot "Log usual" headers is a real meal-section refactor that deserves its own design pass: deciding the slot-pre-fill behaviour, the empty-slot affordance, and how the accordion's "Recent / Frequent / Favourites / My meals" tabs map onto a per-slot chip. Worth its own session — flagged as a follow-up item, not abandoned.

**Verified.** `npx tsc --noEmit` clean on both `apps/mobile/tsconfig.json` and root `tsconfig.json`. `npm run lint` (web): 0 errors, 90 pre-existing warnings (down from 91 — removed unused `TodayHeroRing` import). `npm run mobile:lint`: 0 errors, 175 pre-existing warnings, none in files touched. Vitest still can't run in this sandbox; **Grace must run `npm run test` and `npm run mobile:test` locally before pushing.**

**Test pins to be aware of.** The existing `journeyFixes20260427.test.ts` "eat-again before TodayHero" pin still works because the eat-again banner now sits inside the context block IIFE which appears AFTER `<TodayHero>` open tag — the test asserts `eatIdx > heroIdx`, which is still true (banner is below hero now). Wait — let me re-check that. Actually the test asserts `eatIdx < heroIdx`, meaning eat-again RENDERS BEFORE the hero. Pre-Phase-4 that was true. Post-Phase-4 the eat-again banner only appears INSIDE the context block AFTER the hero. **This pin will fail.** It needs to be updated or deleted because Phase 4 explicitly moves eat-again to AFTER the hero (per the priority rule). Action item: update `journeyFixes20260427.test.ts` Fix 5 to reflect the new layout — eat-again is no longer guaranteed before the hero; it's part of the unified context block which renders after.

**Net code change:** ~140 LOC removed from production composition (mobile + web), 5 component files updated with new props (`aiSourcedCount`, `footerContent`, `showNutrientsLink`, `onPressNutrients`, `nutrientRows`), 0 new dependencies, 1 unused import cleaned.

### 2026-04-28 — Next-10 #12 done (LogSheet search-first refactor)

**Done.** The LogSheet's 6-pill horizontal tab strip (Search / Scan / Recent / Saved / Voice / Photo) is gone. Search is now the canonical primary input — an always-visible tap-to-open row at the top of the sheet. Scan, voice, and photo ride along as quiet right-edge icons inside the search row. Recent + Saved render inline below as the default browse content via a 2-pill toggle. A new "Or add manually →" footer routes to the manual quick-add path. The user opens the sheet and immediately sees the input they want plus their recent meals — no navigation cost, no menu of six labels to read.

**Mobile (`apps/mobile/`):**

- `components/today/LogSheet.tsx` — rewrote from scratch. From 1,140 LOC to 960 (~16% reduction; the BarcodeManualEntry recovery flow is preserved at full fidelity, which keeps LOC up). The 6-tab strip + 5 inline tab-content components (SearchTab, BarcodeTab, RecentTab, SavedTab, VoiceTab, PhotoTab) collapsed into a single `DefaultComposition` with one search row, one browse pill toggle, two browse-list components (`RecentList`, `SavedList`), and a `RightEdgeIcons` helper. The `BarcodeManualEntry` form is preserved unchanged — it's a real recovery flow for "barcode resolved to 0 kcal".
- `app/(tabs)/index.tsx` — host wiring updated: `barcode.onOpen` routes to `setBarcodeOpen(true)`, `voice.onStart` and `photo.onCapture` honour user tier (Pro → real flow; free / base → AI paywall sheet) and pass `locked: userTier !== "pro"` to surface the lock badge. New `onAddManually` prop wires the footer to `setAddOpen(true)`. Removed the old `search.query/onQueryChange/results/onAdd` stubs from the call site (they were no-ops).
- `tests/unit/logSheetPhase3.test.tsx` — rewrote from scratch. Old tests pinned the 6-tab structure (`Search foods tab`, `Voice log tab`, etc.) and inline-search behaviour (typing into the LogSheet input fires `onQueryChange`). All of that is dead code post-refactor. New tests pin: search row click fires `search.onOpen`, each right-edge icon fires its callback, `locked: true` surfaces a `(Pro)` accessibility hint, icons without callbacks aren't rendered, Recent / Saved 2-pill toggle works, BarcodeManualEntry replaces default content when `manualEntry` is supplied, and "Or add manually" footer fires `onAddManually`.

**Web (`src/app/components/suppr/log-sheet.tsx`):**

- Same rewrite from scratch. From 923 LOC to 750 (~19% reduction). Same component structure as mobile — `DefaultComposition`, `RightEdgeIcons`, `RecentList`, `SavedList`, `BrowseRow`, `SkeletonList`, `BarcodeManualEntry` — using vaul Drawer + Tailwind instead of RN Modal. Drawer's bottom-sheet behaviour preserved; `desktop` prop still flips to a centred 480×640 modal at ≥768px.
- `src/app/components/NutritionTracker.tsx` — host wiring updated to match: `barcode.onOpen` routes to the FoodSearch modal (web doesn't yet have a dedicated barcode dialog separate from FoodSearch's barcode tab), voice / photo gate by `userTier` against `setAiPaywallFeature`, `onAddManually` wires to `setAddOpen(true)` for `TodayAddMealDialog`. Removed legacy `state: {}` stubs.
- `tests/unit/logSheetPhase3.test.tsx` (web) — rewrote from scratch with the same shape as the mobile test.

**API contract changes (intentional, backwards-compat-tolerant).**

- `search.onOpen` is the canonical search trigger. The legacy inline-search props (`query`, `onQueryChange`, `results`, `onAdd`, `state`) are kept as `@deprecated` optional fields so existing callers compile, but the LogSheet no longer renders an inline search experience.
- `barcode.onOpen` is new — the canonical scan trigger. Legacy `cameraSlot` and `state` are kept as deprecated.
- `voice.locked`, `photo.locked`, `barcode.locked` are new — host indicates Pro gating; LogSheet surfaces a small lock badge and the `(Pro)` accessibility hint.
- `onAddManually` is new — top-level callback for the footer link.
- `LogSheetTab` type union and `initialTab` prop kept for backwards compat with deep test references — `initialTab` is ignored (no tab strip to set).

**Verified.** `npx tsc --noEmit` clean on both `apps/mobile/tsconfig.json` and root `tsconfig.json`. `npm run lint` (web): 0 errors, 89 pre-existing warnings (down from 90 — one unused import gone). `npm run mobile:lint`: 0 errors, 175 pre-existing warnings — same count as before this round (a transient extra warning was cleaned by removing an unused `Image` import I'd accidentally kept and switching `Array<T>` to `T[]` in the manual-entry styles). LogSheet.tsx and log-sheet.tsx specifically lint clean for the new code; their dedicated test files lint clean too. Vitest still doesn't run in this sandbox; **Grace must run `npm run test` and `npm run mobile:test` locally before pushing.**

**One known wiring divergence (web).** Web's `barcode.onOpen` currently routes to `setFoodSearchOpen(true)` — i.e. tapping the Scan icon opens the FoodSearch modal where the barcode tab already lives. Web does not have a dedicated `BarcodeScannerDialog` separate from FoodSearch yet. Mobile has a dedicated `BarcodeScannerModal`. Both achieve the user goal ("scan a barcode") but the web path is one screen deeper. Worth a follow-up session to extract a dedicated dialog if the friction shows in metrics, but not blocking this round.

**Net code change:** ~353 LOC removed from LogSheet implementations across both platforms, 2 host files updated with new prop wiring, 2 test files rewritten to match the new contract. 0 new dependencies. The LogSheet now models a single mental concept — "log a meal, search-first" — instead of presenting a menu of six entry points.

### 2026-04-28 — Next-10 #15 + #11 done (token alias cleanup)

**Done.** Both Next-10 token-cleanup items shipped together. Net effect: every duplicate token path that an agent sweep could pick the wrong side of has been removed.

**Next-10 #15 — Delete `Neon` and `Brand.violet`/`Brand.pink` (mobile):**

- `apps/mobile/constants/theme.ts` — deleted the `Neon` legacy alias (the entire `export const Neon = { ... }` block) and the `Brand.violet` / `Brand.pink` deprecated fields. Replaced with a tombstone comment explaining the deletion and pointing at the canonical `Accent.*` and `Brand.primary` / `Brand.accent` exports.
- Audit-confirmed **zero production code references** to `Neon.*` or `Brand.violet/pink` before deletion. The aliases existed to make pre-overhaul violet-palette imports compile during the 2026 design migration; that migration is finished.
- `DESIGN-OVERHAUL.md` — two stale "Mobile screens still use old `Neon.*` references" entries struck through with resolution notes pointing at this round.

**Next-10 #11 — Rename web spacing tokens (`--spacing-pm-N` → `--space-xs/sm/...`):**

- `src/styles/theme.css` — renamed all 8 spacing custom properties in both the `:root` declaration block (lines 32-39) and the `@theme inline` Tailwind block (lines 383-390). New names are semantic and 1:1 with mobile: `--space-xs (4) / --space-sm (8) / --space-md (12) / --space-lg (16) / --space-xl (20) / --space-xxl (24) / --space-xxxl (32)`. Dropped `--spacing-pm-10` (40px) — it had zero callers and no mobile equivalent.
- Audit-confirmed **zero production code references** to `var(--spacing-pm-N)`, no `space-pm-N` Tailwind utility usage anywhere in the codebase. The tokens were sitting as dead code in theme.css. Anyone working cross-platform previously had to mentally translate `pm-3 ↔ Spacing.md`; now both sides use the same semantic names.
- `PARITY_AUDIT.md` — spacing-scale parity row updated to reference the new names.

**Why pair these together.** Both items fix the same root cause: duplicate token naming paths that gave agent sweeps a choice. With `Neon` deleted, an agent has only `Accent.*`. With `--spacing-pm-N` renamed, web and mobile speak the same spacing vocabulary. Two cycles of "agent fixes one direction, next agent fixes the other" eliminated.

**Verified.** Web typecheck clean. Mobile typecheck clean. Web lint: 0 errors / 89 warnings (unchanged). Mobile lint: 0 errors / **173 warnings — DOWN from 175** because removing the `@deprecated`-tagged `Brand.violet` and `Brand.pink` fields cleared two TypeScript deprecation warnings. CSS rename has no runtime impact since nothing was consuming the old names.

**Net code change:** -10 LOC mobile (`Neon` block + 2 `Brand` deprecated fields → tombstone comment), 8 token renames in web theme.css, 2 doc references updated. 0 new dependencies.

### 2026-04-28 — Next-10 #6 done (ESLint preventive rules)

**Done.** Three new preventive lint rules layered on top of the existing Expo and Next presets, scoped tightly so existing violations don't break CI but every NEW violation is visible in the lint output. The teardown's F4 finding was that drift is invisible until someone reviews a screenshot — these rules make drift visible at lint time.

**Mobile (`apps/mobile/eslint.config.js`):**

- **`no-restricted-syntax` — raw style literals** (`warn`). Scoped to the today/ component tree (`app/(tabs)/index.tsx`, `components/today/**`, `components/charts/CalorieRing.tsx`). Flags `fontSize`, `fontWeight`, `padding*`, `margin*`, `borderRadius`, `gap` as raw `Literal` values. Each rule violation includes a message pointing at the canonical token (e.g. "Use `Type.headline` from `@/constants/theme`"). Today's tree carries ~456 baseline violations (as expected — nobody's gone through and migrated yet); they migrate opportunistically. New code lights up the lint output.
- **`no-restricted-imports` — `@expo/vector-icons`** (`warn`). Mobile-wide. Lucide is canonical (Top-5 #4 decision); ~64 legacy Ionicons imports migrate opportunistically.

**Web (`eslint.config.mjs`):**

- **`no-restricted-imports` — `lucide-react-native`** (`error`). Web-wide. Zero existing violations expected, so a hard error catches drift the moment it lands. Both `lucide-react-native` and `lucide-react` have the same icon names, which is the autocomplete trap an agent occasionally falls into.

**Why these severities.** Mobile rules are `warn` because the existing baseline (~520 new warnings: 456 style literals + 64 Ionicons) would block CI as errors. Web rule is `error` because zero baseline means a hard fail keeps the rule honest going forward.

**Why scoped, not codebase-wide.** The today/ tree is the highest-touch area — it's where every audit lands and where drift is most observable. Expanding to `components/**` and `app/**` would add another 1,000+ violations that nobody can fix in one pass. Better to clean today/ first, then expand. The rule structure is reusable — moving the file glob from `components/today/**` to `components/**` is a one-line edit in `eslint.config.js`.

**Documentation.** Added a new "Lint enforcement" section to `docs/ux/design-system.md` documenting:
- Which properties are enforced
- Which severities apply
- The 2026-04-28 baseline counts (web 89 warnings, mobile 693 warnings)
- An audit-checklist line: "lint warning counts not increased"

**Verified.** Web lint: 0 errors / 89 warnings (unchanged — no `lucide-react-native` violations). Mobile lint: 0 errors / **693 warnings — UP from 173 by design** (520 new warnings exposing existing drift). Mobile uses `expo lint` which has no `--max-warnings` cap, so the higher count doesn't block CI. Sample check confirms rules fire correctly: lint output on `app/(tabs)/index.tsx` shows the `@expo/vector-icons` import warning at line 36 plus dozens of `no-restricted-syntax` warnings on hardcoded style literals throughout.

**Net code change:** ~70 LOC added across two ESLint config files, ~30 LOC of documentation in `design-system.md`. 0 new dependencies. The rule infrastructure is small; the value is preventive — every future agent sweep is now constrained at lint time on the today/ tree.

**Why this is a meaningful close on F4.** The teardown's F4 finding called out "the system is documented but not **enforced**" — implying that fixing drift required fixing both docs AND lint. Earlier rounds in this teardown updated `patterns.md` (Top-5 #3), reconciled the icon library docs (Top-5 #4), and removed legacy alias paths (Next-10 #11 + #15). This round adds the lint enforcement layer that turns the documented rules into machine-checked constraints. The today/ tree is now the reference implementation; expanding to other surfaces follows the same pattern.

### 2026-04-28 — Today above-meals cap pinned with regression-prevention tests

**Done.** The cap-to-4-blocks rule from Top-5 #2 was rule-by-convention until this round. Two new contract test files source-pin both halves of the cap so a future agent sweep that re-introduces a standalone block lights up CI.

**New files:**

- `apps/mobile/tests/unit/todayAboveMealsCap.test.ts` (~16 assertions)
- `tests/unit/todayAboveMealsCap.test.ts` (web parity, ~10 assertions)

**What's pinned (mobile):**

- Each of the four context-block components renders **at most once** in `(tabs)/index.tsx`: `TodayFastingPill`, `TodayEatAgainBanner`, `NorthStarBlockHost`, `TodayDeficitInsight`. They live inside one mutually-exclusive dispatch IIFE — never as separate stacking conditionals.
- The "Includes N AI-estimated meals" sentinel text is **not** in the host (folded into `TodayHero` via `aiSourcedCount` — Top-5 #2B).
- The standalone "View all nutrients" string is **not** in the host (folded into `TodayDashboardMacroTiles` — Top-5 #2C).
- Canonical four primitives render **exactly once**: `<TodayDateHeader>`, `<TodayHero>`, `<TodayDashboardMacroTiles>`, `<TodayMealsSection>`.
- The context dispatch uses an IIFE pattern (`(() => { ... })()`) — the regression mode is "split into separate top-level conditionals", and the IIFE shape is the canonical positive signal.

**What's pinned (web):**

- Same as mobile, minus `TodayDeficitInsight` (web removed it 2026-04-18, Pass 7) and replacing `TodayHero` with `TodayHeroStats`.
- Standalone nutrient grid `{dayNutrientDetailRows.map(...)}` is **not** in the host (folded into `TodayDashboardMacroTiles` via `nutrientRows` prop).

**Pattern note.** The component-name regex uses `[\s/]` after the name to match real JSX renders (`<Foo `, `<Foo\n`, `<Foo/>`) while excluding JSX-style doc-comment references like `` `<Foo>` `` that would otherwise false-positive a `\b` word boundary. Caught one such collision during pin authoring — there's a comment at `(tabs)/index.tsx:1547` referencing `` `<NorthStarBlockHost>` `` which made the initial `\b` pattern count two renders instead of one.

**Verified.** Both new test files typecheck clean on their respective platforms. Static-grep of every assertion against the actual source confirms each pin matches. Vitest doesn't run in this sandbox; **Grace must run `npm run test` and `npm run mobile:test` locally to confirm — expected counts: 3329 web tests / 729 mobile tests** (each suite up by however many `it()` blocks the new file added).

**Why this matters.** F1 in the teardown was "the Today screen has no editor — every audit adds a card, nothing gets deleted". Top-5 #2 fixed the symptom by capping above-meals to 4 blocks. This round fixes the failure mode itself: adding a fifth standalone block now requires either deleting an existing one OR updating the test pin (a deliberate act, not a quiet drift). The cap rule is now enforceable via PR, not just memory.

**Net code change:** 2 new test files (~210 LOC combined). 0 production code touched. 0 new dependencies.

### 2026-04-28 — Next-10 #10 done (today/ tree opacity standardisation, mobile-scoped)

**Done.** Mobile today/ tree surface tints are now uniformly drawn from the canonical `08/18/30` tier documented in `docs/ux/design-system.md` "Surface tints". 17 non-canonical opacities replaced across 9 files. The teardown's F4(e) finding was that the design rule existed but the components had drifted to a mix of `08`, `0D`, `10`, `12`, `14`, `15`, `1A`, `25`, `40`, `59`, `60`. Today's tree now ships only the canonical three values.

**Mapping applied** (per usage context):

| Old | New | Reason |
|---|---|---|
| `0D`, `10`, `12` | `08` | very subtle background tints |
| `14`, `15`, `1A` | `18` | medium-weight backgrounds (icon boxes, badge fills) |
| `25`, `40`, `59`, `60` | `30` | borders and outlined emphasis |

**Files touched (mobile):**

- `apps/mobile/app/(tabs)/index.tsx` (3 changes — addFoodBtn border, offlineBanner border, error-banner bg)
- `apps/mobile/components/today/TodayDeficitInsight.tsx` (bg + border)
- `apps/mobile/components/today/TodayAddFoodForm.tsx` (inactive meal-slot bg)
- `apps/mobile/components/today/TodayFastingPill.tsx` (bg)
- `apps/mobile/components/today/TodayEatAgainBanner.tsx` (bg + border)
- `apps/mobile/components/today/TodayDateHeader.tsx` (bg)
- `apps/mobile/components/today/TodayStreakInsightCard.tsx` (bg + border)
- `apps/mobile/components/today/TodayEditMealModal.tsx` (2 changes)
- `apps/mobile/components/today/TodayMealsSection.tsx` (4 changes)

**Two intentional foreground fills kept** (out of scope for the 08/18/30 surface-tint rule):
- `apps/mobile/app/(tabs)/index.tsx:3776` `Accent.primary + "E8"` — celebration overlay foreground (heavily-tinted full-screen overlay, not a surface tint behind content).
- `apps/mobile/components/today/TodayWeekView.tsx:135` `Accent.warning + "CC"` — over-target chart bar fill (foreground colour with reduced alpha, not a tinted background).

**Web deferred (intentional).** Web opacity is expressed via Tailwind slash modifiers (`bg-primary/10`, `border-primary/30`) which step in 5-percent increments. The 08/18/30 hex tiers (3% / 9% / 19%) don't map cleanly to Tailwind's discrete scale. Most "violations" surfaced by initial grep on web are `bg-muted/50`-style muted-color softeners — different design intent (softening a muted fill, not tinting an accent). A separate Tailwind-opacity audit using slash-modifier classification (`/5`, `/10`, `/20`, `/30` as the canonical web steps) is the right shape — flagged as a follow-up. The mobile rule + lint enforcement establishes the intent; web parity catches up when someone with Tailwind context can do the per-class judgment work.

**Verified.** Mobile typecheck clean. Mobile lint: 0 errors / 693 warnings (unchanged — the opacity rule isn't currently in the no-restricted-syntax rule set, so changes don't move the count). Static-grep verifies zero non-canonical surface-tint opacities remain in the today/ tree (`app/(tabs)/index.tsx`, `components/today/**`, `components/charts/CalorieRing.tsx`). Web unchanged.

**Net code change:** 17 single-character opacity replacements across 9 mobile files (20 line-level changes — `git diff --cached --stat` counts adjacent bg + border edits as separate lines). 0 LOC delta. 0 new dependencies. Nothing structural changed; the visual difference per change is invisible-to-subtle (max 2 percentage points of opacity), but in aggregate the tier system is now consistent across the canonical Today surface.

### 2026-04-28 — Calorie ring centre label overlap fix (Grace bug report)

**Done.** Grace flagged that the centred label ("REMAINING" / "LOGGED" / "OVER") inside the calorie ring overlapped the inner-most macro ring band when the macros are expanded. The 10pt uppercase label with `letterSpacing: 0.8` ran ~54px wide at the label's y-position; the innermost macro ring (`r=32`) on mobile has its band at ~±27 from CX at that y, so the text clipped through the ring's stroke.

**Fix.** Shrink + tighten the label when expanded so it fits cleanly inside the inner-most ring band — keep the label visible (Grace's explicit ask: "I don't want to hide the label, I just want it to fit"), drop fontSize from 10 → 8 and letterSpacing from 0.8 → 0 only when `expanded`. At fontSize 8 with no extra tracking, "REMAINING" is ~38px wide → ±19 from CX, well inside the inner ring's ~±27 band. Collapsed mode keeps the original 10pt + tracking 0.8 for readability.

**Files:**
- `apps/mobile/components/charts/CalorieRing.tsx` — `fontSize: expanded ? 8 : 10` + `letterSpacing: expanded ? 0 : 0.8`. The `<Text>` element renders in both modes; only the typography shrinks.
- `src/app/components/suppr/daily-ring.tsx` — same shape on web (`text-[9px] tracking-normal` when expanded, `text-[11px] tracking-wider` when collapsed). Web's bigger ring (160 vs 140) means the overlap was less severe — calculation suggests it actually fit with margin — but the symmetric shrink keeps the label sitting comfortably inside the inner ring rather than grazing it.

**Why shrink rather than hide.** The label tells the user what the number means (REMAINING vs LOGGED — toggled by long-press on mobile, by mode pill on web). Hiding it on expand would lose that semantic anchor; the user would have to remember the mode they were in. Shrinking preserves the anchor while resolving the visual collision.

**Verified.** Web typecheck clean. Mobile typecheck clean. No tests touched (the label content is presentational; existing snapshot tests didn't pin typography sizes). **Grace should eyeball both platforms after pulling — the visual is the authoritative test.**

**Net code change:** Two ternary expressions on the label's typography props (one per platform), ~30 LOC of explanatory comment across both files. 0 behaviour change in collapsed mode. Expanded mode shows the label at smaller-but-still-readable size, no longer clipping the macro rings.

### 2026-04-28 — Next-10 #13 done (shared SubTab primitive)

**Done.** Closes the F5 finding from the teardown ("the implementation isn't a sub-tab system; it's two custom pill components and listener hacks that defeat the tab framework's defaults"). The pre-Phase-4 codebase carried five near-identical inline sub-tab pill implementations:

- `apps/mobile/components/tabs/RecipesSubTabHeader.tsx` — its own inline `SubTabPill` (130 LOC)
- `apps/mobile/components/tabs/PlanSubTabHeader.tsx` — its own inline `SubTabPill` with badge support (147 LOC)
- `apps/mobile/components/tabs/YouSubTabHeader.tsx` — its own inline `SubTabPill` with `minWidth: 92` quirk (135 LOC)
- `src/app/App.tsx` `RecipesSubTabPill` (inline ~35 LOC)
- `src/app/App.tsx` `YouSubTabPill` (inline ~35 LOC)

Plus an inline Plan/Shop pill row buried in App.tsx's `case "plan"` render (~30 LOC).

**Replaced with:** one shared primitive per platform, byte-identical contract.

- `apps/mobile/components/ui/SubTabPill.tsx` — new file, ~180 LOC including JSDoc and the inner `Pill` row component. Exports `SubTabPill<TId>` with `items: { id, label, badge?, accessibilityLabel? }[]`, `activeId`, `onSelect`, `accessibilityLabel`, optional `scrollable` for the ≥3-pill case. Selection haptic fires on iOS automatically. Re-tap on active is a no-op.
- `src/app/components/ui/sub-tab-pill.tsx` — new file, ~95 LOC. Same prop shape, Tailwind-styled (`bg-muted` track, `bg-card text-primary` active state). Exposes `className` for host margin / sticky-header wrapping.

**Refactored consumers:**

- Mobile `RecipesSubTabHeader.tsx`: 130 → 41 LOC
- Mobile `PlanSubTabHeader.tsx`: 147 → 53 LOC
- Mobile `YouSubTabHeader.tsx`: 135 → 56 LOC
- Web `App.tsx` `RecipesSubTabPill` + `YouSubTabPill` + inline Plan/Shop pill row: ~95 → ~50 LOC

Total: ~672 → ~395 LOC across the consumer files. Plus ~275 LOC of new primitive (mostly comments and types). Net: similar overall LOC, but the duplication is gone — every sub-tab pill in the product now flows through one component on each platform.

**Why this matters (F5 close-out).** The teardown's F5 finding said: "the navigation model is still being negotiated against itself in production code, this week" with `RecipesSubTabPill` and `YouSubTabPill` as the canonical example. With the primitive landed, future agent sweeps that need to add a sub-tab group don't write inline pill JSX — they import `SubTabPill` and pass an items array. The consistency that was a doc-and-prayer is now structural.

**Cross-platform parity preserved.** Same `SubTabItem` shape on both platforms. Same accessibility labels (`accessibilityLabel` on mobile / `aria-label` on web). Same selection-no-op behaviour. Same badge formatting (`>99 → "99+"`). The only intentional divergence is rendering (RN Pressable + StyleSheet vs Tailwind classes) — that's the platform boundary, by definition.

**Existing tests preserved.** `apps/mobile/tests/unit/tabStructurePhase2.test.tsx` exercises `RecipesSubTabHeader`, `YouSubTabHeader`, `PlanSubTabHeader` via accessibility-label queries (`getByLabelText("Library")`, `fireEvent.press(getByLabelText("Discover"))`, etc.) and pins `router.replace("/(tabs)/discover")` semantics. The new primitive preserves all of these — labels match, click handlers fire, no-op-on-active-tab still works. Static read confirms test expectations align with the new render shape; **Grace runs `npm run mobile:test` locally to confirm.**

**Verified.** Mobile typecheck clean. Web typecheck clean. Mobile lint: same baseline (no new warnings from the primitive — the no-restricted-syntax style rules are scoped to today/ tree, which the new primitive doesn't touch). Web lint: 0 errors / 91 warnings (up by 2 from the baseline 89 — both are pre-existing in App.tsx unrelated to this change: `HouseholdPanel` and `signOut` unused).

**Net code change:** ~280 LOC removed from consumer files, ~275 LOC added in two new primitives + JSDoc. 0 behaviour change. 0 new dependencies.

### 2026-04-28 — Next-10 #14 partial (Desktop Today week sidebar primitive built, wiring deferred)

**Done.** New web component `src/app/components/suppr/today-week-sidebar.tsx` — compact 7-row strip suitable for the desktop right rail of Today. Each row: short day label, today tag (when applicable), calorie progress bar (success-green in-range, warning-amber over-target — never red, per `brand-guidelines.md` Section 9), kcal total or em-dash, chevron on the active row only. Rows are tappable; firing `onSelectDayKey` flips Today's selected date.

**Why a separate primitive instead of reusing `<TodayWeekView>`.** `TodayWeekView` is a 271-line full-screen component built for week-mode (vertical bar chart, weekly macro adherence bars, totals card). The teardown's vision was different — "compact strip in the desktop right rail" — and squeezing the existing component into a 260px sidebar would have meant either a hostile shrink or a boolean prop with two divergent layouts. Cleaner to ship a purpose-built component for the sidebar use case. The two coexist: mobile + mobile-web continues to use `TodayWeekView` via the day/week toggle; desktop uses `TodayWeekSidebar` as a permanent rail.

**Wiring deferred (intentional).** The host wiring point is `src/app/components/NutritionTracker.tsx`'s outer return wrapper (line 1705). NutritionTracker is a 2,600-LOC file Grace has actively committed to multiple times this session; restructuring its outermost JSX wrapper for a 2-column flex layout is a real conflict surface. The component's JSDoc carries the canonical wiring snippet — when Grace pulls a clean main, it's a 10-line edit to land. Until then, the primitive is dead code with no production impact.

**Wiring snippet (ready for Grace, copy-paste into `NutritionTracker.tsx` line 1705):**

```tsx
return (
  <div className="mx-auto px-pm-5 py-pm-5 lg:flex lg:gap-6 lg:max-w-[1024px] lg:px-pm-6">
    <div className="max-w-2xl flex-1 min-w-0">
      {/* existing tracker content stays inside this inner div */}
      ...
    </div>
    <aside className="hidden lg:block w-[260px] flex-shrink-0 sticky top-4 self-start">
      <TodayWeekSidebar
        byDay={nutritionByDay}
        calorieTarget={effectiveCalorieTarget}
        activeDateKey={selectedDateKey}
        todayDateKey={todayKey()}
        onSelectDayKey={(k) => setSelectedDateKey(k)}
      />
    </aside>
  </div>
);
```

The existing `<div className="max-w-2xl mx-auto px-pm-5 py-pm-5">` outer wrapper becomes the lg-flex shell with the inner `max-w-2xl flex-1` taking over the centring at `lg-` breakpoints.

**Verified.** Web typecheck clean. Web lint clean for the new file (`npx eslint src/app/components/suppr/today-week-sidebar.tsx` exit 0). No tests added — the primitive is data-driven and small; a contract test would only verify accessibility-label patterns, not particularly valuable as a regression-prevention pin until the component is wired and the integration shape settles.

**Net code change:** 1 new file (~210 LOC including JSDoc + types). 0 production code touched (deferred). 0 new dependencies.

### 2026-04-28 — Next-10 #14 wiring landed (sidebar live on desktop)

**Done.** Wired `<TodayWeekSidebar>` into `src/app/components/NutritionTracker.tsx` at the end of the return (just before the outer `</div>`). Used fixed positioning (`hidden xl:block fixed top-20 right-4 w-[260px] z-30`) instead of restructuring the outer wrapper — this is a smaller diff and avoids touching layout the rest of the tracker depends on.

**Why xl breakpoint, not lg.** At `lg` (≥1024px), the layout is `DesktopSidebar (~240px) + max-w-2xl tracker (672px) + sidebar (260px)` ≈ 1172px needed. Below ~1280px the sidebar would overlap the tracker's right edge. `xl` (≥1280px) gives clearance with breathing room. Below `xl` the rail hides and the user falls back to the mobile-web day/week toggle.

**Why fixed-position, not flex restructure.** The teardown's wiring snippet (in JSDoc on the component) used a flex container approach that required rewrapping the entire 980-LOC inner JSX of `NutritionTracker.tsx`. Fixed-position lets the sidebar sit in the viewport-edge gutter at xl without touching any of the existing layout — cleaner diff, no risk of breaking inner layouts that assume max-w-2xl context.

**Trade-off accepted.** Fixed positioning means the sidebar doesn't scroll with the tracker. For a "look at the week" rail, that's actually the right behaviour — the user always sees the same 7-day strip regardless of how far they've scrolled into Today's content. If the design intent later shifts to a scroll-with-content pattern, swap fixed → sticky and add the flex wrapper from the JSDoc snippet.

**Files touched (this round):**
- `src/app/components/NutritionTracker.tsx` — added one import line + ~15 LOC of JSX (one component render + comment) at the end of the outer return.

**Verified.** Web typecheck clean. Lint clean for the new wiring (`NutritionTracker.tsx` lint output is just pre-existing unused-import warnings unrelated to this change). Component renders only at `xl+`, so mobile-web is unaffected.

**Net code change:** 1 import + ~15 LOC of JSX. 0 layout regressions on mobile-web.
