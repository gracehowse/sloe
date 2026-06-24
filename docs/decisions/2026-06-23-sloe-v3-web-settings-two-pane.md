# Sloe v3 — web Settings "two-pane" layout (2026-06-23)

**Status:** Resolved (built flag-dark; `sloe_v3_settings` default-OFF pending Grace's desktop SEE-approval).
**Area:** Redesign / Settings IA — web layout.
**Issue:** ENG-1225 (Sloe v3 reskin), gap #24 in `docs/planning/2026-06-22-sloe-v3-gap-backlog.md`.
**Grounded by:** the v3 prototype (`docs/ux/redesign/v3/Sloe-App.html` → `WebSettings` ~L7899, `.w-set-grid`/`.w-set-nav`/`.w-sni`/`.w-set-panel` ~L2521-2530) read against the live `src/app/components/Settings.tsx`, plus a Storybook + Playwright render of the result at desktop + mobile-web widths.

## The decision

Web Settings adopts the prototype's **two-pane layout** at `md+`:

- A **sticky LEFT sub-nav** column (the section groups, the active one highlighted with the plum-on-tint grammar already used by the Settings header + Pro pill).
- A **RIGHT panel** that swaps to the selected section's content (serif section heading + a muted lead, then the existing `<SupprCard>` body).

Below `md` (mobile-web) it falls back to a **single stacked column** — every section shown with its serif heading, no left nav — so mobile-web is never a broken half-pane.

This is a **pure re-layout**: the two-pane shell is a layout/router wrapper that reuses the EXACT same section cards as the legacy single-scroll stack. **No setting is added or removed**, no backend change, no copy change to any control.

### Section grouping (the sub-nav)

The prototype's `WebSettings` shows 6 invented groups (Targets / Connections / Notifications / Nutrition sources / Account & billing / Privacy & data) with mock rows. Live Settings has real, different content, so the nav groups the **live** content rather than copying the prototype's mock sections verbatim:

| Nav section | Existing cards it holds |
|---|---|
| **Account & billing** | Your plan + Personal + Subscription (Pro-only, flag) + About + Promo code |
| **Preferences** | the Preferences card (units, meal slots, theme, macro display, week start, tracking extras, hydration limits, dashboard widgets, dietary, fasting) |
| **Connections** | the Connections card (Household + Apple Health) — **hidden** when `web_settings_connections_v1` is off (no empty section) |
| **Notifications** | the Notifications card |
| **Privacy & data** | the Privacy & Security card (exports, policy links, reset / erase / delete) |

The profile-header card + Sloe Pro banner read as **page identity** and render above the grid on every section.

## Why these choices win

- **Reuse, not rebuild.** The single-pane stack stays alive in the flag-OFF `else`; both paths reference the same named section `const` nodes. This guarantees the two layouts can never drift in content — only in arrangement.
- **No pinned-file growth.** `Settings.tsx` is allow-listed in `scripts/screen-line-budget.json`. The two-pane shell is a new file (`settings/SettingsTwoPaneShell.tsx`); the modal cluster was extracted to a new `settings/SettingsDialogs.tsx`. `Settings.tsx` adds only a ≤15-line flag branch and shrank 2346 → 2302 (re-pinned lower).
- **Mobile-web stays usable.** A left-nav at phone width would be a broken half-pane; the single-column fallback is the prototype's own mobile-web behaviour.
- **Plum-on-tint, not a new token.** The prototype's active nav uses `accent-frost-mist`, which has no web equivalent. The shipped active state uses the live `bg-primary/10 text-primary` grammar the Settings header + Pro pill already use — intent-matched, no invented token.

## Flag posture

`sloe_v3_settings` — **default-OFF**, registered in `KNOWN_DEFAULT_OFF_FLAGS` in `src/lib/analytics/track.ts` (NOT in `REDESIGN_DEFAULT_ON`). ON → `SettingsTwoPaneShell`; OFF → the legacy single-scroll stack. A structural nav change on a core surface ramps via PostHog only after Grace SEEs it. **WEB-ONLY** — mobile Settings is a separate native surface (`apps/mobile/components/settings/SettingsBundleContent.tsx`), so there is no mobile mirror and the `redesignDefaultOnParity` test is unaffected (it only parses `REDESIGN_DEFAULT_ON`).

## Tests / verification

- `tests/unit/settingsTwoPaneShell.test.tsx` — shell render/behaviour: nav renders one item per section in order, first section selected on open, clicking a nav item swaps the panel + `aria-current`, optional identity header renders, empty-sections degrades gracefully.
- `src/app/components/settings/SettingsTwoPaneShell.stories.tsx` — Desktop (two-pane, with a play test that switches sections) + MobileWeb (single-column fallback) stories.
- `tests/unit/settingsManageSubscription.test.tsx`, `settingsDestructiveCopy.test.ts`, `webSettingsConnectionsParity.test.ts` — updated to follow the dialog cluster into `SettingsDialogs.tsx` (behaviour-identical; source shape moved).
- Rendered + SEEn via Storybook + Playwright at 1280px (desktop) and 390px (mobile-web): `/tmp/settings-twopane-desktop*.png`, `/tmp/settings-twopane-mobileweb.png`.

## Follow-ups

- Ramp `sloe_v3_settings` after Grace's desktop SEE-approval; collapse the gate + delete the legacy single-pane stack in a follow-up once it has held 100%.
- Mobile Settings IA reshuffle to the v3 named groups is a separate item (gap-backlog "Settings/Profile IA reconciliation").
