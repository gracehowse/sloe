# Customer-Lens First-Session Audit — Suppr (2026-04-28)

**Owner:** customer-lens specialist
**Status:** Findings — pending Phase 6 design synthesis
**Scope:** first-time-user walkthrough × 3 personas (TestFlight new install, desktop web new install, iPhone Safari)

---

## 1. Executive verdict

**Tier perceived by a first-time user: ~B+. Strong concept, premium typography and palette, but at least one P0 trust-rupture per persona.**

The product looks and reads as 2026-modern in patches — Today's ring + macro tiles, Library card type, the landing hero — and as 2022-era in the seams: dialogs that still say "Coming in Phase 3", a marketing landing that displays a tab bar (Today / Discover / Plan / Progress / Profile) that no longer matches the mobile app's actual tab bar (Today / Recipes / Plan / You), and a public landing trust strip that lists nutrition sources the just-onboarded user will never recognise.

A normal user opening Suppr cold will think: "this looks nice, but it keeps telling me about phases and previews — am I a beta tester they forgot to tell?"

---

## 2. Persona A — TestFlight new install (mobile native)

### A.1 Step-by-step

**Step 1 — App launches into onboarding-v2.** `apps/mobile/app/_layout.tsx` plus the tabs gate at `(tabs)/_layout.tsx:81-83` redirect any session-without-onboarding-completed to `/onboarding`. Legacy `app/onboarding.tsx:276-287` redirects to `/onboarding-v2` if the v2 flag is on (100% rollout). MobileFlow component at `mobile-flow.tsx:28` mounts.

What lands well: typography is calm and modern; one decision per screen; sex defaults to `unspecified` (no silent BMR corruption); activity defaults to `sedentary` (no silent ~14% TDEE inflation).

What confuses: the **terminal step is "recipes" — the user is asked to pick ≥ N recipes before they can continue**, with the button reading "Pick {n} more to continue" (`mobile-flow.tsx:46-54`). A first-time user has no priors yet — they don't know what the recipes will be used for. This is asked before they've even seen Today. Expected: pick recipes after I've seen the home, when "build my plan" makes sense. Actual: a mandatory taste test before login completes.

**Step 2 — First load of Today.** The gate at `(tabs)/_layout.tsx:69-75` flashes an `ActivityIndicator` with `Accent.primary` while it fetches `profiles.onboarding_completed`. No skeleton, no progressive content. Felt: brief but clinical.

Then Today renders. The user sees the ring hero, macro tiles, the meals section. The ring is the "remaining" view, but `calorieDisplayMode` defaults to `"consumed"` (line 304). On a fresh install the user sees `0 / 1,800 kcal`. The number 0 is prominently centered. **A first-timer will read this as broken before they read it as empty.**

**Step 3 — User taps the prominent FAB to log a meal.** The `LogFab` component at `LogFab.tsx:51-67` is the most visible CTA on the screen — a 56pt primary-tinted circular button at bottom-right. Tapping it triggers a haptic, then:

```
Alert.alert(
  "Coming in Phase 3",
  "The unified log sheet ships in the next phase. For now, tap a meal slot or use the search/barcode/voice/photo affordances above.",
  ...
)
```

This is a **P0 trust rupture for the first-time user.** The single most prominent button on the home screen of a shipping app says "Coming in Phase 3". A normal user does not know what "Phase 3" is, and will conclude: *this app is not finished*.

