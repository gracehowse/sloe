# Phase 6 elevation brief — 2026-04-28

**Authority:** D-2026-04-27-* (strategic direction); 7-specialist deep audit ran 2026-04-27 → 2026-04-28.
**Owner:** Grace + executor agent.
**Inputs (audits on disk):**
- `docs/audits/2026-04-28-ui-critic-button-level.md`
- `docs/audits/2026-04-28-customer-lens-first-session.md`
- `docs/audits/2026-04-28-visual-qa-pixel-level.md`
- `docs/audits/2026-04-28-2026-bar-button-level.md`
- `docs/audits/2026-04-28-sync-enforcer-parity.md`

---

## Why this exists

Grace asked: "we need to do more research than that. a proper deep dive and screen by screen, button by button analysis. also i can see that web is not optimised for mobile and that mobile app and web app aren't 100% in sync."

Phase 1–5 shipped the structural skeleton (4-tab collapse, LogSheet, TrustChip/SourceDot, ProgressHeadline, NorthStarBlock, macro-tiles). The redesign is structurally in sync but had **interaction-level decoy bugs** and **mobile-web regressions** that no-one had walked button-by-button until this audit round.

This brief consolidates findings → fixes shipped today → remaining work, ranked by impact-per-effort.

---

## Verdict snapshot

- **Web/mobile structural parity:** narrowing post-redesign. Zero new unintentional divergences from Phases 1–5. Largest remaining gap: onboarding v2 (15-step web) vs legacy 11-step mobile.
- **Interaction quality:** prototype-level in places. Press feedback is opacity-only on most surfaces (should be scale + haptic). Skeletons are static (should shimmer). Ring resets to zero on every log instead of tweening.
- **Mobile-web specifically:** had multiple decoy bugs (LogFab alert, ring "click" verb, voice/photo capture buttons unwired). Most fixed today.
- **Visual tier:** ~67% of production-design-spec coverage shipped. Top drift: Cook Mode (flat layout, Menlo timer), Onboarding form (heavy borderWidth:2 cards), Progress stat grid (47% width hack), Planner summary card (flat tint stand-in for unimplemented gradient).

---

## Fixes shipped today (2026-04-28, this commit)

### Critical interaction bugs
1. **Mobile NorthStar CTA opened wrong recipe** — `apps/mobile/app/(tabs)/index.tsx:3208` was using `savedRecipesForLibrary[0]` instead of the suggestion's `recipeId`. Changed `NorthStarBlockHost.onPrimaryCta` signature to `(recipeId: string) => void` on both web and mobile so the host passes the suggested recipe correctly. Test added.
2. **Mobile CalorieRing reset-to-zero on every log** — `apps/mobile/components/charts/CalorieRing.tsx:142-148` snapped `progress.value = 0` before each `withTiming`, producing a "drain then refill" jitter. Removed the snap so Reanimated tweens from the prior position.
3. **Mobile LogSheet voice/photo buttons unwired** — default mic/capture Pressables had no `onPress`. Added `onStart` (voice) and `onCapture` (photo) callbacks to both web + mobile LogSheet, wired to close LogSheet and open the dedicated `VoiceLogSheet` / `PhotoLogSheet` (mobile) and `VoiceLogDialog` / `PhotoLogDialog` (web).
4. **Web LogFab Phase 2 placeholder cleanup** — removed dead `window.alert("Coming in Phase 3 …")` fallback since `NutritionTracker` already passes `onPress`. Made `onPress` required on the prop type. Updated tests.

### Parity wins
5. **Web ring helper text** — deleted "Click the ring to hide/show macros" caption (mobile dropped it at F-47; "click" is wrong verb on touch).
6. **Web StreakPip copy** — "X days" → "X-day streak" (mobile match).
7. **Web Plan tab label** — "Shop" → "Shopping" (mobile match).
8. **Web Discover "Following" pill** — added the missing pill to the filter row, wired to existing `feedScope === "following"` state. Was mobile-only before.
9. **Mobile TodayActivityCard icons** — `Ionicons footsteps-outline` and `flame-outline` swapped to lucide `Footprints` / `Flame` per spec §1.5.

---

## Remaining Phase 6 work, ranked

### P0 — interaction integrity (next sprint)
| # | Item | Where | Notes |
|---|---|---|---|
| 1 | LogSheet Search tab is a full decoy on both platforms | `index.tsx:3633-3641`, `NutritionTracker.tsx:2556-2565` | TextInput accepts text but `onQueryChange = () => {}` and `query = ""`. Either route to `FoodSearchModal` on focus or wire real search. Voice/photo got the tap-router pattern today; search should follow. |
| 2 | LogSheet recent/saved are empty arrays on both platforms | Same | `entries: []`, `meals: []`. Should hydrate from existing recents/saved-meals state and let users one-tap log. |
| 3 | Tracking-extras cross-tab broken on mobile | `apps/mobile/app/(tabs)/index.tsx:363` | Mount-only `useEffect` doesn't re-read on focus; switching tabs and back doesn't refresh extras. Use `useFocusEffect`. |
| 4 | Onboarding v2 not on mobile | Web has 15-step v2 with RecipePickerStep + first-week seeding; mobile has legacy 11-step | Largest cross-platform divergence. Route to `planner` for sprint scoping. |

