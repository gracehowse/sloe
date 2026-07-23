# In-app help / contextual guidance — scope (ENG-1597)

**Date:** 2026-07-23
**Owner:** Product / Engineering
**Status:** Scoped — ready for phased implementation
**Authority:** The 15 product loops in [`docs/journeys/README.md`](../journeys/README.md) are the backbone for *what* in-app help should explain. This spec decides *how* that guidance surfaces in the live app without duplicating the internal wiki.

---

## 1. One-paragraph summary

Ship **contextual, loop-aware guidance inside the app** — short explainers and “what’s next” rails at the moments users actually get stuck — rather than a second help center or a wiki link dump. **Phase 1** covers the **Recipe Capture loop** (Import → Verify → Save → Cook/Log): the highest-confusion, highest-viral wedge. Copy is **authored for users** in a shared registry (`src/lib/help/contextualHelp.ts`) and **sourced from** (not auto-generated from) the journey docs. Presentation is a **hybrid**: inline ⓘ triggers that open a compact sheet/dialog, plus one-shot session-limited coach hints where discoverability matters. Everything ships behind **`contextual_help_v1`** (default OFF) on web + mobile with before/after validation; deep methodology still lives on the existing web `/help` page, linked as an optional “Learn more” escape hatch.

---

## 2. Why this is its own build (not a docs task)

The 2026-07-19 documentation sweep made the *internal* loop narrative complete. Users who are mid-flow still need answers **without leaving the app** — and per the non-negotiable feature-flag rule, any new visual/structural UI (triggers, sheets, coach marks, copy) is a **real feature**: flag-gated rollout, tests, web↔mobile parity, session-replay validation. That work was deliberately deferred from the docs sweep; ENG-1597 holds the scope so it isn’t lost.

**Confidence: 8/10** on the architecture and phasing; **6/10** on exact Phase 1 surface ordering until PostHog funnel data is pulled for import→verify drop-off (called out below as a pre-build check, not a blocker to scoping).

---

## 3. Open questions — resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| Which surfaces first? | **Phase 1 = Recipe Capture loop only** (import review, verify/confidence, post-save “what’s next”, save-vs-log on Recipe Detail). Phases 2–4 mapped below; no full-app audit before Phase 1 ships. | Issue explicitly names this loop as the clearest first candidate; it has the most first-time confusion (parsing, verify, save-vs-log) and the most journey-doc coverage to draft from. |
| Tooltip vs help-center vs both? | **Hybrid, not a help center.** (A) **ContextualHelp** sheet/dialog from an ⓘ affordance — 2–4 short paragraphs + optional CTA. (B) **Session-limited inline hints** where discoverability is the problem (same gate pattern as `aiMethodTooltip`). (C) **Post-completion “what’s next” rails** after import save (extends the post-log micro-moment pattern in `docs/decisions/2026-06-20-post-log-what-next-micro-moment.md`). **No** in-app duplicate of `/help`. | `/help` already exists as the methodology deep-dive (web; mobile opens it via Settings). Rebuilding it in-app would fork copy and fail the “one product” bar. Competitor pattern: inline teach-at-point-of-use (Cherrypick drag hint) beats a separate help tab for flow confusion. |
| Link to docs hub vs author separately? | **Author separately, source from journeys.** Journey markdown is the *authoring reference*; user-facing strings live in `src/lib/help/contextualHelp.ts` (shared, unit-tested, parity-pinned). Optional `learnMorePath` deep-links to `/help#anchor` for methodology depth — never to `docs/journeys/*`. | Internal wiki paths are not user-facing; journey docs include engineering/legal caveats that must not leak verbatim. Shared registry prevents web↔mobile copy drift (same pattern as `aiMethodTooltip`, `usualMealHint`, `whyThisNumber`). |
| Analytics-first surface ordering? | **Do a 30-minute funnel check before ENG-1598 implementation starts** — `recipe_import_started` → `recipe_import_saved` → `ingredient_verify_opened` (if instrumented) — but **don’t block scoping** on it. Phase 1 surface list below is the default; reorder only if data shows a >10pt drop elsewhere in the loop. | Issue left this open; scoping needs a default. Data can reprioritize *within* Phase 1, not defer Phase 1 entirely. |

