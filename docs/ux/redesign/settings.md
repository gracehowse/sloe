# Settings / Profile / Account — Best-in-Class Redesign Spec

**Version:** 1.0
**Date:** 2026-06-02
**Author:** documentation-system (from audit by executor + Mobbin benchmark)
**Status:** Spec — not yet implemented. All flag paths must be preserved during any implementation.
**Cross-ref:** `apps/mobile/app/(tabs)/settings.tsx`, `apps/mobile/components/settings/SettingsBundleContent.tsx`, `apps/mobile/app/targets.tsx`, `apps/mobile/app/profile.tsx`, `apps/mobile/app/health-sync.tsx`, `apps/mobile/app/(tabs)/notifications.tsx`, `apps/mobile/app/household-settings.tsx`, `src/app/components/Settings.tsx`, `src/app/components/Profile.tsx`

---

## 1. Surface overview

**Purpose:** The trust-and-control centre of the product. Users land here to understand who they are in the system (tier, targets, goals), to customise how Suppr works for them (units, macros, fasting, notifications), to manage their subscription and data, and to take destructive actions when they need to. It is also the primary surface for household management, Apple Health integration, and data export.

**Role in the product:** Settings is the second-most-important surface after Today. It is low-frequency per session but high-stakes: a user who cannot find or trust their targets will never trust Today's numbers. A user who cannot easily manage or export their data will churn. A user who cannot fix their notification preferences will disable them entirely.

**Navigation position (mobile):** Reached from the Progress tab via the "Settings" row or the `/more` redirect. Not a bottom tab — intentionally one level down. Entry points also exist via deep-links in the search index (`fasting`, `daily-targets`, `notifications`, `health-sync`).

**Navigation position (web):** `src/app/components/Settings.tsx` and `src/app/components/Profile.tsx`, typically reachable from the user menu.

**Platform notes:**
- iOS is the primary surface. Web must reach parity on the two documented functional gaps (units/measurement system, notification reminder-time editor + per-kind toggles) — these are not intentional carve-outs, they are open gaps that must close.
- Apple Health, RevenueCat customer center, and the notifications inbox are mobile-native and have documented web equivalents (Stripe portal for billing, no Health equivalent, no inbox on web). These remain intentional divergences. **(ENG-1200, 2026-06-19)** Web `Settings.tsx` now surfaces a **Connections** card to match mobile reachability: a **Household** row (→ `?view=household-settings`, hidden when solo — same rule as mobile/Profile) and an **Apple Health** row that opens an *honest informational* explainer (HealthKit is iOS-only → connect in the iOS app; web Health data is read-only). The Apple Health row is informational, not a fake web connect — so "no Health equivalent" still holds. Gated behind `web_settings_connections_v1`.
- The settings shell (`settings.tsx`) renders `SettingsBundleContent.tsx` as its body. `SettingsBundleContent.tsx` is 3,451 lines — it is a legacy file over the 400-line limit. The redesign should target extraction of each card into its own component file (e.g. `components/settings/MembershipCard.tsx`, `GoalsCard.tsx`, etc.) with a thin shell. This is a separate ENG ticket but the spec anticipates it.

---

## 2. Current design audit — weaknesses

### Information architecture
- **No leading icons on rows.** Every navigational row is icon-free. Monarch and Oura both use a leading glyph per row, which dramatically speeds visual scanning without adding visual noise. The current design forces reading every label sequentially.
- **Right-aligned current values are inconsistent.** Some rows surface the current value as a subtitle (caffeine: "400 mg/day"), others as a trailing value, others not at all (Apple Health connection state is a subtitle but reminder time is just "Daily reminder at X" without a clearly parseable value). The pattern should be universal: trailing right-aligned value in Inter/small, muted colour — scannable without tapping.
- **Section eyebrows are inconsistent.** "Goals & targets", "Display & extras", "Connections", "App", "Legal" — some title-case, some not, lengths vary. Monarch and Oura both use short ALL-CAPS eyebrows (GENERAL / ACCOUNT / DATA SHARING) that group more aggressively and read faster.
- **Sign Out lives outside the bundle.** It is in `settings.tsx`, not in the card system. This means it has no section context and no icon. Visually it is detached from the Danger zone group, which creates confusion (is Sign Out destructive?). It should be in a named section: Sign Out is reversible (not destructive — amber/red are wrong) but it needs a home.
- **Search routes to a subset of rows.** The search index covers only fasting, daily-targets, notifications, health-sync. Users trying to find "units", "weekly recap", "alcohol limit", "household", or "export" find nothing. The search index should be expanded.

### Visual
- **Profile card is not editorial.** The `GradientAvatar` and tier-pill are functional but the card does not carry the warm-coaching aesthetic. The name is in sans; it should be in the serif display face (Fraunces/Newsreader) since it is the user's identity header — a meaningful editorial moment, not a data row.
- **Stats strip is visually thin.** The Recipes + Streak tile strip is rendered small and easily missed. Cal AI's two-tile stats strip uses enough height and type size to feel like a genuine progress signal. Suppr's strip collapses visually and the streak number is easy to overlook.
- **Macro display segmented control (Tiles/Bars) in Display & extras** is the right pattern but it is placed inside a card with four other switches. In isolation it reads as a minor preference; it is actually a primary-surface layout switch and deserves a clearer visual priority.
- **Danger zone card reads as afterthought.** Two rows in a standard card. The current presentation does not clearly communicate the weight of these actions. Comparables (Fitplan, Visible, Kit) all give destructive actions a distinct section heading and explicit consequence copy before the user reaches the action row.
- **Membership upgrade copy is functional but not warm.** "Upgrade your plan" is generic. The value articulation ("Unlimited recipes, multi-day plans, and AI logging") is good but buried in a subtitle. Oura's membership card treats the status inline as a first-class signal ("Active member") before the action — validating the current tier is as important as surfacing the next one.

### Functional gaps (must close in redesign)
- **Reminder-time editor is missing on mobile.** The Notifications row routes to the inbox (a read surface), not a prefs editor. Users cannot change their daily reminder time on mobile without going back to onboarding. This is a genuine functional gap — Blinkist, Oura, Duolingo all show that a toggle + inline time wheel is the correct pattern, and it is straightforward to add.
- **Per-kind notification toggles exist on web only.** Web `Settings.tsx` has showMealTimestamps, newRecipes, mealReminders, weeklyReport, creatorUpdates. Mobile has none. This is undocumented drift and must close.
- **Measurement system (units) is web-only.** `profiles.measurement_system` is editable on web via both `Settings.tsx` and `Profile.tsx`. Mobile Settings and Profile have no units row. Mobile always presents metric inputs (g/kg/ml). This affects every body-stat input and every nutrition label.
- **Body-stat editor (weight/height/sex/age/activity/goal/pace/strategy) is fuller on web.** Web `Profile.tsx` edits all of these. Mobile `/profile` edits only macros, name, and dietary prefs. Body stats on mobile are edited in onboarding or in `GoalPaceEditorSheet` (flag-gated). This is a partially-intentional divergence (GoalPaceEditorSheet is the mobile path when the flag is on) but needs explicit documentation and the flag must ship.

### Accessibility
- No current evidence of `accessibilityLabel` on toggle switches in the bundle. All switches need an accessible label that states both the preference name and current value (e.g. "Track caffeine, currently off").
- Destructive confirm modals must announce clearly to VoiceOver. The type-to-confirm gate (`Alert.prompt`) is native iOS — accessibility is good — but the consequence lists in the modals need `accessibilityRole="text"` and clear reading order.
- Minimum tap target: all rows must be at least 44pt tall (standard iOS/web tap target). The current card rows are visually adequate but this should be verified after redesign.

---

## 3. Component-by-component redesign spec

---

### 3.1 Settings shell + navigation spine

**Current purpose:** Hosts a back chevron, title "Settings", subtitle "Plan, targets, and how the app shows up.", search input, the SettingsBundleContent body, and a Sign Out row below.

**Current weaknesses:** Sign Out is orphaned. The subtitle is functional but cold. The shell does not breathe — title → search → body in rapid succession. Search is undersized relative to its importance (it is the fastest path to most settings).

**Best-in-class benchmark:**
- Monarch settings list spine: https://mobbin.com/screens/11351d0b-d3c8-48f3-be6f-43d16376c4e4
- Oura settings index (section eyebrows, grouped rows): https://mobbin.com/screens/396364e9-e781-44d3-a7e9-15d5bcc2190a
- Monarch footer (wordmark + version + red Sign Out row): https://mobbin.com/screens/c06dfa2a-c4d5-4d34-bfcc-0ddc0f68328a

**Proposed redesign:**

_Layout and spacing_
- Screen background: `#FFFFFF`. Section backgrounds: `#F6F5F2` (soft warm-grey cards). Row separator: `#ECEAE4` hairline.
- Title "Settings" in Fraunces/Newsreader Display, 28sp, `#1B1814` ink. No subtitle (the profile card below makes context immediately visible — the subtitle is redundant and cold).
- Search bar full-width, 12px top margin from title, rounded `radius-lg`, `#F6F5F2` fill, `#ECEAE4` border, Inter/14 placeholder "Search settings…". Leading magnifier glyph (lucide `Search`).
- Sections use ALL-CAPS eyebrow labels: PROFILE · MEMBERSHIP · GOALS & TARGETS · DISPLAY · CONNECTIONS · DATA & EXPORT · LEGAL · DANGER ZONE. 11sp Inter, letter-spacing +0.08em, `#7C8466` (muted sage). 24px vertical padding above each eyebrow, 8px below.
- Sign Out moves into a new "ACCOUNT" section (after Legal, before Danger Zone), rendered as a standard row (lucide `LogOut` icon, `#1B1814` label, no destructive colour — it is reversible). This resolves the orphaned-row problem.

_Search index expansion_
Expand `settingsSearchIndex.ts` to cover: units, measurement system, weekly recap, alcohol limit, caffeine limit, household, export, reset, delete, dietary, theme, macro display, promo code. Each with a route or modal target.