### P1 — visual elevation (Cook Mode, Onboarding, Progress, Planner, Shopping)
Per visual-qa: 5 cheap-looking surfaces. Each needs a `ui-product-designer` brief.
- **Cook Mode** — flat layout, Menlo timer font, emoji "🎉" done state, mis-radiused step-number square, no enabled/disabled visual on nav buttons.
- **Onboarding form** — Ionicons throughout, `fontWeight: "900"`, `borderWidth: 2` plan cards heavier than rest of app, invisible back button.
- **Progress stat grid** — "47%" Flexbox width hack, overline labels with wrong weight/tracking, "Tap for breakdown" chevron competing with the stat value.
- **Planner summary card** — flat `Accent.primary + "14"` tint stands in for the unimplemented gradient.
- **Shopping List empty state** — emoji-as-illustration, asymmetric CTA, Ionicons import.

### P2 — interaction polish (whole-app)
Per ui-critic: 5 button-level gaps shared across surfaces.
- **Press feedback** — opacity-only on most surfaces; should be `scale 0.97 + light haptic + 150ms ease-out` per `PressableScale` primitive in spec §1.1.
- **Primary CTA shadows** — single shadow value across states. Spec wants 4-step elevation ladder (rest / hover / press / focus).
- **Skeletons static** — should shimmer (1200ms left-to-right gradient). Currently flat block colour.
- **Over-budget caption** — utilitarian one-liner. Spec wants a "moment" — amber chip + tone shift, not a sentence.
- **Mobile-web touch targets** — multiple <44pt hits (delete buttons, icon-only nav). Bump to 44pt minimum on mobile-web breakpoint.

### P3 — design-system drift (token enforcement)
Per visual-qa quantified counts:
- 60+ ad-hoc spacing literals (e.g. `padding: 14` appears 12+ times across 7 files).
- 50+ ad-hoc font sizes outside the Type scale.
- 20+ hardcoded hex / rgba values.
- 3 surfaces broken in dark mode (Recipe Detail floating header buttons, Library bookmark dot + remove button, Progress loading spinner).

Plan:
- Ship custom eslint rule banning `fontSize: <number>` and `color: "#xxx"` literals (already a P2 Tasks DB row).
- Grep-replace sweep on `"#fff"` and `rgba(255,255,255,...)` literals → consume `colors.text` / `colors.background` from theme.
- Per-surface refit briefs for the dark-mode 3.

### P4 — mobile-web specific regressions (parity)
Per sync-enforcer (full table in `docs/audits/2026-04-28-sync-enforcer-parity.md` §5):
- No `YouSubTabHeader` / `RecipesSubTabHeader` pill bars at narrow viewport.
- Centre-entry confirm dialogs (should be bottom sheet).
- iOS keyboard cover on text inputs.
- No pull-to-refresh on feeds.
- Plan tab label was "Shop" — fixed today; rest pending.

---

## Sequencing recommendation

Pick exactly one P0 per sprint, plus a P3 token-enforcement-or-dark-mode item that runs in parallel. The P1 visual refits each take a discrete `ui-product-designer` → `executor` → `visual-qa` cycle and should not be batched.

Suggested order:
1. **Sprint A (this week):** P0-1 LogSheet Search routing + P0-2 recent/saved hydration. Both platforms.
2. **Sprint B:** P0-3 tracking-extras cross-tab + P3 dark-mode 3 fixes.
3. **Sprint C:** P1 Cook Mode refit (highest visible cheap-tier surface).
4. **Sprint D:** P0-4 onboarding v2 mobile port — separate sprint, not bundled.
5. **Sprint E onwards:** remaining P1 surfaces, P2 polish sweep (PressableScale primitive applied app-wide), P3 token lint + grep replacements.

---

## Sign-off criteria for "Phase 6 done"

- Zero decoy interactions (every visible control either acts or is explicitly absent).
- Zero mobile-web regressions vs native (sync-enforcer audit returns clean).
- Visual-qa returns pass on each of the 5 P1 surfaces.
- Token-enforcement lint shipped + failing-on-merge.
- Dark mode passes on all surfaces.
- All audits dated 2026-04-28 closed or rolled to follow-on tickets.

---

## Provenance

- 7 specialist agents fanned 2026-04-27: ui-critic, customer-lens, visual-qa, 2026-bar (button-level), competitor-intelligence, design-system-enforcer, journey-architect, sync-enforcer.
- 5 audit docs written to disk. The other 2 (design-system-enforcer drift, journey-architect interaction map) returned content inline; their actionable findings are folded into the P0–P3 list above.
- Today's commit ships 9 fixes; the remaining 14+ items are scoped Phase 6 work.