---

## 4. Product principles (normative)

1. **Answer the question the user has *right now*.** Not “here is everything about recipes.”
2. **Never block the flow.** Sheets/dialogs are dismissible; hints auto-retire after N sessions or explicit dismiss.
3. **Grounded, honest copy.** Especially on verify/confidence — align with [`docs/product/nutrition-approximation-policy.md`](../product/nutrition-approximation-policy.md) (flag-and-review, not silent guess).
4. **One filled CTA per help surface** — primary = “Got it” / close; secondary = ghost “Learn more” → `/help#…` when `learnMorePath` is set.
5. **Same element, same treatment** — one `ContextualHelpTrigger` primitive per platform; copy from the shared registry only.
6. **Respect existing hints** — do not duplicate `logsheet_ai_method_tooltip`, `usualMealHint`, or `why-this-number` surfaces; contextual help complements them.

---

## 5. Phased rollout

### Phase 1 — Recipe Capture loop (ENG-1598, build next)

| Topic ID | Surface | Trigger | User question answered |
|----------|---------|---------|------------------------|
| `import.how_it_works` | Import review (`RecipeUpload` web, `import-shared` / review mobile) | ⓘ in review header | “What happens when I import?” — personal copy, parsing, nutrition estimate |
| `import.confidence_scores` | Import review ingredient list | ⓘ beside confidence column / chip legend | “What does this % mean?” — match quality, not a guarantee |
| `verify.why_verify` | Verify UI (web inline in import form; mobile `/recipe/verify`) | ⓘ in verify header | “Why do I need to verify?” — accept floor, excluded-from-totals rule |
| `capture.post_save_next` | Post-save success sheet | **Auto rail** (first 3 saves per device) | “What’s next?” — verify if needed → Library → cook or log |
| `recipe.save_vs_log` | Recipe Detail primary actions | ⓘ near Save / Log CTAs | “Save vs log — what’s the difference?” |

**Out of Phase 1:** cookbook PDF import, creator attribution (has report flow), Cook Mode help (Phase 2).

### Phase 2 — Daily logging + trust (after Phase 1 at 100% two weeks)

Loops 5 + 7: Log sheet modes, barcode/voice/photo trust, low-confidence flags. Surfaces: `log-sheet.md` entry paths, trust chips, AI logging commit.

### Phase 3 — Plan / shop / discover

Loops 3 + 4: meal planning, shopping sync, Discover save cap, library organisation.

### Phase 4 — Progress / settings / household

Loops 8–10, 15: weekly recap, weight trajectory, household privacy boundary, targets editing.

**Deferred indefinitely:** Loop 14 (marketing — out of app), Loop 13 (shortcuts — power users), Loop 12 (creator — rail hidden until real creators).

---

## 6. Feature flag

| Field | Value |
|-------|-------|
| Name | `contextual_help_v1` |
| Default | **OFF** on web + mobile (`KNOWN_DEFAULT_OFF_FLAGS`) |
| Gate location | **Hosts** read the flag; shared registry is flag-agnostic. Each surface’s host passes `flagOn: isFeatureEnabled("contextual_help_v1")` into gate helpers. |
| OFF behaviour | Zero new UI — no ⓘ triggers, no coach rails, no empty placeholders. |
| Ramp | PostHog dashboard; before/after screenshots per surface per flag rule. |
| Removal | After 100% for two weeks with no regression, follow-up cleanup PR removes flag checks. |

---

## 7. Technical architecture

### 7.1 Shared module (implemented in this scope PR)

`src/lib/help/contextualHelp.ts`:

- `CONTEXTUAL_HELP_FLAG` — flag key constant
- `HelpTopicId` — stable string union for registered topics
- `HelpContent` — `{ title, paragraphs[], learnMorePath? }`
- `CONTEXTUAL_HELP_REGISTRY` — Phase 1 copy (pinned by unit tests)
- `shouldShowContextualHelp({ flagOn, topicId, dismissedTopics, sessionHints? })` — pure gate
- Persistence keys exported for callers (`suppr-contextual-help-dismissed-v1`, `suppr-contextual-help-session-v1`)

