# Genesis — documentation map

Quick routes into the existing `docs/` tree. **Do not duplicate long explanations** — open the linked file.

| Layer | Audience | Primary location | Notes |
|--------|----------|------------------|--------|
| Product | All / PM | [`../product/overview.md`](../product/overview.md), [`../product-roadmap.md`](../product-roadmap.md), [`../product/web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md) | Roadmap + **web/mobile parity rules** |
| User | End user | [`../user/`](../user/) | How-tos, onboarding |
| Journeys | UX / QA / Eng | [`../journeys/README.md`](../journeys/README.md) | Entry → action → result, organized by cross-cutting product loop (+ gap map to Maestro) |
| Technical | Engineer | [`../technical/architecture.md`](../technical/architecture.md), [`../technical/components.md`](../technical/components.md) | Stack, screens, components |
| API | Engineer | [`../api/endpoints.md`](../api/endpoints.md) | Route contracts |
| Data & schema | Engineer / data | [`../data/schema.md`](../data/schema.md) | Tables, RLS, analytics catalog |
| UX / UI | Design / Eng | [`../ux/patterns.md`](../ux/patterns.md), [`../ux/design-system.md`](../ux/design-system.md) | Interaction + tokens |
| Testing | QA / Eng | [`../testing/SYSTEM.md`](../testing/SYSTEM.md), [`../testing/overview.md`](../testing/overview.md), [`../testing/test-plan.md`](../testing/test-plan.md), [`../qa/SCREEN_TEST_MATRIX.md`](../qa/SCREEN_TEST_MATRIX.md) | Spec + stack + inventory + Maestro traceability |
| Security | Eng / trust | [`../security/auth.md`](../security/auth.md) | Auth + RLS posture |
| Operations | Internal | [`../operations/scripts.md`](../operations/scripts.md) | Scripts, support |
| Decisions | All | [`../decisions/`](../decisions/) | Why we chose X |
| Planning | Internal | [`../planning/`](../planning/) | Backlogs, sweeps |
| Design notes | Eng / design | [`../design/`](../design/) | Targeted UX/visual specs (digest, Discover hero, Health card, …) |
| Deployment | Eng / release | [`../deployment/`](../deployment/) | Ship checklist, CI secrets |
| Observability | Eng | [`../observability.md`](../observability.md) | Logging / analytics conventions |
| TestFlight feedback | Eng / QA | [`../testflight-feedback/`](../testflight-feedback/) | Beta issues tracker + resolved log |

**System specification (rules, quality bar, update process, task completion gates):** [README.md](./README.md) — documentation gate: [§2](./README.md#2-task-completion-gate-non-negotiable); **testing gate:** [testing/SYSTEM.md § Task completion gate](../testing/SYSTEM.md#task-completion-gate-non-negotiable)

**Product hub (changelog table + rules):** [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md)
