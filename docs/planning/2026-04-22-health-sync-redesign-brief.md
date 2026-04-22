# Health Sync — redesign brief (2026-04-22)

Source of brief: `ui-product-designer` agent run 2026-04-22. TestFlight pilot-round C9c (`AIC05bpyu` — "This page doesn't match prototype").

## 1. What's wrong today

- **Circle misuse.** Five open circles on the right of each row read as unselected radio/checkboxes. They are actually static "connected" indicators that flip to a green tick after one top-level Connect tap. Apple does not expose per-type read-perm state via HealthKit, so this pattern cannot be made truthful — must be removed.
- **Visual hierarchy.** Two equally-weighted cards plus a full-width primary button competing for attention. Destructive "Clear all imported data" sits at the same weight as the primary affordance.
- **Density.** Five rows + another card with three switches + three caption paragraphs, then a warning card, then CTA, then status line. Vertical wall. Captions repeat what the row already says.

## 2. Proposed layout

Follow prototype pattern (`screens-mobile.jsx` L691–711): Apple Health is a **data card**, not a permissions card. Read-only rows show the most recently read value — the only honest signal that a permission is actually granted.

Section-headers (`13 / FontWeight.semibold / textSecondary`, `marginLeft: Spacing.xl`, `marginBottom: Spacing.sm`) above each card:

### A. Connection status card (replaces the permission-list card)

- Card: `Radius.lg`, `padding: Spacing.xl`, `colors.card`, `borderColor: colors.border`.
- Row 1: heart-pulse icon (`Accent.primary`, 20) + "Apple Health" (17 / `bold`) + right-aligned pill. Pill states:
  - `Not connected` — neutral `inputBg` bg, `textSecondary`.
  - `Connected` — `Accent.success` @ 12% bg, `Accent.success` text.
  - `Needs attention` — `Accent.warning` @ 14% bg, `Accent.warning` text.
- Subtext (14 / `textSecondary`, `lineHeight: 20`, `marginTop: Spacing.sm`): one sentence, state-dependent (see §3).
- Primary button inline at bottom of this card (not floating at page end): `Connect Apple Health` → `Sync now` once connected. Full-width, `Accent.primary`, `Radius.md`, 16pt bold white, 48h, `Spacing.lg` top margin.

### B. "What Suppr reads from Health" (the honest version of the old checklist)

- Card with 5 rows matching prototype pattern: `footprints / scale / flame / heart-pulse / barbell` (lucide-react-native, 16px, tinted per prototype: steps `textSecondary`, weight `MacroColors.protein`, active `MacroColors.carbs`, resting `MacroColors.fat`, workouts `Accent.primary`).
- Each row: icon + label (13 / regular / `text`) on the left; right side shows **the most recent value** — e.g. `8,420 today`, `72.4 kg · Mon`, `410 kcal today`, `—` if never synced. `fontVariantNumeric: tabular-nums`, 14 / bold.
- `padding: 10px 0`, `borderTop: 1px solid border` on rows ≥ 2.
- Footer caption (11 / `textTertiary`, `marginTop: 10`): "Values update each time you tap Sync now. If a row stays blank, that category's read permission is off in the Health app."

### C. Nutrition Sync card (keep, tighten)

- Three rows, each a native iOS Switch (real user preferences — switches are correct here).
  1. Import meals from Health
  2. Simple labels only — indented, only visible when Import is on (hide disabled state — just conditionally render)
  3. Share meals to Health
- One short helper line per active toggle (max 2 lines). Retire the 3-caption paragraph block.

### D. Utilities list (retire centred link pair; promote to grouped list)

- Same card style, two rows with chevron:
  - `Open Health app · Manage permissions` → `x-apple-health://`
  - `Clear imported data…` in `Accent.destructive`

Spacing: `Spacing.lg` between cards, `Spacing.xl` horizontal gutter, `Spacing.xxl` below header. Remove trailing `lastResult` text — route sync outcome through `Alert` (existing error path).

## 3. Copy — honest under HealthKit's limits

Never claim a specific permission is on/off. Describe observed behaviour, point to Health.app for truth.

