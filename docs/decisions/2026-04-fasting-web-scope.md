# Decision: intermittent fasting — web vs mobile (2026-04, updated 2026-06-07)

**Status:** updated 2026-06-07 — both surfaces migrated to the Sloe design system + OMAD added.
**Backlog:** T13 in `docs/planning/sweep-2026-04-executor-backlog.md` (closed).
**Audit reference:** `docs/planning/premium-bar-systematic-followups-2026-05-12.md` line 456; `docs/ux/redesign/figma-migration-tracker.md` (Fasting area, ENG-922).

## Decision (2026-04, original)

The **fasting timer** (start/end fast, live duration, session history) was **mobile-only**. It reads and writes `profiles.fasting_sessions` and `profiles.fasting_window` from the Expo app.

The **web app** did not ship an equivalent timer UI in that phase. Web users who cared about fasting were directed to the **mobile app** via Help copy.

## Update (2026-05-14)

Per the premium-bar audit (line 456 — "Web Fasting expansion to Zero/Apple Health bar (timer ring, milestones, history)"), the web `<FastingTimer />` was expanded from the original thin progress-bar MVP to match the mobile screen's trust posture:

1. **SVG progress ring** — same 0→2π sweep + 220px outer / 14px stroke geometry as the mobile ring (`apps/mobile/app/fasting.tsx`). Track uses the shared `--ring-bg` token so dark mode picks up correct contrast.
2. **Body-state milestone chips** — 8h Glycogen / 12h Ketosis / 16h Deep fast. Logic is in `src/lib/fasting/milestones.ts` (pure, unit-tested in `tests/unit/fastingMilestones.test.ts`) so mobile can adopt the same chips without re-deriving the rules. Only milestones the user has not yet hit are shown, capped by their chosen fast window — a 14:10 user never sees the 16h chip.
3. **Projected end time** — start + window hours, locale-formatted, rendered under the "Ends at" label alongside the Started time.
4. **History** — last 5 completed fasts; each row now shows duration + goal-window context (e.g. `15h 32m / 16h`) rather than the prior hours-only line.
5. **Not-fasting landing** — Timer glyph + "Fast when you're ready" headline + 16:8 / 18:6 / Custom quick-start chips, mirroring the mobile landing card so a user opening the web Fasting page sees the same shape they see on mobile.

The window picker is now disabled while a fast is active so we don't silently rebase the goal mid-session (parity with mobile, where the preset row is also hidden during an active fast).

## Update (2026-06-07) — Sloe DS migration + OMAD

Per the Figma migration tracker (Fasting area; frames `305:2` D5 timer, `498:2`/`498:3` K4 Today fasting entry) the fasting surfaces were migrated off the legacy **indigo** skin onto the **Sloe** design system, and OMAD was added.

1. **Indigo → Sloe colour migration.** Every colour now sources a Sloe token — clay (`--accent-primary` / `Accent.primary`) for the progress arc + End-fast pill, plum (`--foreground-brand` / `colors.navPrimary`) for serif headings + selected preset pills, frost-mist (`--ring-bg` / `colors.ringTrack`) for the ring track, surface-card (`--card` / `colors.card`) cream slabs, sage (`--success`) for the completed state. No hardcoded indigo anywhere on either platform.
2. **Sloe layout** (web `FastingTimer.tsx` + mobile `fasting.tsx`): plum serif heading, frost-mist/plum preset pills, 248px clay ring with a flame **stage chip** + serif elapsed numeral + "elapsed · X left" sub-line, a **Fasting stages** cream slab (Fed → Fat burning → Ketosis → Deep — shared `src/lib/fasting/stages.ts`), a Started/Goal cream slab, a clay End-fast pill, and the stage narrative as an **italic serif quote**.
3. **OMAD preset (ENG-922).** Suppr now supports all five windows — 16:8 / 18:6 / 20:4 / 14:10 / **OMAD** (stored as `23:1`, rendered "OMAD"). The preset list is shared (`FASTING_WINDOW_PRESETS` + `fastingWindowLabel` in `src/lib/fasting/milestones.ts`) so web + mobile never drift.
4. **All wired functionality preserved** — load/persist, the live timer + animated ring, start/end (mobile long-press End-fast), the in-app window picker, quick-start chips, history with long-press delete + "Extended" badge. Reskin + OMAD only.

The shared `src/lib/fasting/stages.ts` model (`FASTING_STAGES`, `fastingStageAtHours`, `fastingStageBarFraction`) is pure + unit-tested (`tests/unit/fastingStages.test.ts`), so the stage bar / chip / narrative never contradict each other and mobile + web share one definition.

## Voice + trust posture

- Milestones are **descriptive, not prescriptive**. "Glycogen / Ketosis / Deep fast" describe commonly-cited body states from intermittent fasting literature. There is no "fast longer to lose weight" copy.
- No gamification on milestones (no "✓ achieved" badge once a milestone is hit — the chip just falls away).
- Web reads + writes the **same Supabase fields** as mobile (`profiles.fasting_window`, `profiles.fasting_sessions`), so a fast started on either client appears live on the other.

## Related

- Component (web): [`src/app/components/FastingTimer.tsx`](../../src/app/components/FastingTimer.tsx) + page [`app/fasting/page.tsx`](../../app/fasting/page.tsx)
- Today entry (web): [`src/app/components/suppr/today-fasting-pill.tsx`](../../src/app/components/suppr/today-fasting-pill.tsx)
- Shared helpers: [`src/lib/fasting/milestones.ts`](../../src/lib/fasting/milestones.ts) (presets + labels), [`src/lib/fasting/stages.ts`](../../src/lib/fasting/stages.ts) (stage bar)
- Unit tests: [`tests/unit/fastingMilestones.test.ts`](../../tests/unit/fastingMilestones.test.ts), [`tests/unit/fastingStages.test.ts`](../../tests/unit/fastingStages.test.ts)
- Mobile counterpart: [`apps/mobile/app/fasting.tsx`](../../apps/mobile/app/fasting.tsx) + Today entry [`apps/mobile/components/today/TodayFastingPill.tsx`](../../apps/mobile/components/today/TodayFastingPill.tsx)
- Parity scope table: [`docs/product/web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md)
- In-app help: [`app/help/page.tsx`](../../app/help/page.tsx) — Intermittent fasting timer entry

## Outstanding deltas (web vs mobile)

These are deliberate, not drift:

- **Long-press End Fast** — mobile gates End Fast behind a long-press + warning haptic so a stray tap on an active 16h fast doesn't kill it. Web uses a single-tap End Fast (mouse pointer precision makes a stray hit unlikely; no haptics on the web).
- **Long-press delete a history row** — mobile lets the user delete an individual fast (forgot-to-end cleanup) via long-press. Web does not yet ship that affordance; tracked under premium-bar follow-ups.
- **Push notification milestones** — mobile schedules notifications at 8h / 12h / 16h marks via the local Expo notifications API; web has no equivalent. Tracked under the web notifications roadmap, deferred.

## Revisit when

Web notifications work picks up — at that point we can wire milestone push notifications on web to match the mobile experience.
