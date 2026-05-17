# Session-replay masking audit

Operator playbook + audit checklist for keeping PostHog session-replay
masking current as new surfaces ship. Closes ENG-534 (orchestrator
full-sweep action #7).

## Context

PostHog session replay is enabled on web (`src/app/components/AnalyticsProvider.tsx`)
and mobile (`apps/mobile/lib/analytics.ts`) with the project-level
posture set 2026-05-13 (see `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`):

- Web: `maskAllInputs: true` + `maskTextSelector: ".ph-mask"`
- Mobile: SDK defaults (`maskAllTextInputs: true`, `maskAllImages: true`,
  `maskAllSandboxedViews: true`) + `<PostHogMaskView>` for opt-in
  extras
- Sample rate driven by feature flag `session-replay-sample-rate`
  (ENG-516, default `1.0`)

**The SDK defaults protect entered text (inputs / textareas) but NOT
rendered text.** Anywhere a weight number, body-fat %, TDEE value,
or calorie total is rendered back to the user as plain `<Text>` /
`<p>` / `<span>`, that text lands in the replay segment as cleartext.

## Privacy classes

| Class | Examples | Mask required |
| --- | --- | --- |
| **HIGH** | Body weight, body fat %, height, BMR/TDEE | Yes — these are health PHI |
| **MEDIUM** | Daily calorie/macro totals, weekly weight delta, cook-history notes | Yes if replay shared beyond Grace |
| **LOW** | User-typed food/recipe names, custom food labels | No — the user sees these in their own session anyway |

## Audit baseline (2026-05-16)

Static-code grep for `.ph-mask` className (web) and `<PostHogMaskView>`
component (mobile) returned **zero adoption** outside the two
analytics-config files. The opt-in surface area exists in config but
no rendering surface has wired it up. P0 below ships the first
wave of mask adoption.

## P0 — HIGH-class surfaces that ship in this PR

| Surface (file) | What renders | Treatment |
| --- | --- | --- |
| `apps/mobile/app/weight-tracker.tsx` (journey numbers) | total-to-lose, lost, remaining | Wrap stats grid in `<PostHogMaskView>` |
| `apps/mobile/app/targets.tsx` (maintenance row) | adaptive TDEE kcal | Wrap maintenance row in `<PostHogMaskView>` |
| `apps/mobile/app/(tabs)/progress.tsx` (weight stat tiles) | latest weight, week delta, range delta | Wrap weight tiles in `<PostHogMaskView>` |
| `apps/mobile/app/weekly-recap.tsx` | weight delta + TDEE check-in | Wrap weight/TDEE rows in `<PostHogMaskView>` |
| `src/app/components/ProgressDashboard.tsx` | weight tiles + body-fat % + projection | Add `className="ph-mask"` to value spans |
| `src/app/components/Targets.tsx` | "Reach {goal} kg" / "Currently {n} kg" | Add `className="ph-mask"` to value spans |
| `src/app/components/Profile.tsx` | `BMR: {n} kcal · TDEE: {n} kcal` row | Add `className="ph-mask"` to value span |

## P1 — MEDIUM-class follow-ups (next sweep)

- Calorie ring centre values (both platforms) — `consumed` / `remaining` kcal
- Weekly recap weight delta + TDEE summary
- Cook-history note re-renders (`apps/mobile/app/cook.tsx`)

These ship in a follow-up PR once Grace eyeballs the P0 sim before
ramp.

## Pre-release checklist

Add to `docs/launch/checklist.md` Phase 1 row:

> **Session-replay masking re-audit.** Run the checklist in
> `docs/operations/session-replay-masking-audit.md` before every
> major release. Any new HIGH-class surface added since the last
> sweep must carry `.ph-mask` (web) or be wrapped in
> `<PostHogMaskView>` (mobile).

## How to mask new surfaces

### Web
Add the `ph-mask` className to the element that contains the
sensitive text. The class is non-visual — PostHog's CSS selector
config picks it up.

```tsx
<p>
  Currently <span className="ph-mask">{weightKg} kg</span>
</p>
```

The mask covers the wrapped element's text content in the replay
(rendered as grey blocks). Other siblings stay visible.

### Mobile
Wrap the sensitive view in `<PostHogMaskView>` from
`posthog-react-native`. Imports + a single wrapper level —
children render unchanged in the live app.

```tsx
import { PostHogMaskView } from "posthog-react-native";

<PostHogMaskView>
  <Text>{formatWeight(weightKg)}</Text>
</PostHogMaskView>
```

Tradeoffs:
- Wrap the smallest level that still contains all the sensitive
  text. Wrapping a screen-level View masks too much (debugging
  loses surrounding context).
- Wrapping a `<Text>` directly is fine. Wrapping a row that
  contains the `<Text>` + an icon is fine too.
- Inside SVG (e.g. `<text>` elements in `react-native-svg`), wrap
  the parent `<View>` since `<PostHogMaskView>` doesn't accept SVG
  children. Verify by spot-checking a captured replay segment.

## What is OK to NOT mask

- Recipe / food names typed by the user (LOW class — user sees
  their own content; not health PHI).
- Display names + emoji shown in the user's own session.
- Public marketing copy, button labels, navigation.
- Anything already wrapped in a parent `<input>` / `<textarea>` /
  `<TextInput>` (SDK default masks the value at entry; rendered-back
  copies in a separate element still need explicit masking).

## When to re-audit

- After every meaningful feature ship.
- Before any project-level change to replay capture (sample-rate
  ramps, sharing replays beyond Grace, replay-export-to-Slack
  workflow, etc.).
- As part of the pre-launch checklist (Phase 1 cut, 2026-06-30).

## Verification

After adding a mask, the fastest verification path:
1. Build + launch in sim / on web preview.
2. Trigger a session with the masked surface visible.
3. Open the replay in PostHog → scrub to the relevant frame →
   confirm the value renders as a grey block (not the actual text).

If the value still shows, common causes:
- Wrong className spelling (`ph-mask` not `ph_mask`).
- Mask View wrapping a sibling, not the actual text node.
- Web: parent element overrides the selector (rare; PostHog reads
  by descendent selector).

## Related

- `docs/decisions/2026-05-13-session-replay-and-feature-flags.md` —
  session replay enable + privacy posture
- `docs/decisions/2026-05-16-session-replay-sample-rate-flag.md` —
  sample-rate flag plumbing (ENG-516)
- `docs/operations/posthog-rollout.md` — sample-rate ramp schedule
