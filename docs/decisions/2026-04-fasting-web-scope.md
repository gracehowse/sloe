# Decision: intermittent fasting — web vs mobile (2026-04, updated 2026-05-14)

**Status:** updated 2026-05-14 — web now ships an expanded surface.
**Backlog:** T13 in `docs/planning/sweep-2026-04-executor-backlog.md` (closed).
**Audit reference:** `docs/planning/premium-bar-systematic-followups-2026-05-12.md` line 456.

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

## Voice + trust posture

- Milestones are **descriptive, not prescriptive**. "Glycogen / Ketosis / Deep fast" describe commonly-cited body states from intermittent fasting literature. There is no "fast longer to lose weight" copy.
- No gamification on milestones (no "✓ achieved" badge once a milestone is hit — the chip just falls away).
- Web reads + writes the **same Supabase fields** as mobile (`profiles.fasting_window`, `profiles.fasting_sessions`), so a fast started on either client appears live on the other.

## Related

- Component: [`src/app/components/FastingTimer.tsx`](../../src/app/components/FastingTimer.tsx)
- Shared helper: [`src/lib/fasting/milestones.ts`](../../src/lib/fasting/milestones.ts)
- Unit tests: [`tests/unit/fastingMilestones.test.ts`](../../tests/unit/fastingMilestones.test.ts)
- Mobile counterpart: [`apps/mobile/app/fasting.tsx`](../../apps/mobile/app/fasting.tsx)
- Parity scope table: [`docs/product/web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md)
- In-app help: [`app/help/page.tsx`](../../app/help/page.tsx) — Intermittent fasting timer entry

## Outstanding deltas (web vs mobile)

These are deliberate, not drift:

- **Long-press End Fast** — mobile gates End Fast behind a long-press + warning haptic so a stray tap on an active 16h fast doesn't kill it. Web uses a single-tap End Fast (mouse pointer precision makes a stray hit unlikely; no haptics on the web).
- **Long-press delete a history row** — mobile lets the user delete an individual fast (forgot-to-end cleanup) via long-press. Web does not yet ship that affordance; tracked under premium-bar follow-ups.
- **Push notification milestones** — mobile schedules notifications at 8h / 12h / 16h marks via the local Expo notifications API; web has no equivalent. Tracked under the web notifications roadmap, deferred.

## Revisit when

Web notifications work picks up — at that point we can wire milestone push notifications on web to match the mobile experience.
