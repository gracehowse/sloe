# Decision log: Phase 2 architecture + policy (2026-04-24)

**Date:** 2026-04-24
**Status:** Resolved
**Context:** captured inline during the [2026-04-24 full-sweep HOLD verdict](./2026-04-24-full-sweep-ship-verdict.md) execution. Three Phase 2 items needed design / policy calls before build — recorded here so execution doesn't re-open them.

---

## T6 — RevenueCat webhook architecture

**Decision:** **Append-only events table + reducer.**

A new table `revenuecat_events(id pk, event_type, app_user_id, user_id, received_at, payload jsonb)`. The webhook handler verifies the RC shared secret, resolves `app_user_id → user_id`, and inserts a row. A reducer function (service-role, idempotent on `id`) replays the events to compute current tier and writes `profiles.user_tier` via service role.

**Why:**
- Idempotent by construction — duplicate events insert once, reducer is a no-op.
- Auditable — full history of purchase / cancel / billing-issue / renewal events attached to the user.
- Matches the pattern we want for Stripe in T23 (`stripe_webhook_events` persisted dedup). Consolidating on one pattern avoids a second migration later.
- Disaster-recoverable — if tier drift happens, replay the events.

**Trade-off accepted:** slightly more surface area than a direct tier write. Worth it for audit + idempotency.

---

## T12 — Allergen surfacing launch policy

**Decision:** **Ship v0 before TestFlight cohort expand.**

Not "document accepted risk and defer". DI-P0-01 was raised 2026-04-19 as safety-critical and has not moved. We do not expand the tester cohort from N=1 until v0 ships.

**Scope of v0:**
- `recipes.allergens text[]` column + auto-populate at ≥0.70 ingredient-match confidence.
- "Contains: …" callout on recipe detail, web + mobile, never paywalled.
- Onboarding diet step updated to 14 regulated allergens: Peanuts, Tree nuts, Milk, Eggs, Fish, Crustaceans, Molluscs, Soy, Wheat, Sesame, Mustard, Celery, Sulfites, Lupin.
- Copy reviewed by `legal-reviewer` before ship (FDA-compliant framing, not prescriptive).

**Why:** safety-critical + "if nutrition is uncertain, do not guess" applies doubly to allergens. Documenting accepted risk for a severe-allergy user is not a real option.

---

## T13 — Weight surface mode default

**Decision:** **Show-by-default, with `hide` and `trends_only` opt-in under Settings.**

Add `profiles.weight_surface_mode text not null default 'show' check (weight_surface_mode in ('show','hide','trends_only'))`. Digest + Progress + weight-chart surfaces read the mode on every render.

- `show` — current behaviour. Weight tile + chart + numbers visible.
- `hide` — Digest weight tile replaced with logging-consistency stat; weight chart collapsed behind "Show weight data" button; streak + projection not shown.
- `trends_only` — arrow direction + "slightly up / down / stable" copy, no absolute kg anywhere.

**Why:**
- Preserves existing behaviour for the current tester (Grace) — non-disruptive default matches the standing feedback preference for not quietly changing experience.
- The DI risk is genuine but lives in the *absence of an opt-out*, not in the default value. Shipping any toggle closes DI-P0-03; arguing about the default anchor is a separate debate.
- `trends_only` and `hide` are equally discoverable in Settings.

**Follow-up (not in this decision):** consider a prompt at first sign of heavy weight-logging (e.g. daily for 4+ weeks) asking "Want us to soften how weight shows up?". Separate ticket.

---

## Dependencies

- T6 events table migration → new table + reducer fn (security definer). Pairs with T23 (Stripe persisted dedup) same pattern.
- T12 migration → `recipes.allergens text[]` + backfill job.
- T13 migration → `profiles.weight_surface_mode` column.

All three migrations land in Phase 2 before the TestFlight cohort expand gate.

---

## Related

- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md)
- [Executor backlog](../planning/sweep-2026-04-24-executor-backlog.md) T6, T12, T13
- [Full-sweep audit](../audits/2026-04-24-full-sweep.md) §A2, §E2, §E3