| State | Subtext |
|-------|---------|
| Not connected | "Connect to let Suppr read your steps, weight, energy and workouts from Apple Health. You choose what's shared in the next screen." |
| Connected, first sync pending | "Connected. Tap Sync now to pull your latest data." |
| Connected, last sync <24h | "Last synced {relative time}. Tap Sync now to refresh." |
| Connected, but nutrition returned empty + body moved (F-57 heuristic) | Pill → **Needs attention**. "Suppr synced your activity but didn't receive any food entries. Nutrition read access may be off — open Health to check." Inline `Open Health app` link. |
| Row value fallback (never read) | `—` em dash, `textTertiary`. Never empty circle. |
| Row value stale (>7 days) | Append ` · {relative date}` in `textTertiary`. |

## 4. Signalling "we can't tell"

Three layers, in order of prominence:

1. **Pill** on Apple Health header — only binary status surface, and it's about Suppr's *connection* (something we know) not per-type perms (something we don't).
2. **Row values** — populated number = "successfully read today". `—` after sync = "empty or not shared" (ambiguous; said so in footer rather than faking certainty).
3. **Footer caption** — names the limitation in one sentence, points at Health app. No icons, no warning colour — informational.

Replaces the current green-tick-vs-empty-circle binary, which just tracks whether `handleConnect` resolved true, not whether any specific type is readable.

## 5. File changes for executor (ordered)

1. **Edit** `apps/mobile/app/health-sync.tsx` — full rewrite of render tree per §2. Replace permission-list card with connection-status card + data card. Move primary CTA into status card. Convert troubleshoot/clear links into grouped `SettingsRow`-style list. Gate Simple labels row on `importEnabled`. Remove `lastResult` inline text; route sync outcome through existing `Alert`. Swap Ionicons → `lucide-react-native` glyphs (`footprints`, `scale`, `flame`, `heart-pulse`, `dumbbell`).
2. **New** `apps/mobile/components/health/HealthStatusPill.tsx` — `{ state: 'disconnected' | 'connected' | 'attention' }` → token-driven pill. Reusable on More screen.
3. **New** `apps/mobile/components/health/HealthDataRow.tsx` — `{ icon, tint, label, value, stale?: boolean }`. Handles `—` fallback, tabular-nums, border-top for non-first rows.
4. **Edit** `apps/mobile/lib/healthSync.ts` — extend result surface persisted after each sync so UI renders per-row "last value" on cold open (`{ steps, weight, activeEnergy, restingEnergy, workouts, syncedAt }` in AsyncStorage under `health_last_values`). Read on mount, write on successful `syncHealthData`.
5. **Edit** `apps/mobile/app/(tabs)/more.tsx` — update Apple Health row's `sub` to reflect the same three states using the new pill component.
6. **Edit** web `apps/web/src/app/(app)/settings/health/page.tsx` (or equivalent) — parity pass: same three sections, same copy, native web list styling. Web has no HealthKit so "What Suppr reads" becomes provider-agnostic. Flag to `sync-enforcer` as intentional platform variation.
7. **New** `docs/decisions/2026-04-22-health-sync-redesign.md` — one-pager capturing "no per-type perm indicator" rule. Mirror to Notion Decisions log.
8. **Tests** — update `apps/mobile/tests/unit/healthSync.*` snapshots; add test that `HealthDataRow` renders `—` when value is null and a number with tabular-nums when present.

## Acceptance criteria

1. No element on screen looks tappable but isn't — every circle/checkbox glyph gone.
2. Pill state derivable purely from `{ connected, lastSyncAt, lastSyncResult }` — no fake per-type booleans.
3. Data rows show numeric values after successful sync and persist across app restart.
4. Primary CTA is exactly one button on screen at any time (Connect OR Sync now), inside the status card.
5. `Clear imported data` requires destructive confirmation (already does) and lives in utilities list.
6. Prototype icon set (lucide) throughout; tints map to prototype's Apple Health card exactly.
7. Dark mode: pill backgrounds use accent @ 14–18% alpha; no hard-coded hex.

## Open questions

- **product-lead**: "Needs attention" pill — fire after 14 days of no sync too, or only on nutrition-empty heuristic? Brief says only heuristic.
- **nutrition-engine**: Weight row value = "most recent sample" or "today's if present, else most recent"?
- **sync-enforcer**: Confirm web parity scope in step 6 — web has no HealthKit so data card is necessarily thinner; flagging as intentional.
