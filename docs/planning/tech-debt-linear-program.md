# Tech debt — Linear program (Q3 2026)

**Coordination:** [ENG-665 — Tech debt program — Q3 2026 priority stack](https://linear.app/suppr/issue/ENG-665/tech-debt-program-q3-2026-priority-stack)

**Hierarchy (Linear):**

- ENG-665
  - [ENG-573](https://linear.app/suppr/issue/ENG-573) (P5 umbrella) → [ENG-619](https://linear.app/suppr/issue/ENG-619), [ENG-620](https://linear.app/suppr/issue/ENG-620), [ENG-622](https://linear.app/suppr/issue/ENG-622)
  - [ENG-661](https://linear.app/suppr/issue/ENG-661)–[ENG-664](https://linear.app/suppr/issue/ENG-664) (TODO-derived)
- [ENG-533](https://linear.app/suppr/issue/ENG-533) — separate track under ENG-523 (capture program); **Urgent**

**Repo mirrors:** `TODO.md` § P2 / tech debt · `docs/planning/archive/ongoing-backlog.md`

## Priority order (May 2026)

| Order | Item | Linear | Notes |
|-------|------|--------|--------|
| 1 | Premium capture debt rollup | [ENG-533](https://linear.app/suppr/issue/ENG-533) | CF-3–CF-8; unblocks audit sign-off — **bump to Urgent** |
| 2 | Extract `useToday()` | [ENG-619](https://linear.app/suppr/issue/ENG-619) | P5 · Cycle 5 target |
| 2b | App Router migration | [ENG-622](https://linear.app/suppr/issue/ENG-622) | P5 |
| 2c | P5 umbrella | [ENG-573](https://linear.app/suppr/issue/ENG-573) | Close when 619–622 done |
| 3 | `@suppr/nutrition-core` | [ENG-620](https://linear.app/suppr/issue/ENG-620) | After 619 or parallel with boundaries |
| 4 | OFF ODbL cache-only | [ENG-661](https://linear.app/suppr/issue/ENG-661) | TODO OFF-1 |
| 4 | verifyRecipe atomic RPC | [ENG-662](https://linear.app/suppr/issue/ENG-662) | TODO.md |
| 4 | Onboarding parity | [ENG-663](https://linear.app/suppr/issue/ENG-663) | Web 4 vs mobile 11 steps |
| 4 | Planner web swap refit | [ENG-664](https://linear.app/suppr/issue/ENG-664) | Mobile has `refitDayMealsToTargets` |
| 5 | Weight chart consolidation | [ENG-376](https://linear.app/suppr/issue/ENG-376) | Progress · Cycle 3–4 |
| 5 | Cook ↔ recipe detail | [ENG-62](https://linear.app/suppr/issue/ENG-62) | Recipes |
| 5 | Add-custom-food parity | [ENG-28](https://linear.app/suppr/issue/ENG-28) | Today tab |

## Bootstrap

```bash
export LINEAR_API_KEY='lin_api_...'   # or .env.local
npm run linear:create-tech-debt-issues
npm run linear:create-tech-debt-issues -- --dry-run
npm run linear:link-tech-debt-hierarchy
```

Creates missing issues (idempotent by title), sets **ENG-533 → Urgent**, adds schedule comments on ENG-376/62/28.

## Not in this stack (stay in TODO only)

- Region-aware pricing (post-launch spec)
- FatSecret tier decision (FS-1)
- PRIV-1 cookie banner
- Household / community / CSV export