Mobile imports via existing `@/` / `@suppr` Metro alias — same as `aiMethodTooltip`.

### 7.2 Platform UI (ENG-1598 — not in this PR)

| Platform | Component | Notes |
|----------|-----------|-------|
| Web | `ContextualHelpTrigger` | `HelpCircle` icon button → `Dialog` with registry copy; uses design tokens |
| Mobile | `ContextualHelpTrigger` | `HelpCircle` → `BottomSheet` or existing sheet primitive; `PressableScale` + haptic |

Both accept `topicId: HelpTopicId` and handle dismiss persistence.

### 7.3 Session-limited rails

`capture.post_save_next` uses the same session counter pattern as `aiMethodTooltip` (`MAX_TOOLTIP_SESSION = 3`), stored under `suppr-contextual-help-session-v1` keyed by topic.

---

## 8. Analytics (implement in ENG-1598)

| Event | When |
|-------|------|
| `contextual_help_shown` | Sheet/dialog or coach rail rendered (`topic_id`, `surface`, `presentation`: `sheet` \| `coach_rail`) |
| `contextual_help_dismissed` | User closes without learn-more |
| `contextual_help_learn_more_tapped` | User taps ghost CTA (`learn_more_path`) |

Register in `src/lib/analytics/events.ts` + mobile mirror when UI lands.

---

## 9. Follow-up tickets (file in Linear when picking up implementation)

| ID | Title | Scope |
|----|-------|-------|
| **ENG-1598** | Contextual help Phase 1 — Recipe Capture UI | Primitives + 5 Phase 1 surfaces + tests + Maestro/Playwright smoke |
| ENG-1599+ | Phase 2 — logging/trust | After Phase 1 ramp |
| ENG-1600+ | Phase 3 — plan/discover | After Phase 2 |
| ENG-1601+ | Phase 4 — progress/settings | After Phase 3 |

*(ENG-1599 is already taken in Linear for import legal — use ENG-16xx series when filing; numbers above are illustrative placeholders.)*

---

## 10. Success criteria (Phase 1)

- [ ] All five Phase 1 topics render on web + mobile with identical copy (registry test green).
- [ ] Flag OFF → pixel-identical to today (visual regression / sim capture).
- [ ] Flag ON → sim-validated on import review, verify, post-save, recipe detail (web `web-drive`, iOS sim per skill).
- [ ] No new screen file >400 lines; triggers extracted if hosts grow.
- [ ] Journey docs unchanged except this spec link in [`docs/journeys/README.md`](../journeys/README.md).
- [ ] `/help` remains the deep methodology surface; no in-app help tab added.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Hint fatigue / nagging | Session caps + per-topic dismiss forever; coach rails only on first N loop completions |
| Copy drift from journey docs | Registry is single source; journey doc changes require explicit registry update + test |
| Web/mobile verify surface asymmetry | Topic copy is shared; `verify.why_verify` body mentions both inline (web) and post-save screen (mobile) in one honest paragraph |
| Legal leakage on import help | `import.how_it_works` uses user-safe framing from `/help#importing-recipes`, not `import-recipe.md` legal caveat section |

---

## 12. References

- Journey backbone: [`docs/journeys/README.md`](../journeys/README.md) — Loop 2
- Import loop detail: [`docs/journeys/import-recipe.md`](../journeys/import-recipe.md), [`docs/journeys/verify-ingredients.md`](../journeys/verify-ingredients.md)
- Existing patterns: `src/lib/today/aiMethodTooltip.ts`, `src/lib/nutrition/usualMealHint.ts`, `src/app/components/suppr/why-this-number-dialog.tsx`
- Web help deep-dive: `app/help/HelpClient.tsx`
- Post-log micro-moment precedent: [`docs/decisions/2026-06-20-post-log-what-next-micro-moment.md`](../decisions/2026-06-20-post-log-what-next-micro-moment.md)
