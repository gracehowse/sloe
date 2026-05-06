# 30-day milestone — persistence hardening (2026-05-05)

**Status:** Resolved.
**Authority:** 2026-05-05 supplemental mobile audit (finding K1, P0).
**Owner:** Grace / executor.

## Problem

The "49 days of meal logging" milestone modal auto-fired on every cold
launch and every navigation that briefly returned to Today. The
2026-05-05 supplemental audit captured 12+ surfaces with the modal
stacked on top: macro-detail x4, progress-metric x2, recipe-verify,
login, onboarding-v2-entry, onboarding-legacy-entry, final-tabs-shell,
log-sheet, today-current, today-scrolled.

For a real user this means open Today → modal → close → tap a macro
tile → navigate back → modal again. Functionally hostile.

### Root cause

The 2026-05-02 implementation of the milestone gate (in
`apps/mobile/app/(tabs)/index.tsx`) wrote `milestone_30_shown_at` to
Supabase via:

```ts
void supabase
  .from("profiles")
  .update({ milestone_30_shown_at: nowIso } as never)
  .eq("id", userId);
```

The `void` swallows the returned Promise + any `error` field. If the
update fails — for any reason: RLS, network, schema drift, the
client-cast `as never` masking a typing problem — there is **no log,
no Sentry breadcrumb, no retry**. The local `setMilestone30ShownAt`
optimistic update suppresses re-fire WITHIN the session, but the
NEXT cold launch reads the (still-null) server value and re-fires
immediately.

Verified at 2026-05-05 by querying the live DB:

```sql
SELECT id, milestone_30_shown_at, u.email
FROM profiles JOIN auth.users u ON u.id = profiles.id
WHERE u.email IN ('gracemturner@hotmail.co.uk', 'gracehowse@outlook.com');
```

Both rows had `milestone_30_shown_at = NULL` despite Grace having
49+ logged days and the modal having fired on multiple sessions. The
silent failure had been live since the gate was added on 2026-05-02.

## Fix

Three coordinated changes to
[apps/mobile/app/(tabs)/index.tsx](../../apps/mobile/app/(tabs)/index.tsx):

1. **Local AsyncStorage backstop.** Write
   `suppr.milestone_30.shown_at_local` immediately after the modal
   fires. Survives cold launch even if the server stamp fails. This
   is the layer that prevents the K1 symptom from ever recurring on
   the same device.

2. **Server stamp now logs errors.** Replaced
   `void supabase.from(...).update(...)` with an awaited update
   inside an IIFE that captures the `error` field and logs to console
   (and through that to Sentry's existing console-warn capture). A
   future RLS / column / network failure now surfaces instead of
   silently re-introducing the K1 symptom.

3. **Hydration effect reads the local backstop.** A new `useEffect`
   reads `suppr.milestone_30.shown_at_local` from AsyncStorage on
   mount; if present, it sets `milestone30ShownAt` so the gate
   short-circuits before the server-fetched value arrives. Without
   this, a user whose server write failed AND who relaunches before
   the server stamp succeeds would see the modal again — the
   AsyncStorage layer is only useful if it's actually read on mount.

### One-time data fix (immediate ungate)

To stop Grace seeing the modal on every launch RIGHT NOW (the new
code only takes effect on next build), I executed:

```sql
UPDATE profiles
SET milestone_30_shown_at = NOW()
WHERE id IN (
  'e9f85055-876b-4bde-9267-476567b16884', -- gracemturner@hotmail.co.uk
  'd4ba0160-40f9-4e58-aead-c49e0e39a59c'  -- gracehowse@outlook.com
);
```

No production users beyond Grace exist (per `project_solo_tester.md`),
so this fix is bounded.

## Validation

- **Server**: post-update SQL confirms both rows have non-null
  `milestone_30_shown_at`.
- **Sim cold launch**: `/tmp/sim-check/after-K1-cold-launch.png`
  shows Today rendering cleanly — empty ring, "WHAT TO EAT NEXT"
  card, Snap a meal, macro tiles, no modal overlay.
- **Sim deep-link to macro detail**:
  `/tmp/sim-check/after-K1-macro-protein.png` shows the macro detail
  rendering without the modal stacking on top.
- **Vitest**: `tests/unit/milestone30Day.test.ts` updated with two new
  pin tests — the AsyncStorage key string contract and a regression
  test that the gate honours a backstopped `shownAt`. 22/22 passing.
- **Mobile `tsc --noEmit`**: clean.

## What I did NOT change

- The gate function `shouldShowMilestone30Day` itself — it was
  always correct. The bug was the persistence wiring, not the
  decision logic.
- The dismiss handler — the dismiss path persists nothing because
  the modal showing already wrote the stamp. Once the user has
  seen it (modal mounted), it's "shown" regardless of whether they
  tapped Keep going or X.
- Server-side Supabase RPC that some other apps use for milestones.
  Suppr already has a typed `profiles.update` path; introducing an
  RPC would be over-engineering.

## Cross-platform

Mobile-only — there is no equivalent milestone surface on web. If
web ever gets this surface, the same three-layer pattern (ref →
AsyncStorage equivalent → server) is the right approach.

## Closes

- Audit finding K1 (P0)
- Notion task [`Audit P0] K1`](https://www.notion.so/35759b4150308108b779e23fd67042d7) → mark Done

## Knock-on note

The orchestrator agent's K1 framing ("modal auto-fires on every
deep-link landing") was partly inaccurate — RN's `<Modal>` renders at
the window root, so `capture-every-route.sh` (which doesn't dismiss
between captures) would have shown the modal on every screenshot
even if the gate was working perfectly. The REAL bug was that the
gate refused to short-circuit on the next cold launch because the
persistence layer was silently dropping the stamp. The fix addresses
the root cause — every cold launch from now on reads the local +
server `shownAt` correctly.