**States:** default (scrollable list); search-active (filtered to matches or "No results for 'X'" in Inter/14 muted); loading (skeleton cards with shimmer on first mount, max 400ms before fallback); no-user ("Sign in to manage settings." centred message).

**User benefit:** Faster scanning via section structure and leading icons. Sign Out no longer orphaned or ambiguous. Search covers the full settings surface.

---

### 3.2 Profile card + stats strip

**Current purpose:** Identity header — avatar, display name, tier + join label, then a stats strip with Recipes saved and Streak tiles.

> **Shipped 2026-06-04 — "Your name" field (greeting personalisation), inside a "Personal" group.** An editable "Your name" field lives at the top of the settings list inside a general **Personal** settings group on both platforms (identity comes first). On **mobile** it is the first row of the `Personal` section (`SectionHeading title="Personal"` → `SettingsCard` `testID` `settings-card-name`, with an in-card "Your name" label above the input `settings-bundle-name-input`). On **web** it is the first row of the `Personal` card (renamed from "Account" on 2026-06-04), labelled "Your name" above the input `data-testid` `settings-name-input`. The group name "Personal" is identical on both platforms (sync-enforcer parity). The field writes the auth user's `user_metadata.full_name` via the shared `saveDisplayName` helper (`src/lib/account/displayName.ts` → `supabase.auth.updateUser({ data: { full_name } })`), trims input, and treats empty/whitespace as "clear" so the Today greeting falls back to "Good morning". This is the in-app way to set the name the Today greeting personalises from (previously the name only arrived via Apple Sign-In's FULL_NAME scope). It is distinct from the read-only **Display Name** field, which still mirrors the `profiles.display_name` column (the `/profile` editor's domain — on web, Display Name is the third row of the same Personal card). The Today greeting now reads `user_metadata` (via the shared `firstNameFromMetadata`) on both platforms. Placement parity is pinned by `tests/unit/settingsYourNameParity.test.ts`. See `docs/decisions/2026-06-04-settings-your-name-greeting.md`.
>
> **Update 2026-06-04 (Grace) — relocated from a lone "Your name" card into the Personal group.** The first cut shipped the name as a standalone "Your name" card/section; Grace asked for it to be "a general part of the user's personal settings". Mobile renamed the `SectionHeading` "Your name" → "Personal" and added the per-field "Your name" label inside the card; web renamed the "Account" card heading → "Personal" (the name field was already the first row of that card). No logic change — the greeting wiring (`saveDisplayName`, on-blur commit, post-save `getSession()` refresh) is unchanged.

**Current weaknesses:** Name in sans. GradientAvatar is generic. Stats strip is visually thin and easily skipped. Subtractive-zero rule (hide at 0) is correct but when both tiles show, the strip lacks the visual weight to feel like a progress moment.

**Best-in-class benchmark:**
- Oura "My profile" personal information + goals: https://mobbin.com/screens/1fa86d34-8192-426b-96af-903d76a35f35
- Cal AI progress header with two-tile stats (weight tile + streak tile with weekday dots): https://mobbin.com/screens/8d3cf983-af91-4151-9dc2-0c250e57421b

**Proposed redesign:**

_Profile card_
- Background: `#F6F5F2` card, `radius-lg`, 16px padding, `#ECEAE4` border.
- Leading icon: `GradientAvatar` replaced with a circular monogram in terracotta (`#C2683E`) background, initial letter in white Fraunces 20sp. 48×48pt. This is the only "colour block" allowed on this surface per the accent-only rule; it is small enough to qualify as accent, not hero.
- Name: Fraunces/Newsreader 20sp bold, `#1B1814`. This is the user's editorial identity — it earns the serif display.
- Tier + join label: Inter 13sp, `#7C8466`. Format: "`Pro · Joined May 2026`" or "`Free · 2 weeks ago`". Tier pill retained as a small terracotta pill only when tier = pro (reward signal). Free users see no pill (avoids making "Free" feel like a penalty marker at the top of the screen).
- Tap target: the whole card navigates to `/profile` (web and mobile). Right-trailing lucide `ChevronRight`.

_Stats strip (inline below profile card, same section)_
- Two tiles, side-by-side, `#FFFFFF` background, `radius-md`, `#ECEAE4` border, equal width.
- **Recipes tile:** lucide `BookOpen` (sage, 16pt), "Recipes saved" Inter 11sp muted, count in Fraunces 24sp terracotta. Hidden at 0 (existing rule).
- **Streak tile:** lucide `Flame` (terracotta, 16pt — restrained single-colour icon, not the cartoonish Cal AI variant), "Day streak" Inter 11sp muted, count in Fraunces 24sp `#1B1814`. Below the count: 7-dot weekday row (M T W T F S S, each dot 8×8pt filled sage if logged, `#ECEAE4` if not, filled terracotta for today-if-logged) — borrowed from Cal AI but in warm tokens. **Hard gate:** dots are computed from the same `computeProtectedStreak(byDay, freezeLedger, budgetMax)` call used by Today and Progress. A freeze day shows the dot as a small terracotta ring (not filled) to signal "protected, didn't log". Hidden at 0 (existing rule). Whole strip hidden if both are 0.

**Microcopy (calm coach voice):** No "Keep it up!" or gamified exclamations. The numbers speak. If streak = 1, no special copy. If streak hits a milestone (7, 30, 100), the tile shows a small terracotta asterisk and a `WhatsNewSheet` can surface a milestone note — but this is additive and flag-gated (`streak_milestones` flag).

**States:** loading (skeleton placeholders); 0/0 (both tiles hidden, no strip rendered); recipes=0, streak>0 (one tile); error (silent, strip hidden — no error state shown here, the content is non-critical).

**User benefit:** Editorial warmth on the identity header. Streak weekday-dot grid makes the protected-streak model legible without explanation. Stats feel like progress signals, not metadata.

> **Shipped 2026-07-01 — ENG-1246 (Gap #16): the shared editorial Profile block.** The identity + streak-dots + milestones + recipe-grid block is now a real shared component behind the default-on `sloe_v3_profile` flag (kill switch: PostHog off / remove from `REDESIGN_DEFAULT_ON`). Both platforms render `EditorialProfileBlock` (web `src/app/components/profile/EditorialProfileBlock.tsx`, mobile `apps/mobile/components/profile/EditorialProfileBlock.tsx`) with the SAME information architecture: **identity** (monogram + name + tier·joined + Pro pill) → **streak dots** (a 7-day trailing row: logged = sage, frozen = muted, missed = faint, today ringed) + a **best-streak / freezes-in-hand line** → **milestones list** (the existing `STREAK_MILESTONES` 3/7/30/100 thresholds, each achieved/next) → **recipe grid** (up to 6 saved-recipe tiles + "See all"). All shaping is pure and shared in `src/lib/profile/editorialProfileBlock.ts` (`buildEditorialProfileBlock`) — dots + best-streak + milestones derive from the SAME `computeProtectedStreak(byDay, freezeLedger, budgetMax)` inputs Today/Progress use, so the numbers can't drift; it is **display-only** (no new queries, no writes). The displayed best streak and the milestones both follow `max(bestStreak, currentStreak)` (ENG-1246 review fix M1): a freeze can bridge a gap that the raw `computeBestStreak` walk resets on, so flooring at the live protected streak stops "best" ever rendering below the current streak and stops an already-crossed landmark showing as "next up". Both platforms hydrate the most recent ~400 log days, so "Best streak" is a best-recent run in that window, not a verified all-time high (no full-history fetch). Web reads already-loaded `savedRecipesForLibrary`; on mobile the heavy `useSavedLibraryRecipes` hook now fires **only on the flag-ON path** (M2 — it is passed a null userId when the flag is off, short-circuiting to `[]`), and the flag-OFF kill-switch keeps a cheap `head:true` `saves` COUNT for its recipe count. The flag-ON count is the Library-consistent set (drops orphaned saves, includes user-authored), not equivalent to the old head-count. The legacy "More" hub (web) / identity strip (mobile) were extracted to `ProfileHubHeader` / `ProfileIdentityStrip` and remain the flag-off kill-switch path; both pinned screens net-shrank as a result. Streak-dot / best-streak / milestone logic is pinned by `tests/unit/editorialProfileBlock.test.ts`; the flag's default-on parity by `tests/unit/redesignDefaultOnParity.test.ts`. Deviations from this §3.2 spec: dots use the neutral `success`/`muted` tokens (not the terracotta accent — the accent palette differs post-aubergine, 2026-06-08) and a milestones **list** replaces the single asterisk (the ticket asked for the list; the `streak_milestones` asterisk idea is superseded here).

---

### 3.3 Membership card

**Current purpose:** Upgrade CTA (free → Pro), manage subscription (export-first interstitial → RevenueCat), promo code input.

**Current weaknesses:** Upgrade copy is generic. "Manage subscription" row does not signal it routes outside the app (to RevenueCat or App Store). Promo code expander is collapsed but has no visual affordance of the interaction.

**Best-in-class benchmark:**
- Oura "Manage membership · Active member" row with external-link glyph: https://mobbin.com/screens/396364e9-e781-44d3-a7e9-15d5bcc2190a
- Monarch "Billing →" inside settings: https://mobbin.com/screens/c06dfa2a-c4d5-4d34-bfcc-0ddc0f68328a

**Proposed redesign:**

_Tier = free_
- Card eyebrow: MEMBERSHIP
- Row 1: leading `Star` glyph (terracotta), "Upgrade to Pro" Inter 15sp bold, subtitle "Unlimited recipes · AI logging · multi-day plans" Inter 13sp muted. Right-trailing terracotta pill "PRO" + `ChevronRight`. Tap → `/paywall?from=settings`.
- Row 2 (promo): "Have a promo code?" Inter 13sp `#7C8466`, leading `Tag` glyph. Tap → expands inline input (no separate row). The expand animation: `LayoutAnimation.easeInEaseOut` or CSS `grid-template-rows: 0→auto` with 200ms ease. Input placeholder "Enter code", Apply button terracotta CTA, success refetches profile, error shows inline "Code not recognised" in amber.

_Tier = pro (or base)_
- Row 1: leading `CheckCircle` glyph (success green), "Pro member" Inter 15sp bold, subtitle (join date or next renewal if available) Inter 13sp muted. No CTA — this row is informational.
- Row 2: leading `CreditCard` glyph (sage), "Manage subscription" Inter 15sp, trailing lucide `ExternalLink` 14pt muted (signals external route). Tap → **CancelExportPromptSheet** (existing export-first interstitial — do not remove; it is a retention mechanism above the comparable's bar) → RevenueCat customer center or App Store subscriptions URL fallback.
- Row 3 (promo): same as free tier.

_Fitplan note (subscription-delete trap):_
Add a single line to the delete-account confirmation text (section 3.11): "Deleting your account does not cancel your subscription. Manage it first in Membership." This prevents the support trap Fitplan documents. Does not require a change to this card.

**States:** loading (shimmer row); Pro (as above); Free (as above); error on promo Apply (inline amber text, no toast).

**User benefit:** Oura's inline status signal ("Active member") dignifies the Pro tier at every Settings open — it is a daily micro-reward. The promo code expander is less noisy. The external-link glyph sets expectations before the route.

---

### 3.4 Goals & targets card (settings entry points to `/targets` and `/profile`)

**Current purpose:** Entry point to the full targets/profile sub-screens plus inline configuration for dashboard widgets, week start, deficit window, caffeine limit, alcohol limit, and fasting window.

**Current weaknesses:** The subtitle logic for the Daily targets row is already excellent (`resolveTargets` states, loading shimmer, fallback vs computed) but renders as a single long subtitle string. The sub-screen entry and the inline-config rows are visually indistinguishable — the hierarchy between "navigate to a sub-screen" and "open a modal" is not clear. Deficit summary window and weekly recap are easy to miss since they have no leading icon.

**Best-in-class benchmark:**
- Bevel "Your Nutrition Goal" with TDEE + ring: https://mobbin.com/screens/0ff75dae-9bfb-4487-9d4c-c63f68357a35
- Bevel custom goal editor with g/% toggle: https://mobbin.com/screens/160279f6-cdbd-45a9-8923-d68526e7fbe8
- MFP "How we make recommendations" link: https://mobbin.com/screens/141dc9ed-8416-43ed-a159-bb83aeb4f276

**Proposed redesign:**

_Visual hierarchy_
Sub-screen navigation rows (Daily targets, Dashboard widgets, Intermittent fasting) get a `ChevronRight` trailing indicator. Modal rows (Week starts on, Deficit summary, Caffeine limit, Alcohol limit) get a right-aligned value-chip trailing indicator and no chevron — the value chip is the action affordance (tap changes it in a sheet).

_Row-by-row spec_

**Daily targets** — leading `Target` glyph (terracotta). Primary label "Daily targets". Trailing: current calorie value in Inter 13sp terracotta (e.g. "1,850 kcal"). Subtitle: current macro summary "92P · 210C · 58F" Inter 12sp muted below the primary label. State: loading → subtitle "Calculating…" (no value flash); fallback → trailing "(defaults)" in amber. Tap → `/targets`.

**Dashboard widgets** — leading `BarChart2` glyph (sage). Primary label "Dashboard widgets". Trailing: capitalized tracked-macros short list "Protein, Carbs, Fat" truncated at 24ch, `ChevronRight`. Tap → widget picker modal (existing — no changes to the modal logic).

**Week starts on** — leading `Calendar` glyph (sage). Primary label "Week starts on". Trailing value chip: "Monday" or "Sunday" in Inter 13sp terracotta. Tap → week-start sheet.

**Deficit summary** — leading `TrendingDown` glyph (sage). Primary label "Deficit window". Trailing value chip: "This week" or "Last 7 days". Tap → deficit-window sheet.

**Caffeine limit** — leading `Coffee` glyph (sage). Primary label "Caffeine limit". Trailing value chip: "400 mg" or "Off" (when 0). Only rendered when `trackCaffeine` switch is on (existing rule — keep it).

**Alcohol limit** — leading `Wine` glyph (sage). Primary label "Alcohol limit". Trailing value chip: "196 g/wk" or "Off". Only rendered when `trackAlcohol` switch is on (existing rule — keep it).

**Intermittent fasting** — leading `Moon` glyph (sage). Primary label "Intermittent fasting". Trailing value chip: "16:8" or current window label. `ChevronRight`. Tap → `/fasting`.

_Weekly recap push row_ — move from the Connections card (where it currently sits, oddly) to Goals & targets, since it is a goal-tracking output, not a connection. Leading `Bell` glyph (sage). Trailing value chip: "Sun 18:00" or "Off". Tap → weekly-recap push sheet (existing modal, no logic change).

**States:** as per existing bundle (loading shimmer on Daily targets subtitle, fallback amber, computed state). All other rows are synchronous.

**User benefit:** Icon-led hierarchy eliminates the read-every-label problem. Value chips let users see current state without opening. Separating nav-to-screen from modal-open via chevron vs value-chip removes the IA ambiguity.

---

### 3.5 `/targets` sub-screen (read surface)

**Current purpose:** Full targets read surface. Calorie ring, TDEE/maintenance caption, macro tiles, goal card, "How is this calculated?", Recalculate button, optional GoalPaceEditorSheet.

**Current weaknesses:** The calorie ring is a full-sweep gradient ring — it is a display artefact, not a progress indicator — but it currently uses the same visual language as Today's progress ring. This creates a false read ("am I over?"). The TDEE caption is accurate but densely packed as a single string. The macro tiles are small. The "How is this calculated?" affordance is below the fold.

**Best-in-class benchmark:**
- Bevel "Your Nutrition Goal" ring + TDEE delta caption: https://mobbin.com/screens/0ff75dae-9bfb-4487-9d4c-c63f68357a35
- Alma serif-display goal editor (editorial big numeral): https://mobbin.com/screens/62ab3fde-7b8d-4904-9860-4a6d4b9a23e2
- MFP "How we make recommendations" affordance: https://mobbin.com/screens/141dc9ed-8416-43ed-a159-bb83aeb4f276

**Proposed redesign:**

_Header block_
- Screen title "Your targets" in Fraunces 28sp bold, `#1B1814`.
- Calorie ring: render as a **static display ring** (not a progress arc). Full 360° ring in a terracotta-to-sage gradient, opacity 0.4 — clearly a design element, not a progress indicator. Big calorie number inside: Fraunces 40sp bold, `#1B1814`. "kcal / day" beneath in Inter 13sp muted.
- Directly below the ring, two caption lines:
  - Line 1 (maintenance): "Maintenance: {maintenance_kcal} kcal" in Inter 13sp `#1B1814`.
  - Line 2 (delta): "{deficit} kcal below maintenance" or "{surplus} kcal above maintenance" in Inter 13sp `#7C8466`. Uses Bevel's phrasing pattern. **Hard gate:** `adaptiveTdee ?? tdeeKcal` for the maintenance figure — same source as the MAINTENANCE row, no self-contradiction.
  - When adaptive TDEE is active: append "· from your recent intake" to line 1.
  - When activity-adjusted is on: append "· includes active burn" to line 1.
- Sub-1,200 amber warning box below caption (if applicable): terracotta-left-border card, "Your calorie target is below 1,200 kcal. NIH/NHS safety floors recommend at least 1,200 kcal for adults. Update in Edit →." Inter 13sp.

_Macro tiles_
Four tiles (P/C/F/Fiber) in a 2×2 grid. Each tile: `#F6F5F2` card, `radius-md`, `MacroColors` accent, value in Fraunces 24sp, "g / day" in Inter 11sp muted, progress bar min 4px at 0 (existing rule). Tap any tile → `/profile` (write surface).

_Goal card_
- Rendered via `buildGoalCard` — no logic changes.
- Visual: `#F6F5F2` card, `radius-lg`, 16px padding. Status pill (`on_track` = success green, `stalled` = amber, `wrong_way` = destructive) in the top-right.
- Goal weight and latest weigh-in as two key stats in the card header.
- Weight trend chart below (see section 3.6).

_"How is this calculated?" affordance_
Move this to a clearly visible button near the top of the screen, below the calorie ring — not below the fold. Use a lucide `HelpCircle` 16pt muted + "How is this calculated?" Inter 13sp `#7C8466` right-aligned with the ring. Tap → `WhyThisNumberSheet` (existing — no logic changes). This surfaces the adaptive TDEE, confidence narrative, weigh-in count, and goal/pace rationale exactly as the inventory specifies.

_Recalculate button_
Terracotta outlined button, full width, below the goal card. "Recalculate" label. Loading state: "Recalculating…" with spinner. Success state: "Updated ✓" for 1.5s, then reverts. `resolveTargets` is called — no logic changes. Win-moment haptic on success — unconditional (`redesign_winmoment` collapsed permanently-on, ENG-1651; no flag left to gate it).

_Edit button_
Top-right "Edit" → `GoalPaceEditorSheet` if `goal_editor` flag on, else `/profile`. No logic changes.

_Footnotes_
"Projections assume a 14-day moving average. Targets adapt weekly based on your logged intake and weigh-ins." · "~7,700 kcal ≈ 1 kg of body fat. NIH/NHS safety floors apply. This is not medical advice." Inter 12sp muted.

**States:** loading (skeleton ring + tiles); fallback (amber "(defaults)" chip near calorie ring, "Tap Recalculate to personalise" copy); computed (full display as above); error (Alert, existing behaviour).

**User benefit:** Calorie ring reads clearly as a target display, not a progress indicator. Bevel's maintenance-delta phrasing makes the target immediately interpretable. "How is this calculated?" is visible without scrolling, building trust in the first read.

---

### 3.6 Weight-trend chart (inside goal card on `/targets`)

**Current purpose:** Visual weight trajectory vs goal. Rendered via `buildGoalCard`, `resolveLatestWeightKg`, status pill (on_track/stalled/wrong_way).

**Current weaknesses:** Not fully audited for current chart type — the inventory confirms the card and pill exist but the exact chart rendering was not fully read. This spec defines the target state regardless of current implementation.

**Anti-pattern to reject explicitly:** MyFitnessPal's single flat line with no trend and no forecast (https://mobbin.com/screens/4f6f2911-7d16-44bc-ad0e-d8b22bc416c6). Never adopt it.

**Best-in-class benchmark:**
- Fitbit "Weight Trends 30 Days" with raw weight + "Your Weight Trend" overlay, two-series legend: https://mobbin.com/screens/820c2b57-97b2-47a6-89d0-2130a4ae56fb
- Noom "My progress" with goal line + dotted projection to goal marker: https://mobbin.com/screens/155b9e9c-dffb-4e0d-a38c-d4072aca5dcc
- Yazio "We estimate you can reach 70.0 kg by April 7" with smoothed actual + dashed projection: https://mobbin.com/screens/9bb99bb2-df6d-43c1-85c8-36f90c93c51c
- MacroFactor weight-trend methodology (canonical accuracy benchmark): https://help.macrofactorapp.com/en/articles/21-weight-trend and https://macrofactor.com/expenditure-v3/

**Proposed redesign:**

_Two-series chart_
- Series 1 (raw scale weight): small circular dots, 4px diameter, `#ECEAE4` fill with `#1B1814` stroke 1pt. Plotted at each weigh-in date.
- Series 2 (trend line): continuous line, 2pt stroke, terracotta `#C2683E`. This is the 14-day recency-weighted moving average — the same figure that drives `adaptiveTdee` and `buildGoalCard`'s status pill. **Hard gate:** trend math is identical to `adaptiveTdee.ts`; the chart line must never diverge from the number shown in the TDEE caption row above.
- Series 3 (forecast, dashed): if goal weight ≠ current weight, extend a dashed line (same terracotta, 2pt, dash 4/4) from the last trend-line point to the projected goal date. Terminate with a small filled terracotta circle labelled with the projected date in Inter 11sp. Projection math: `(currentTrend - goalWeight) / dailyDeficit` in days. If projection date is more than 365 days out, show "~{months} months" and clip the dashed line at 365 days.
- Series 4 (goal weight line, horizontal): a faint sage `#7C8466` dashed horizontal rule at the goal weight value, labelled "Goal: {weight}" in Inter 10sp sage at the right edge.
- Legend: two-row inline legend below the x-axis: "● Scale weight" and "━ Trend" in Inter 11sp muted. Noom/Yazio legend pattern.

_Axes and gridlines_
- x-axis: date ticks (weekly or monthly depending on data span). Inter 10sp muted.
- y-axis: weight value ticks in user's unit (kg or lb per `profiles.measurement_system`). Inter 10sp muted.
- Gridlines: `#ECEAE4` hairlines, horizontal only.
- Chart background: `#FFFFFF`.

_Status pill_
- Existing `buildGoalCard` status pill (on_track/stalled/wrong_way) retained at top-right of the card. Colour: on_track = success green `#5E7C5A`, stalled = amber `#C9892C`, wrong_way = destructive. No logic changes to the classification.

_Accessibility_
- Chart has `accessibilityLabel` summarising the trend: "Weight trend: {current_trend} kg. Status: {on_track / stalled / off track}. Goal: {goal_weight} kg." VoiceOver users do not need to interpret the visual.

_Empty state_
- Fewer than 2 weigh-ins: show "Add weigh-ins to see your trend" with a lucide `Scale` glyph (sage, 24pt) centred in the chart area.

**Hard gates (all must hold):**
1. Trend line = 14-day recency-weighted moving average from `buildGoalCard` / `adaptiveTdee.ts`. Not a simple moving average. Not a raw average.
2. Trend line value = TDEE caption's maintenance figure. No self-contradiction.
3. Status pill (on_track/stalled/wrong_way) is preserved with its existing classification thresholds.
4. Forecast projection is capped at 365 days and shows a disclaimer "Projections are estimates, not guarantees." if shown.
5. Chart respects `profiles.measurement_system` (kg vs lb) — closes the units gap in context.
6. Never drop to MFP's single flat line.

**User benefit:** Fitbit two-series separates signal (trend) from noise (daily fluctuation) — the most trust-building thing a weight chart can do. Noom/Yazio's dated goal pin gives the user a concrete, motivating target without being prescriptive. MacroFactor-grade trend math means the chart is actually correct.

---

### 3.7 `/profile` sub-screen (write surface — macros, name, dietary prefs)

**Current purpose:** Editable targets (calories, protein, carbs, fat, fiber, water), display name, dietary preference chips.

**Current weaknesses:** Mobile `/profile` does not edit body stats (weight/height/sex/age/activity/goal/pace/strategy) — web `Profile.tsx` does. The spec acknowledges this as a partial-intentional divergence (GoalPaceEditorSheet is the mobile path) but the GoalPaceEditorSheet is flag-gated. The redesign should surface the body-stats edit path clearly even if it routes through the sheet.

**Best-in-class benchmark:**
- Bevel custom goal editor with per-macro colour, g/% toggle, lock: https://mobbin.com/screens/160279f6-cdbd-45a9-8923-d68526e7fbe8
- Alma serif editorial goal input: https://mobbin.com/screens/62ab3fde-7b8d-4904-9860-4a6d4b9a23e2
- Cal AI per-macro coloured inputs + "View micronutrients" link: https://mobbin.com/screens/949be5c3-9855-491c-99c5-88997ad2f0d8

**Proposed redesign:**

_Header_
"Edit targets" in Fraunces 24sp bold. "Cancel" left, "Save" right (terracotta).

_Daily targets summary (read-back before editing)_
Four `MacroColors`-accented tiles in a 2×2 grid showing current values. Tapping a tile focuses the corresponding input below. Borrowed from Cal AI's coloured-ring-per-macro pattern, restyled to warm tokens.

_Inputs_
All inputs: `#F6F5F2` card cells, Inter 16sp, `#1B1814`, `#ECEAE4` border, `radius-md`.
- Calories: large input, Fraunces 24sp numeral for the value (editorial moment). Caption: "kcal / day". Sub-1,200 amber inline warning when 0 < value < 1200 (existing rule — keep it).
- Protein, Carbs, Fat, Fiber (g): standard inputs, MacroColors leading dot per macro.
- Water (ml): standard input.
- `canSave` gate: all finite + calories > 0. Save button disabled until valid (existing logic — keep it).

_Dietary preferences_
Chip row: `DIETARY_PREFERENCE_ENTRIES` as toggle chips. Selected = terracotta filled, unselected = `#F6F5F2` + `#ECEAE4` border. Inter 13sp.

_Body stats entry point_
A row below dietary prefs: leading `User` glyph (sage), "Body stats & goal" Inter 14sp, subtitle "Height, weight, age, activity level" Inter 12sp muted, `ChevronRight`. Tap → `GoalPaceEditorSheet` if `goal_editor` flag on, else a note "Update your body stats during an annual target review." (Interim messaging until GoalPaceEditorSheet ships at 100%). This ensures the path is not invisible.

_Save behaviour_
Upserts targets, writes `target_calories_set_at` / `target_calories_source="user"` (provenance stamp), calls `recordGoalHistory(..., "settings_save")`, sets `PROFILE_TARGETS_DIRTY_KEY`, emits `profile_targets_saved`. All existing. Cancel reverts to snapshot. Win-moment haptic fires unconditionally (`redesign_winmoment` collapsed permanently-on, ENG-1651).

**States:** loading (shimmer tiles); snapshot-ready (form enabled); saving (inputs disabled, "Save" → spinner); error (Alert, revert); save-success (dismiss + haptic).

**User benefit:** Editorial macro inputs (Alma/Bevel inspiration) make the most important number — calories — feel intentional, not mechanical. Coloured tile read-back before editing shows the user what they are changing. Body-stats entry point visible even before GoalPaceEditorSheet ships.

---

### 3.8 Display & extras card

**Current purpose:** Track caffeine switch, track alcohol switch, net carbs lens switch, macro display segmented, theme segmented.

**Current weaknesses:** Five controls in a flat list. The theme and macro-display segmenteds are buried among the switches. No units row (gap). Macro display affects the primary Today surface but is discoverable only here.

**Best-in-class benchmark:**
- Oura "Units → Metric" as first row of General: https://mobbin.com/screens/396364e9-e781-44d3-a7e9-15d5bcc2190a and https://mobbin.com/screens/e3d30b1a-b99c-4592-a9c5-d543788aa79d

**Proposed redesign:**

_Row order (leading glyph → label → trailing control)_
1. **Units** — `Ruler` glyph (sage), "Units" label. Trailing segmented "Metric / Imperial". Writes `profiles.measurement_system`. NEW ROW — closes the mobile parity gap. Immediately below the section eyebrow DISPLAY as the first and most global preference. On change: prompt "This will update how your weight, height, and nutrition inputs appear." (native Alert with OK/Cancel). Web parity: already exists in `Settings.tsx` and `Profile.tsx`.
2. **Theme** — `Sun` glyph (sage), "Appearance". Trailing segmented "Auto / Light / Dark". Existing logic (`useTheme`).
3. **Macro display** — `LayoutGrid` glyph (sage), "Macro layout". Trailing segmented "Tiles / Bars". Existing AsyncStorage logic.
4. **Net carbs** — `Minus` glyph (sage), "Show net carbs" label, rationale subtitle "Carbs minus fibre" Inter 12sp muted. Trailing iOS-style switch. Existing logic (`profiles.net_carbs_lens_enabled`).
5. **Track caffeine** — `Coffee` glyph (sage), "Track caffeine" label, rationale subtitle "Daily limit and Today tracker" Inter 12sp muted. Switch. Existing logic.
6. **Track alcohol** — `Wine` glyph (sage), "Track alcohol" label, rationale subtitle "Weekly limit and Today tracker" Inter 12sp muted. Switch. Existing logic.

_Rationale lines_ — borrowed from Oura's per-toggle one-line rationale pattern. Each switch now states what it unlocks, matching the calm-coach voice.

**States:** all synchronous. Switch state reads from AsyncStorage / profiles on mount.

**User benefit:** Units row closes the significant web/mobile gap. Rationale lines remove the "what does this do?" friction on the less-obvious switches.

---

### 3.9 Connections card — Notifications (reminder-time editor + per-kind toggles — PARITY GAP CLOSE)

**Current purpose (broken):** The Notifications row currently routes to `/(tabs)/notifications`, which is a read-only inbox. It does not allow editing reminder time or per-kind preferences.

**Required state after redesign:** The Connections card "Notifications" row opens a **Notification Preferences sheet**, not the inbox. The inbox is accessible from within the sheet via a clearly-labelled "View notification inbox →" row.

**Best-in-class benchmark:**
- Blinkist daily pick reminders toggle + "Reminder Time 8:00 AM" inline: https://mobbin.com/screens/a48983be-7954-4e85-92f6-2ad3bc4d35ba
- Oura per-kind toggles with one-line rationale each: https://mobbin.com/screens/35194a91-85ae-4997-aac4-f1de30933c72
- Duolingo inline time wheel + per-event channel chips: https://mobbin.com/screens/153738c6-d822-404c-a3ff-cce02f590994

**Proposed redesign — Notification Preferences sheet (new `NotificationPrefsSheet.tsx`):**

_Section: DAILY REMINDER_
- Toggle row: leading `Bell` glyph (terracotta when on, sage when off), "Daily reminder" label. Trailing iOS switch. Writes `notification_prefs.reminder_time` (null = off).
- Reminder time row (visible only when toggle is ON): leading `Clock` glyph (sage), "Reminder time" label. Trailing: current time chip (e.g. "8:00 AM") in Inter 13sp terracotta. Tap → inline `DateTimePicker` in time mode (iOS native wheel; web equivalent: HTML `<input type="time">`). On select: writes `notification_prefs.reminder_time`. This closes the documented mobile gap — reminder time was only settable at onboarding.

_Section: ACTIVITY UPDATES_
Per-kind toggles, each with a rationale line (Oura pattern), written to `notification_prefs`:
- **Meal reminders** — lucide `UtensilsCrossed`, "Meal reminders", "Gentle nudge when you haven't logged yet" muted. Toggle → `mealReminders`.
- **Meal timestamps** — lucide `Clock`, "Show meal timestamps", "Display times in your log" muted. Toggle → `showMealTimestamps`.
- **Weekly recap** — lucide `BarChart2`, "Weekly recap", "Progress summary on Sunday" (or Saturday, per week-start). Toggle → `weeklyReport`. On OFF → calls `cancelWeeklyRecapPush()` (existing). Sub: "Sun 18:00" or "Sat 18:00" (respects week-start day, existing logic).
- **New recipes** — lucide `BookOpen`, "New saved recipes available", "From creators you follow" muted. Toggle → `newRecipes`.
- **Creator updates** — lucide `Rss`, "Creator updates", "New content from followed creators" muted. Toggle → `creatorUpdates`.

_Inbox link_
At the bottom of the sheet: full-width terracotta-outlined row "View notification inbox →" with lucide `Inbox` glyph. Tap dismisses the sheet and navigates to `/(tabs)/notifications`.

_Promise copy_
Below the toggles, in Inter 12sp muted: "We send at most two nudges per week." This surfaces the existing product promise (from the inventory) as visible copy rather than an invisible policy.

**Web parity:** Web `Settings.tsx` already has per-kind toggles. The web path should:
1. Add the reminder-time input (currently absent on web too — this is a gap on both platforms).
2. Surface the same "View notification inbox" link (create a mobile-equivalent inbox view on web, or link to the closest equivalent).

**States:** loading (skeleton toggles); all prefs loaded (as above); OS permission denied (show an amber banner "Notifications are blocked. Open iOS Settings to re-enable." with "Open Settings" CTA → `Linking.openSettings()`); reminder-time saving (inline spinner on time chip).

**User benefit:** Closes a genuine functional gap — users have had no way to change their daily reminder time on mobile since onboarding. Oura-style rationale lines make each toggle self-explanatory. The inbox link keeps the inbox reachable without breaking the prefs-editor purpose of the sheet.

---

### 3.10 Connections card — Apple Health (`/health-sync`)

**Current purpose:** Connect Apple Health, per-category sync state ("Synced X ago" / "Never synced" / "Not available"), nutrition import/export toggles, test-meal probe, clear-imported-data, 18s timeout race, persistent error banner.

**Current weaknesses:** The sub-screen is fully functional and above comparable bar. The main improvement needed is visual — the per-category rows use flat text for sync state; a leading status dot (green/amber/muted) would make the state scannable without reading.

**Best-in-class benchmark:**
- Oura "Data sharing" group (Apple Health / Other apps / Groups): https://mobbin.com/screens/396364e9-e781-44d3-a7e9-15d5bcc2190a
- Monarch "Institutions" connection rows: https://mobbin.com/screens/9a9137b8-981f-448c-a84a-ec46b9208e1a

**Proposed redesign:**

_Settings card row (entry point)_
- Leading `Heart` glyph (sage — intentionally calm, not alert-red).
- "Apple Health" label.
- Trailing status chip: "Connected" (success green dot + "Connected" Inter 12sp), "Permission needed" (amber dot), "Not available" (muted dot). This is the `probeHealthAccess()` result surfaced on the entry row, not just the sub-screen — the user can see their connection state without tapping in. Existing `health_sync_apple_connected` + re-probe-on-focus logic unchanged.

_Sub-screen `/health-sync`_
No structural changes. Visual improvements:
- Each category row (Steps, Weight, Active energy, Resting energy, Workouts) gets a leading status dot: success green if "Synced X ago", amber if "Never synced", muted if "Connect to enable".
- The persistent error banner (amber, "Try again / Open iOS Settings") gets an `ExternalLink` icon on the "Open iOS Settings" CTA to signal it routes out.
- Section eyebrows: CONNECT · SYNC SETTINGS · NUTRITION.
- "Send a test meal" uses a `Flask` glyph (sage) and is clearly labelled "Test: write a meal to Health" with a muted subtitle "Verifies your Health write permission" — removes the mystery of what this action does.

**Hard gates:** probeHealthAccess() robustness (re-probe on focus, revoke detection), 18s timeout race, clear-imported-data deletion of `source="apple_health"` entries, "AI-estimated rows until confirmed" skip behaviour — all unchanged.

**User benefit:** Connection state visible on the entry row (Oura pattern). Status dots make sync state scannable. Test-meal probe is explained rather than mysterious.

---

### 3.11 Danger zone: reset/erase + delete account

**Current purpose:** Three-tier destructive ladder — Refresh plan (re-onboards, keeps data) → Erase everything (type-RESET, wipes food/journal/saves/shopping/recipes/activity) → Delete account (type "delete", full deletion + signout).

**Current weaknesses:** The amber/red colouring of the rows is correct. The ✗/✓ consequence lists in the modals are good and above comparable bar. Missing: a visible warning that deleting the account does not cancel the subscription (Fitplan documents this as a support trap). The "Refresh my plan" option is undervalued — it is actually a powerful low-friction re-engagement mechanism that deserves a subtitle explaining what it does.

**Best-in-class benchmark:**
- Fitplan type-DELETE confirm + "will not cancel subscription" warning: https://mobbin.com/screens/eaa746ce-91ee-4a73-8736-7dc4d950f77d
- Kit type-DELETE with explicit consequence summary: https://mobbin.com/screens/52d49146-98ed-49b2-a816-7d7a07da444f
- Visible "type 'delete'" confirm: https://mobbin.com/screens/4a90ff6c-30be-48da-af2e-20aa99309e15
- Oura "Delete data" with consequence line: https://mobbin.com/screens/cf8ab9c6-0c23-460c-ad9f-d2283bb4e8d2

**Proposed redesign:**

_Settings card (Danger zone)_
- Section eyebrow: DANGER ZONE (the one exception to the sage eyebrow — use amber `#C9892C` for the eyebrow text, signalling to the user this section is different before they reach the rows).
- Row 1: **Reset or erase data** — leading `RefreshCw` glyph (amber), "Reset or erase data" Inter 14sp amber. Subtitle "Start a new plan or wipe everything" Inter 12sp muted. No chevron — tap → the existing reset/erase modal.
- Row 2: **Delete my account** — leading `Trash2` glyph (destructive), "Delete my account" Inter 14sp destructive. Subtitle "Permanently removes your account and all data" Inter 12sp muted.

_Reset/erase modal — additions_
- "Refresh my plan" option: add subtitle "Keeps your food log, weigh-ins, recipes, and saves. Re-runs goal setup." This makes the option visually distinct from the destructive erase path. Leading `RefreshCw` glyph (terracotta) on this option row.
- "Erase everything" option: leading `Trash2` glyph (destructive). Subtitle "Removes your food log, journal, saves, shopping lists, and imported recipes." Existing ✗/✓ list in the type-RESET confirm — preserve verbatim.

_Delete account alert — addition (Fitplan pattern)_
Add to the first Alert.alert confirmation text: "This will NOT cancel your active subscription. To avoid being charged, manage your subscription in Membership before deleting." This is additive copy only — no logic changes. Alert text example:
> "Delete your account? All your data will be permanently removed and you will be signed out. This cannot be undone. Note: deleting your account does not cancel your subscription — manage it in Membership first."

_Type-confirm gate_
Existing `Alert.prompt` requiring typed "delete" (case-insensitive) → `DELETE {base}/api/account/delete` with Bearer token → `signOut()`. No logic changes.

**States:** as existing. The Alert.prompt is iOS-native VoiceOver-accessible.

**User benefit:** Fitplan's subscription warning prevents the support nightmare. "Refresh my plan" clarity reduces accidental over-reach (users wanting a re-onboard choosing "Erase" by mistake). Amber eyebrow gives the section a visual buffer before the destructive rows.

---

### 3.12 Household card + `/household-settings`

**Current purpose:** Household entry row (hidden if solo), members list, 7×4 sharing grid (tap-cycle solo/everyone, long-press member picker, "X of 28 shared"), `share_targets` privacy switch, sharing preset radio, sticky Save (owner-only), invite sheet (email RPC + 6-char code).

**Current weaknesses:** The 7×4 sharing grid is more granular than any comparable — it is a genuine differentiator. The risk is it reads as complex rather than powerful. The legend (what do the tap states mean) is present but visually thin.

**Best-in-class benchmark:**
- Monarch HOUSEHOLD section (General / Members / Preferences): https://mobbin.com/screens/9a9137b8-981f-448c-a84a-ec46b9208e1a
- Oura Circles "What will you share?" with per-score toggles + daily/weekly granularity: https://mobbin.com/screens/b8fc330b-46ed-42aa-a14f-503713c2cf96

**Proposed redesign:**

_Settings card row_
- Leading `Users` glyph (sage). "Household" label. Trailing: "{n} people · {sharing preset short label}" (existing subtitle logic). `ChevronRight`. Hidden if not in a household (existing rule).

_Sub-screen `/household-settings`_
- Section eyebrows: MEMBERS · SHARING · PRIVACY.
- Members section: self row (→ `/targets`) and others (non-tappable). Each row: circular monogram avatar (initials, sage background, 36×36), display name, "You" pill on self row. Invite button: terracotta outlined "+ Invite someone" at the bottom of the list.
- Sharing grid: retain 7×4 grid exactly. Improve the legend: three states shown as a row of example dots with labels — "◯ Just you" · "●● Everyone" · "● {Name}" — Inter 12sp, inline below the grid. "X of 28 shared" count in Inter 13sp terracotta below the legend.
- Sharing presets (radio): retain. Label each with a one-line description (Oura Circles framing): "Everything · Share all 28 metrics" / "Goals only · Share calorie and macro targets" / "Nothing · Private" / "Custom · Your current selection".
- Privacy toggle (`share_targets` switch): "Share my targets" with rationale "Let household members see your calorie and macro goals" (Oura Circles copy style).
- Sticky Save button (owner-only): terracotta CTA. Disabled until a change is made. "Save changes" label.
- Invite sheet: email input + "Send invite" CTA. Success: "Invite sent. They'll receive a 6-character code." Existing RPC logic unchanged.

**States:** solo-empty invite card (existing); loaded members list; saving (spinner on Save, existing optimistic + rollback).

**User benefit:** Monarch's HOUSEHOLD section structure gives households a clear home. Oura Circles' framing language makes the sharing model comprehensible. The grid stays — it is Suppr's differentiator — but the legend makes it self-explanatory.

---

### 3.13 App / data export card

**Current purpose:** Export nutrition log (CSV), Export everything (full data), Help & information link. MFP CSV import card is a sibling in the bundle.

**Best-in-class benchmark:**
- Oura "Back up all data" as a prominent trust-signalling action: https://mobbin.com/screens/396364e9-e781-44d3-a7e9-15d5bcc2190a
- Monarch "Data →" and "Help & Support" rows: https://mobbin.com/screens/9a9137b8-981f-448c-a84a-ec46b9208e1a

**Proposed redesign:**

_Section eyebrow:_ DATA & EXPORT

- **Export nutrition log** — leading `Download` glyph (sage), "Export nutrition log" label, subtitle "CSV · your full food diary" muted. Trailing: spinner during "Preparing your file…" (existing). Tap → `runExportCsv`. No logic changes.
- **Export everything** — leading `Archive` glyph (sage), "Export everything" label, subtitle "Yours forever. Take your data anywhere." (keep this exact copy — it is above comparable bar). Trailing spinner when exporting. Tap → confirm Alert → `exportEverythingToFile` → `/api/export/me` → share sheet. No logic changes.
- **Help & information** — leading `HelpCircle` glyph (sage), "Help & information" label. Trailing `ExternalLink`. Routes web `/help`.
- **MFP CSV import card** — retain as-is. `MobileMfpCsvImportCard surface="settings"` is additive and valuable. No visual changes needed.

**States:** export rows show spinner during export (existing). Share sheet on completion (existing).

**User benefit:** Oura's trust-signal framing elevates export from a utility action to a product promise. "Yours forever" copy (already present) is kept — it is better than Oura's generic "Back up all data."

---

### 3.14 Sign Out row

**Current purpose:** `supabase.auth.signOut()`. Currently orphaned below the card list in `settings.tsx`.

**Proposed redesign:**

Move into an ACCOUNT section eyebrow above DANGER ZONE. Row: leading `LogOut` glyph, "Sign out" label, `#1B1814` (not amber, not red — it is reversible). No subtitle needed. Tap → immediate `signOut()` as before, no confirm required (reversible action).

**User benefit:** Sign Out has a logical home (ACCOUNT section). It is visually distinct from destructive actions (different glyph, neutral colour). The orphaned placement below the bundle is resolved.

---

### 3.15 Build card + DevFlagOverrides panel

**Current purpose:** Version + build string (`__DEV__` only). `DevFlagOverrides` tri-state flag force + free-text any-flag + Clear all + Reload app (`__DEV__` only).

**Proposed redesign:** No structural changes. Visual: give the build card a `#F6F5F2` background with a `#1B1814` monospace version string (existing format `v{version} · build {n}`). `DevFlagOverrides` panel retains its full functionality — this is a development tool, not a user-facing surface.

---

## 4. Visual system — concrete tokens for this surface

All values from the locked design system. No exceptions.

| Role | Token | Value |
|---|---|---|
| Page background | `--background` | `#FFFFFF` |
| Card background | `--card` | `#F6F5F2` |
| Card border | `--border` | `#ECEAE4` |
| Primary ink | `--foreground` | `#1B1814` |
| Muted text | `--muted-foreground` | `#7C8466` (sage) |
| Primary CTA / active | `--primary` | `#C2683E` (terracotta) |
| Success / connected | `--success` | `#5E7C5A` |
| Alert / over-budget | `--warning` | `#C9892C` (amber) |
| Destructive | `--destructive` | (existing destructive red) |
| Section eyebrow | — | Inter 11sp, letter-spacing +0.08em, `#7C8466` ALL-CAPS |
| Row primary label | — | Inter 15sp, `#1B1814` |
| Row subtitle / muted | — | Inter 13sp, `#7C8466` |
| Trailing value chip | — | Inter 13sp, `#C2683E` terracotta |
| Screen title | — | Fraunces/Newsreader 28sp bold, `#1B1814` |
| Profile name | — | Fraunces/Newsreader 20sp bold, `#1B1814` |
| Big target numeral (calorie ring) | — | Fraunces/Newsreader 40sp bold, `#1B1814` |
| Stats tile numeral | — | Fraunces/Newsreader 24sp, `#C2683E` (streak), `#1B1814` (recipes) |
| Macro tile numeral | — | Fraunces/Newsreader 24sp, macro-specific `MacroColors` |
| Input value (edit targets) | — | Fraunces/Newsreader 24sp, `#1B1814` |
| Row radius | `--radius-md` | 12px |
| Card radius | `--radius-lg` | 16px |
| Leading icon size | — | 20pt, colour matches section role |
| Trailing chevron | — | lucide `ChevronRight` 16pt, `#ECEAE4` |
| Trailing external link | — | lucide `ExternalLink` 14pt, `#7C8466` |
| Section spacing | — | 24px above eyebrow, 8px below, 0px between rows within a section |
| Card padding | — | 16px all sides |

**Typography rule summary:** Fraunces (or Newsreader) for screen title, user name, big target numerals, macro values, stats numbers. Inter for everything else — all row labels, subtitles, value chips, captions, microcopy. Rationale: the locked direction reserves serif display for "editorial, titles, recipe names, big numerals, section headers"; Inter for "body, data, labels and dense tracker UI where legibility wins."

**Imagery:** No imagery on this surface. The Settings surface is a data/control surface; the meal-photography and ingredient-illustration rules do not apply. The avatar monogram (terracotta background, white initial) is the only decorative element.

**Motion:**
- Sheet presentations: standard iOS sheet with `detents: [.medium, .large]` on appropriate sheets. 300ms spring.
- Switch toggle: iOS native spring.
- Promo code expander: `grid-template-rows: 0→auto` 200ms ease (web) / `LayoutAnimation.easeInEaseOut` 200ms (mobile).
- Value chip change: brief opacity flash (100ms) when value updates in-place.
- Export spinner: standard activity indicator in sage.
- No other custom animations. This is a control surface — restraint is correct.

---

## 5. State matrix — every component, every state

| Component | Loading | Empty / off | Loaded / on | Error |
|---|---|---|---|---|
| Profile card | Skeleton shimmer (avatar + two text lines) | — | Name, tier, join label | Silent (falls back to email initials) |
| Stats strip | Hidden | Both tiles hidden | One or two tiles | Silent (strip hidden) |
| Daily targets row | Subtitle "Calculating…" | Subtitle "(defaults) · Tap to personalise" (amber) | Subtitle "{kcal} · {P}P/{C}C/{F}F" | Alert on save failure |
| Calorie ring (`/targets`) | Skeleton ring | Fallback amber chip | Full display ring + numerals | Alert |
| Weight trend chart | Skeleton chart area | "Add weigh-ins to see your trend" (< 2 weigh-ins) | Two-series chart + forecast | "Could not load trend" muted text |
| Goal card | Skeleton | No goal set: prompt "Set a goal weight →" | Goal card with pill + stats | Muted error text |
| Apple Health row | "Checking…" subtitle | "Not available on this device" | "Connected" (green dot) or "Permission needed" (amber dot) | Persistent error banner in sub-screen |
| Notifications row | — | No reminder set: "Reminders off" | "Daily at {time}" | OS denied: amber banner |
| Per-kind toggles | Skeleton | Off | On (with rationale) | Alert on write failure; optimistic revert |
| Export rows | Spinner during prep | Ready | Share sheet opens | Alert "Export failed" |
| Membership (free) | — | Upgrade row + promo expander | — | Alert on promo fail (inline "Code not recognised") |
| Membership (pro) | — | — | "Pro member" + Manage row | Alert on RevenueCat fail |
| Household card | — | Hidden (solo) | "{n} people · {preset}" | Alert on save failure |
| Reset/erase modal | — | — | Two-option list | Alert |
| Type-RESET confirm | — | — | Text gate + confirm | Alert on nuke failure |
| Delete account alert | — | — | Two-step Alert + type "delete" | Alert "Could not delete. Try again." |

---

## 6. Microcopy register (calm warm coach voice)

All copy below is in the voice defined in the locked design system: encouraging, grounded in real numbers, never shaming, never bubbly. Past tense for past data; present tense for live data.

| Surface | Copy |
|---|---|
| Settings screen title | "Settings" |
| Profile card subtitle | "{tier} · {join label}" (e.g. "Pro · Joined May 2026") |
| Stats strip — streak tile | "Day streak" (no "Keep it up!", no flame copy) |
| Stats strip — recipes tile | "Recipes saved" |
| Daily targets subtitle (fallback) | "{kcal} (defaults) · Tap to personalise" |
| Daily targets subtitle (computed) | "{kcal} · {P}P / {C}C / {F}F" |
| Calorie ring caption line 1 | "Maintenance: {kcal} kcal" (+ "· from your recent intake" if adaptive) |
| Calorie ring caption line 2 | "{n} kcal below maintenance" / "{n} kcal above maintenance" |
| Sub-1200 warning | "Your calorie target is below 1,200 kcal. NIH/NHS safety floors recommend at least 1,200 kcal for adults." |
| Track caffeine rationale | "Daily limit and Today tracker" |
| Track alcohol rationale | "Weekly limit and Today tracker" |
| Net carbs rationale | "Carbs minus fibre" |
| Daily reminder rationale | "A gentle nudge to log your meals" |
| Weekly recap rationale | "Your progress summary, delivered {Sunday/Saturday}" |
| Notification promise | "We send at most two nudges per week." |
| Export everything subtitle | "Yours forever. Take your data anywhere." |
| "Refresh my plan" subtitle | "Keeps your food log, weigh-ins, recipes, and saves. Re-runs goal setup." |
| Delete account alert extra line | "Deleting your account does not cancel your subscription. Manage it in Membership first." |
| Health connected | "Connected" |
| Health permission needed | "Permission needed · tap to fix" |
| Health not available | "Not available on this device" |
| Weight trend empty | "Add weigh-ins to see your trend" |
| Forecast disclaimer | "Projections are estimates, not guarantees." |
| No notification inbox items | "Nothing here yet" |
| Sign out row | "Sign out" (no subtitle) |

---

## 7. Accessibility requirements

- All switches: `accessibilityLabel` = "{preference name}, currently {on/off}". On state change, announce "{preference name} {turned on/turned off}".
- Destructive rows: `accessibilityHint` = "Double tap to open a confirmation dialog."
- Weight-trend chart: `accessibilityLabel` = "Weight trend chart. Trend weight {value} {unit}. Status: {on_track/stalled/off track}. Goal: {goal_weight} {unit}."
- Calorie ring: `accessibilityLabel` = "Daily calorie target: {value} kcal."
- Profile card tap: `accessibilityLabel` = "Edit profile. {name}, {tier} tier."
- Section eyebrows: `accessibilityRole="header"`.
- Minimum tap target: 44×44pt for all interactive rows (iOS Human Interface Guidelines standard).
- Promo code input: `autoCapitalize="characters"` (promo codes are typically uppercase), `autoCorrect={false}`.
- Type-to-confirm inputs: `secureTextEntry={false}`, `autoCapitalize="none"`, clear `placeholder` ("Type 'delete' to confirm" / "Type 'RESET' to confirm").

---

## 8. Feature flag gates

Any visual or structural change from this spec ships behind a PostHog feature flag per the `CLAUDE.md` non-negotiable rule.

| Flag | Scope | Gate |
|---|---|---|
| `settings_redesign_v2` | All visual changes in this spec (icon rows, eyebrows, value chips, profile card serif, stats strip, sign out relocation) | Master gate for the whole redesign |
| `settings_notification_prefs_sheet` | New `NotificationPrefsSheet.tsx` + reminder-time editor + per-kind toggles on mobile | Parity-gap close — ship as subfeature |
| `settings_units_row` | Units / measurement system row on mobile | Parity-gap close — ship as subfeature |
| `redesign_winmoment` — **REMOVED (ENG-1651)** | Win-moment haptic on targets save and recalculate | Collapsed permanently-on — the haptic fires unconditionally in every build (has done since 2026-06-01); no gate remains |
| `goal_editor` | `GoalPaceEditorSheet` path on `/targets` and `/profile` | Already in inventory |
| `streak_milestones` | Milestone asterisk + `WhatsNewSheet` on streak tile | Additive; gated separately |

Old path must remain alive in every `else` branch. Ramp via PostHog dashboard. Remove gates after 2-week clean hold at 100% with no regression.

---

## 9. FUNCTIONALITY PRESERVED checklist

Every item from the functional inventory (INPUT A) is confirmed preserved or improved. Nothing is dropped.

### Mobile shell + navigation
- [x] `/(tabs)/settings` shell: back chevron, title, search input, bundle body, sign out — PRESERVED (sign out relocated to ACCOUNT section, not removed)
- [x] `SettingsBundleContent.tsx` as canonical bundle body — PRESERVED (extraction into sub-components is additive refactor, not removal)
- [x] Search index (`settingsSearchIndex.ts`) — PRESERVED and EXPANDED (more routes added)
- [x] `/profile`, `/targets`, `/fasting`, `/health-sync`, `/(tabs)/notifications`, `/household-settings`, `/create-recipe`, `/paywall?from=settings` routes — all PRESERVED
- [x] Web `/help`, `/privacy`, `/terms` via `Linking` — PRESERVED

### Profile card
- [x] `GradientAvatar` initials from display_name/email/"S" — PRESERVED (replaced with circular monogram, same initial logic)
- [x] Display name, tier label ("Pro"/"Free", legacy `base`→Free), join label (<7d/Xw/Xmo/Mon YYYY) — PRESERVED

### Stats strip
- [x] `savedCount` (count of `saves` rows) — PRESERVED
- [x] `computeProtectedStreak(byDay, freezeLedger, budgetMax)` over last 400 `nutrition_entries.date_key` — PRESERVED, hard-gated to use same shared helper as Today/Progress
- [x] `streak_freezes_earned_at` / `streak_freezes_used_history` freeze ledger — PRESERVED
- [x] `budgetMax` default 3 — PRESERVED
- [x] Subtractive zero rule (hide tile at 0, hide strip if both 0) — PRESERVED
- [x] Streak weekday-dot (7 dots) — NEW addition, same data source, additive

### Membership card
- [x] Upgrade row (tier ≠ pro) → `/paywall?from=settings` — PRESERVED
- [x] Tier-conditional copy (free/"Upgrade your plan"/"Unlimited recipes…"; base/"Upgrade to Pro"/"AI photo and voice…") — PRESERVED
- [x] Manage subscription row (tier ≠ free) → CancelExportPromptSheet → RevenueCat / App Store fallback — PRESERVED
- [x] CancelExportPromptSheet (export-first interstitial, events `cancel_export_prompt_shown`/`cancel_export_chosen`/`cancel_proceeded`) — PRESERVED
- [x] Promo code expander → `usePromoCode` → profile refetch — PRESERVED
- [x] "Deleting does not cancel subscription" warning — NEW addition to delete-account alert, additive

### Goals & targets card
- [x] Daily targets row → `/targets`, subtitle states (loading/fallback/computed), `resolveTargets` — PRESERVED
- [x] Dashboard widgets picker modal (toggles P/C/F/fiber/sugar/sodium/water, ≥1 lock, writes `tracked_macros`) — PRESERVED
- [x] Week start picker modal (Mon/Sun, `saveWeekStartDay`, emits `week_start_day_changed`) — PRESERVED
- [x] Deficit summary window picker modal (`notification_prefs.weekSummaryMode`, last-7-days/calendar_week) — PRESERVED
- [x] Caffeine limit modal (clamp 0–2000, caption "400 mg ≈ 4 cups", writes `target_caffeine_mg`) — PRESERVED
- [x] Alcohol limit modal (clamp 0–2000, caption "14 g ≈ 1 US standard drink / 196 g/week = 14 UK units", writes `target_alcohol_g_weekly`) — PRESERVED
- [x] Intermittent fasting row → `/fasting` (window presets 16:8/18:6/20:4/14:10, timer ring, history) — PRESERVED
- [x] Weekly recap push picker (switch, `weekly_recap_push_enabled`, `cancelWeeklyRecapPush()`, emits `weekly_recap_push_enabled_toggled`) — PRESERVED (relocated to Goals & targets for logical grouping)
- [x] Weekly recap sub-label "Sun/Sat 18:00, respects week start" — PRESERVED

### Display & extras card
- [x] Track caffeine switch (`TrackingExtras.trackCaffeine`, AsyncStorage `TRACKING_EXTRAS_STORAGE_KEY`, default OFF) — PRESERVED
- [x] Track alcohol switch (`trackAlcohol`, default OFF) — PRESERVED
- [x] Show net carbs switch (`profiles.net_carbs_lens_enabled`, swaps Carbs→Net carbs) — PRESERVED
- [x] Macro display segmented (Tiles/Bars, AsyncStorage `suppr.prefs.macro_display`) — PRESERVED
- [x] Theme segmented (Auto/Light/Dark, `useTheme`) — PRESERVED
- [x] Units / measurement system row — NEW (closes mobile parity gap, writes `profiles.measurement_system`)

### Connections card
- [x] Apple Health row → `/health-sync`, subtitle from `probeHealthAccess()` (Connected/Permission needed/Not available/Checking…) — PRESERVED
- [x] `health_sync_apple_connected` seed + re-probe on focus — PRESERVED
- [x] Notifications row — REDESIGNED (now opens `NotificationPrefsSheet` instead of inbox directly; inbox accessible from within sheet)
- [x] Reminder time display `notification_prefs.reminder_time` — PRESERVED and EXTENDED (now editable)
- [x] Per-kind notification toggles (showMealTimestamps, newRecipes, mealReminders, weeklyReport, creatorUpdates) — PRESERVED on web; NEW on mobile (closes parity gap)
- [x] Weekly recap push row — PRESERVED (relocated; same logic)

### App card
- [x] Export nutrition log (CSV, spinner, `runExportCsv`, `nutritionLogToCsv`, share sheet) — PRESERVED
- [x] Export everything (confirm Alert, `exportEverythingToFile`, `/api/export/me`, share sheet) — PRESERVED
- [x] Help & information → web `/help` — PRESERVED
- [x] MFP CSV import card — PRESERVED

### Legal card
- [x] Privacy policy → web `/privacy` — PRESERVED
- [x] Terms of use → web `/terms` — PRESERVED

### Build card + DevFlagOverrides
- [x] `v{version} · build {n}` (`__DEV__` only) — PRESERVED
- [x] `DevFlagOverrides` tri-state force, free-text, Clear all, Reload app (`__DEV__` only) — PRESERVED

### Danger zone
- [x] Reset/erase modal ("Refresh my plan" → re-onboard; "Erase everything" → type-RESET modal) — PRESERVED with improved copy
- [x] Type-RESET confirm modal (✗/✓ consequence list, type "RESET" gate, `handleNukeEverything`, `nukeAllUserAppData`, clears health/onboarding AsyncStorage, routes `/onboarding`) — PRESERVED verbatim
- [x] Delete my account (2-step Alert, type "delete" case-insensitive, `DELETE /api/account/delete`, Bearer token, `signOut()`) — PRESERVED with additive subscription warning
- [x] Sign Out (`supabase.auth.signOut()`) — PRESERVED (relocated to ACCOUNT section)

### `/targets` sub-screen
- [x] Calorie ring (gradient, full sweep) + big target calories + "kcal / day" — PRESERVED (restyled as static display, not progress)
- [x] `tdeeCaption` (maintenance = `adaptiveTdee ?? tdeeKcal`, "Maintenance from your recent intake" / "Estimated TDEE · Mifflin-St Jeor" + activity + deficit/surplus caption) — PRESERVED
- [x] MAINTENANCE row (`adaptiveTdee ?? tdeeKcal`, PostHog-masked) — PRESERVED
- [x] Recalculate button ("Recalculating…"/"Updated"), re-runs `resolveTargets` — PRESERVED
- [x] Activity-adjusted note (`prefer_activity_adjusted_calories`) — PRESERVED
- [x] Macro tiles (P/C/F/Fiber, current vs target, min 4px bar at 0%) — PRESERVED
- [x] Goal card (`buildGoalCard`, `resolveLatestWeightKg`, `weight_kg_by_day`, status pill on_track/stalled/wrong_way) — PRESERVED
- [x] "How is this calculated?" → `WhyThisNumberSheet` (adaptive TDEE, confidence low/med/high, weigh-in count, goal/pace) — PRESERVED and made more prominent (above the fold)
- [x] Edit → `GoalPaceEditorSheet` (if `goal_editor` flag) / `/profile` — PRESERVED
- [x] Footnotes ("14-day moving average…", "~7,700 kcal ≈ 1 kg…", NIH/NHS floors, not medical advice) — PRESERVED
- [x] Win-moment haptic (`redesign_winmoment` collapsed permanently-on, ENG-1651 — unconditional, no flag) — PRESERVED
- [x] Sub-1,200 amber safety warning — PRESERVED

### Weight-trend chart
- [x] 14-day recency-weighted moving average (same math as `adaptiveTdee.ts`) — PRESERVED, hard-gated
- [x] Trend line ≠ raw scale weight — PRESERVED (two-series chart separates them)
- [x] Status pill (on_track/stalled/wrong_way) from `buildGoalCard` classification — PRESERVED
- [x] Forecast dashed projection to goal pin — NEW (additive, Noom/Yazio pattern)
- [x] MFP single flat line — EXPLICITLY REJECTED
- [x] `profiles.measurement_system` respected (kg/lb) — PRESERVED (and closes the units gap in context)

### `/profile` sub-screen
- [x] Daily targets summary tiles (Calories/Protein/Carbs/Fat, `MacroColors`) — PRESERVED
- [x] Sub-1,200 amber safety warning (0 < calories < 1200) — PRESERVED
- [x] Edit form (Display Name, Calories, Protein, Carbs, Fat, Fiber g, Water ml) — PRESERVED
- [x] `canSave` gate (all finite + calories > 0) — PRESERVED
- [x] Upsert targets + `target_calories_set_at` + `target_calories_source="user"` (provenance stamp) — PRESERVED
- [x] `recordGoalHistory(..., "settings_save")` — PRESERVED
- [x] `PROFILE_TARGETS_DIRTY_KEY` — PRESERVED
- [x] `profile_targets_saved` event — PRESERVED
- [x] Cancel reverts to snapshot — PRESERVED
- [x] Dietary preferences chips (`DIETARY_PREFERENCE_ENTRIES`) — PRESERVED
- [x] Body stats editor entry point (GoalPaceEditorSheet / note) — PRESERVED with visible entry row

### `/health-sync`
- [x] 5 categories (steps, weight, active energy, resting energy, workouts) — PRESERVED
- [x] "Synced X ago" / "Never synced" / "Connect to enable" per category — PRESERVED
- [x] AsyncStorage `LAST_SYNC_KEYS` — PRESERVED
- [x] Nutrition sync card (Import meals, Simple labels only, Share meals to Health, test meal probe, Clear imported data) — PRESERVED
- [x] `probeNutritionWrite` — PRESERVED
- [x] Connect/Sync Now + 18s timeout race — PRESERVED
- [x] Persistent error banner (Try again / Open iOS Settings) — PRESERVED
- [x] Re-probe on focus / revoke detection — PRESERVED
- [x] "AI-estimated rows until confirmed" skip — PRESERVED

### `/(tabs)/notifications` inbox
- [x] Merges `app_notifications` (50) + `creator_publish_notifications` (25, recipe titles) — PRESERVED
- [x] Unread dot, Mark all read (optimistic + rollback), per-item mark-read, tap → recipe — PRESERVED
- [x] Realtime channel + 350ms debounce, pull-to-refresh — PRESERVED
- [x] Empty/error/loading states, "Nothing here yet" — PRESERVED
- [x] Accessible from NotificationPrefsSheet via "View notification inbox →" row — PRESERVED (entry point adjusted, not removed)

### `/household-settings`
- [x] Solo-empty invite card (≤1 member) — PRESERVED
- [x] Members list (self → `/targets`, others non-tappable) — PRESERVED
- [x] Privacy `share_targets` switch (optimistic, RLS-scoped) — PRESERVED
- [x] Sharing presets radio — PRESERVED (with added one-line descriptions)
- [x] 7×4 sharing grid (tap cycle solo/everyone, long-press member picker, "X of 28 shared") — PRESERVED
- [x] Legend — PRESERVED and IMPROVED
- [x] Sticky Save (owner-only) — PRESERVED
- [x] Invite sheet (email RPC + 6-char code) — PRESERVED

### Web surfaces
- [x] `src/app/components/Settings.tsx` (deficit summary, theme, macro display, week-start, caffeine/alcohol, dietary, measurement system, fasting link, notification per-kind toggles, weekly recap, subscription, reset/erase, delete) — PRESERVED; reminder-time input to be added (parity gap)
- [x] `src/app/components/Profile.tsx` (targets + body stats + goal/pace/strategy + units + activity-adjusted toggle + streak/recipe stats) — PRESERVED
- [x] `src/app/components/HouseholdSettingsPage.tsx` — PRESERVED
- [x] `app/account/billing/page.tsx` + `BillingUnavailableFallback.tsx` — PRESERVED
- [x] Web `/fasting` — PRESERVED

### Analytics events (must fire on redesigned surfaces)
- [x] `cancel_export_prompt_shown` / `cancel_export_chosen` / `cancel_proceeded` — PRESERVED (CancelExportPromptSheet intact)
- [x] `weekly_recap_push_enabled_toggled` — PRESERVED
- [x] `week_start_day_changed` — PRESERVED
- [x] `profile_targets_saved` — PRESERVED
- [x] No new events invented without going through the analytics-engineer agent

---

## 10. Open gaps and recommended follow-up issues

These gaps are flagged here rather than silently deferred. Each should become a Linear issue before this spec is handed to executor.

| Gap | Severity | Recommended action |
|---|---|---|
| Web reminder-time input missing (gap on both platforms) | High | Add to `Settings.tsx` web path in the same PR as mobile `NotificationPrefsSheet` |
| Web notifications inbox missing (mobile-only) | Medium | Create a web inbox view or surface it from the user-menu notification bell; decide intentional-divergence vs gap |
| GoalPaceEditorSheet not at 100% (flag-gated) | Medium | Ship `goal_editor` flag to 100% and remove gate; the "body stats entry row" in this spec points to it |
| `SettingsBundleContent.tsx` is 3,451 lines (legacy over-limit) | Medium | Extract each card into `components/settings/{Card}.tsx`; create ENG ticket |
| Settings search index covers only 4 routes | Low | Expand to cover all rows per section 3.1; straightforward change |
| `/fasting` sub-screen full audit not done | Low | Full audit of preset-edit UI and history rendering; not blocking the spec |

---

*This spec is the design source of truth for the Settings / Profile / Account surface redesign. Any implementation must satisfy the FUNCTIONALITY PRESERVED checklist (section 9) in full before sign-off. Visual changes ship behind `settings_redesign_v2` feature flag. Parity-gap closes (`settings_notification_prefs_sheet`, `settings_units_row`) are independently gated and can ship ahead of the full visual redesign.*