(There IS a `LogSheet` component at `LogSheet.tsx` — it's built. The prop `onPress` on `LogFab` allows a host to wire it up. The Today screen does not pass `onPress`, so users see the placeholder.)

**Step 4 — User pokes meal slots instead.** Each slot has a `+` and a "Log usual" pill if a saved meal exists, plus a swipeable picker. This works. But the previous step has primed them to distrust the home screen.

**Step 5 — First meal logged via search.** `FoodSearchModal.tsx` opens. Results badged with `SourceDot` (USDA / OFF / etc.). Trust posture is good here — the source is named on every row.

**Step 6 — User explores "Recipes".** The Recipes tab lands them on Library (sub-tab toggle to flip to Discover). Library is empty. Empty state has no curated CTA that says "go save your first one"; the user has to discover the sub-tab toggle and pivot to Discover themselves.

**Step 7 — User tries Plan.** With no recipes saved yet, "Generate plan" produces placeholder slots or an empty state. A first-time user will not know whether the plan is supposed to populate from saved recipes or from Discover.

**Step 8 — User finds You.** Routes to Progress. Progress for a Day 0 user has weight-projection charts that won't render and weekly recap blocks that won't trigger. Settings + More live behind sub-tabs.

### A.2 The 3 most "I don't get it" moments — Persona A

1. **Tapping the prominent Log FAB and getting a "Coming in Phase 3" alert.** P0. The single biggest trust failure in the entire mobile app.
2. **Being asked to pick recipes inside onboarding before I've seen what the app is for.** P1. Premature commitment.
3. **Today shows "0 / 1,800 kcal" on first load with no welcome state.** P1. Looks like a broken or stale display, not an empty state.

---

## 3. Persona B — Desktop web new install

### B.1 Step-by-step

**Step 1 — Lands on `/`.** Hero reads "Import any recipe. Get real macros." with a `Get started — it's free` CTA pointing at `/onboarding`. Theme toggle in the top-right.

What lands: hero typography, the dual-mock visual (mini browser laptop + tilted iPhone), the chip "Paste a TikTok, get real macros".

What confuses: the **iPhone mock's tab bar shows Today / Discover / Plan / Progress / Profile** (`LandingPage.tsx:424-448`). The actual mobile app collapsed this to 4 tabs (Today / Recipes / Plan / You) on 2026-04-27. A user who downloads from the App Store will land in a different tab structure than the marketing taught them. **P1 trust drift; will read as the marketing being from "an old version".**

**Step 2 — Click "Get started — it's free".** Lands at `/onboarding` which 307s to `/onboarding/v2`. Web flow uses `<WebFlow>`. The metadata still says `(preview)` in the title (`v2/page.tsx:26-39`) and the page is `robots: { index: false }`. Browser tab title reads "Suppr — Onboarding v2 (preview)". A real user who notices the title will think "preview" means it's beta. **P2 trust slip.**

**Step 3 — Sign up step.** Supabase signUp inline at step 02. Email + password + magic-link, no credit-card ask. Good.

**Step 4 — Recipe seed step (terminal).** Same "pick ≥ N recipes" gate as mobile.

**Step 5 — Lands on `/home`.** `HomePageClient.tsx` → `<App>`. Sidebar on left (`DesktopSidebar`, 4 primary entries: Today / Recipes / Plan / You). Web sidebar matches mobile tab structure — that's parity working as intended.

**Step 6 — Web Today is `<NutritionTracker>`** (web) vs the mobile `(tabs)/index.tsx`. They are NOT the same component. Subtle visual differences exist (ring sizing, hero spacing, hero layout). A user who installs both will notice the web Today looks slightly less polished than mobile.

**Step 7 — Web Plan and Library.** Web Plan = `<MealPlanner>`. The "Move meal" affordance does not exist on web (mobile-only per memory). A power user who plans on mobile and switches to laptop loses the move-meal control. **P1 parity gap.** Web Library has a "Go Public" dialog that mobile does not have.

**Step 8 — Trying to log on web.** Web-side log entry is the `<NutritionTracker>` add-meal flow + search modal. There is no web equivalent of the "Log FAB" placeholder situation. The user has a button per meal slot. Felt: more conventional, less premium, but it works on first try.

### B.2 The 3 most "I don't get it" moments — Persona B

1. **Marketing landing shows a tab bar that doesn't match the app I install.** P1 trust drift.
2. **Onboarding tab title still says "(preview)".** P2 trust slip.
3. **Web Today and mobile Today look noticeably different in the same session.** P2 parity-feel gap.

---

## 4. Persona C — Mobile web (iPhone Safari) — Grace's flag

This is the hardest persona. A user on iPhone Safari hitting `suppr-club.com` runs the web bundle in a phone viewport. They see what desktop web shows, scaled down — not the native-feeling mobile app.

**Step 1 — Landing on iPhone Safari.** `LandingPage.tsx` is responsive at the marketing level. `landing.css:312-316` collapses the hero grid to a single column at `max-width: 960px`. `landing.css:277-281` hides the nav links at `max-width: 820px`. That's tolerable.

But the **`MiniBrowserMock` and `PhoneTodayMock` are absolutely positioned** in `.lp-hero-visual` (`landing.css:633-642`). On phone width, both become weird overlapping rotated cards. No media-query overrides. **P1 layout.** The trust strip is `flex-wrap: wrap` so the source list will wrap into 4-6 lines on phone — visually noisy.

**Step 2 — Click "Get started".** `/onboarding/v2` web flow. This was designed with a "narrative column" on the side (per the mobile-flow comment "No narrative column on mobile by design — the iPhone safe area can't carry it"). On iPhone Safari the user gets the WEB onboarding, not the native mobile-flow component.

**Step 3 — Lands on `/home`.** `HomePageClient.tsx` → `<App>`. The desktop sidebar at `DesktopSidebar.tsx:6-13` says "below 768px / md: we keep the native bottom-tab layout that mirrors the mobile app". Good — on iPhone Safari the user gets a bottom tab bar simulation, not a left sidebar.

But the **screens themselves are the desktop web screens**. `<NutritionTracker>`, `<MealPlanner>`, `<DiscoverFeed>`, `<Library>` — all written for desktop primary, with mobile-web added via responsive CSS. A user on iPhone Safari will:

- See web's NutritionTracker, not mobile's TodayHero/TodayWeekView/TodayMealsSection composition.
- See web's MealPlanner, which lacks the MoveMealSheet that mobile has.
- See the FAQ landing → onboarding tabs → web app — three different design eras stitched together.

**Step 4 — Trying to log on iPhone Safari.** The web meal-add controls were designed at desktop sizes. Tap targets, search modal heights, sheet spacing — all need separate scaffolding on mobile-web. **This is exactly what Grace flagged: "web is not optimised for mobile."**

### C.1 Specific iPhone-Safari regressions vs native (top 5)

1. **The landing hero visuals (mini browser + phone mock) are absolutely positioned and don't have phone-viewport overrides** (`landing.css:633-642`). Result: clipped or overlapping mocks on a real iPhone. **P1.**
2. **Onboarding-v2 web flow was designed with a narrative side column** which doesn't translate to phone width. The mobile RN flow explicitly removed it because "the iPhone safe area can't carry it" — but web on iPhone still has to.
3. **Today on mobile-web is `<NutritionTracker>`, not the mobile RN composition.** Macro tiles, ring sizing, sheet heights, FAB placement — none ported. The user feels they're on a desktop site shrunk down. **P0 versus the "premium 2026" bar.**
4. **Discover/Library card density is desktop-grid-driven** — `<DiscoverFeed>` and `<Library>` use grid columns calibrated for ≥ md. On phone the cards either go single-column with awkward whitespace, or they use a tight 2-column grid that is hard to tap.
5. **No "Log FAB" on mobile-web** — but also no equivalent canonical entry point. The user lands on Today and has to scroll to the meal slots and tap them. Feels less app-like, more website-like. **P1.**

### C.2 The 3 most "I don't get it" moments — Persona C

1. **The marketing hero collage breaks on phone width.** P1 first-impression failure.
2. **Today on mobile-web doesn't match the screenshots from the landing.** The landing teaches iPhone tab bar + ring + macro tiles. The mobile-web actual Today is web's NutritionTracker. P1.
3. **The mobile web app feels like a website, not an app.** No bottom-FAB, no haptic feedback, no native sheets, scrolling momentum is browser-native, etc. **P1 tier-perception.**

---

## 5. Cross-persona "I don't get it" moments — ranked

1. **Log FAB → "Coming in Phase 3" alert** (Persona A). **P0 trust rupture.**
2. **Onboarding terminal step is "pick recipes" before user has seen Today.** P1 sequence error.
3. **Marketing landing iPhone tab-bar mock shows old 5-tab structure** that doesn't match the actual app. P1.
4. **Today opens at `0 / 1,800 kcal` for a fresh user with no welcome layer.** P1.
5. **Onboarding-v2 page title is "Suppr — Onboarding v2 (preview)"** in the browser tab. P2.
6. **Mobile-web Today is the desktop NutritionTracker, not the mobile-RN composition.** P1 — Persona C feels the worst here.
7. **You tab default is Progress; Settings + More require sub-tab discovery.** P2 wayfinding.
8. **Plan on a fresh user is empty with no obvious "save 5 recipes first" handhold.** P2 journey gap.
9. **Web Plan has no Move-meal control; mobile does.** P1 cross-platform parity gap.
10. **Web Library "Go Public" exists, mobile Library has no parallel.** P2.

---

## 6. Cross-persona "feels prototype" moments

1. **"Coming in Phase 3" alert in the LogFab placeholder.** Direct prototype admission in production.
2. **Onboarding-v2 web `(preview)` title metadata.**
3. **Hero variant picker code path that's been hard-pinned to "ring"** but Bar / Number variants still ship in the bundle.
4. **Mobile RN onboarding has both `app/onboarding.tsx` (legacy) and `app/onboarding-v2.tsx`** with one redirecting to the other. Two parallel onboarding files = "we're mid-migration".
5. **Landing taught one product structure**, app delivers another — feels like the screenshots are from the old build.
6. **Day-0 ring shows `0 / 1,800` against a normal layout** rather than a "Welcome — log your first meal" overlay.
7. **Dead-on-web, alive-on-mobile** legacy onboarding code paths.

---

## 7. Mobile-web specific regressions vs native (Persona C)

Already top-5 above. Adding:

- **Browser-chrome on iPhone Safari eats vertical space**, but the web app doesn't account for it the way native does (no `useSafeAreaInsets`).
- **`useTheme` from next-themes hydrates async.** On mobile-web the theme can flicker on first paint (light → user-pref dark) — visible jank a native app doesn't have.
- **No native sheets** (e.g. `@gorhom/bottom-sheet`) on mobile-web — sheets are CSS-modal which can't be dragged closed.

---

## 8. Web-mobile parity gaps a user would notice (Personas A vs B)

| Surface | Web | Mobile | Severity |
|---|---|---|---|
| Today composition | `<NutritionTracker>` | `(tabs)/index.tsx` + TodayHero/Tiles | P1 — visually different |
| Plan move-meal | not present | `MoveMealSheet.tsx` | P1 (intentional per memory) |
| Recipe Go Public | `GoPublicDialog` | not present | P2 — intentional carve-out |
| Log FAB | not present | placeholder alert | **P0 — placeholder is worse than absence** |
| Onboarding shell | side narrative column | top-bar progress + step | P2 |
| Empty Library | grid empty | flat empty | P2 |

---

## 9. Top 20 user-perceived upgrades ranked by impact-per-effort

1. **Wire `LogFab` `onPress` to open `LogSheet`** (or hide the FAB until then). Tiny code change at Today; massive perceptual lift. **P0.** Owner: `executor`.
2. **Update marketing landing's `PhoneTabBar` to the 4-tab structure** (Today / Recipes / Plan / You). Simple constant flip. Owner: `ui-product-designer`.
3. **First-run "Welcome — log your first meal" overlay or empty-state panel on Today.** Replace the bare `0 / 1,800` first-paint. Owner: `ui-product-designer`.
4. **Reorder onboarding so the recipe-seed step is optional or post-completion**, not a hard gate. Owner: `journey-architect`.
5. **Remove the "(preview)" suffix from the onboarding-v2 page title.** Owner: `executor`.
6. **Mobile-web Today: build a phone-viewport composition that mirrors mobile-RN's TodayHero + macro tiles** instead of falling through to desktop NutritionTracker. The biggest single lift for Persona C. Owner: `ui-product-designer` + `executor`.
7. **Phone-viewport overrides for `LandingPage` hero collage.** Owner: `visual-qa`.
8. **Fix narrative-column behaviour on web onboarding-v2 at phone widths.** Owner: `ui-product-designer`.
9. **Web MealPlanner: port MoveMealSheet** (or its desktop equivalent — drag-and-drop). Owner: `executor`.
10. **Today Day-0 path: render a "Day 1 of your plan" hero** until the user has logged something. Owner: `ui-product-designer`.
11. **Library and Plan empty states**: explicit CTA to go save 5 recipes from Discover. Owner: `ui-product-designer`.
12. **Persona C: native-feeling sheets via `@gorhom/bottom-sheet` on web** (or a CSS approximation that supports drag-to-dismiss). Owner: `ui-product-designer`.
13. **Drop the dead `TodayHeroBar` / `TodayHeroNumber` files.** Owner: `executor`.
14. **Settings sub-tab discoverability inside You.** Add a Settings shortcut on Today (top-right). Owner: `ui-product-designer`.
15. **Persona C: bottom-tab layout actually mirrors the mobile-app tab bar at the same iconography and 4-tab order.** Owner: `design-system-enforcer`.
16. **Trust-strip on landing**: tighten wrap behaviour at phone width. Owner: `visual-qa`.
17. **Replace landing iPhone-mock avatar "GH"** with a neutral icon. Today reads as "Grace's app", not "your app". P3.
18. **Persona A: fade in Today instead of cold spinner.** Owner: `ui-product-designer`.
19. **Discover empty state**: surface "Save a creator from a recipe page" with a sample. Owner: `ui-product-designer`.
20. **Add a single Notion-style "command bar" or quick-search on Today** (CMD-K on web, search-pill on mobile). Owner: `ui-product-designer`.

---

## Routing recommendations

- **`executor` (P0)**: wire `LogFab` to `LogSheet`, remove "(preview)" title, drop dead variant files.
- **`ui-product-designer`**: Day-0 Today empty state, mobile-web Today composition, narrative-column phone behaviour, empty Library/Plan CTAs.
- **`journey-architect`**: onboarding terminal-step ordering (recipes → optional / post-Today).
- **`visual-qa`**: landing collage phone-viewport overrides, trust-strip wrap behaviour.
- **`design-system-enforcer`**: marketing landing tab-bar mock parity (4-tab not 5-tab), web/mobile Today parity sweep.
- **`product-lead`**: decide whether the recipe-seed step is mandatory at all (and whether mobile-web is a v1 product or a marketing fallback).
