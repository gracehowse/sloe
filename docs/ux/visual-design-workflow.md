# Visual design workflow — stop guessing, start diffing

Grace’s pain point: **web improved, mobile regressed**, colours/spacing feel wrong, and **Claude Design was never the single source of truth** agents actually built against.

This doc is the plug-in: a repeatable loop that uses **screenshots + the open prototype**, not more ad-hoc token tweaks.

---

## Why nothing matched Claude Design

Three masters exist in the repo. They **disagree on colour and density**:

| Source | Background | UI chrome (buttons/tabs) | Meals layout |
|--------|------------|--------------------------|--------------|
| **Claude Design bundle** (`docs/ux/claude-design-bundles/`) | Cool `#f4f5f7` | Brand blue `#4c6ce0` | Flat `.meal-row` list in one card |
| **Production** (`src/styles/theme.css` + `apps/mobile/constants/theme.ts`) | Warm `#fafaf8` | Warm ink `#1c1916` | Per-slot Breakfast/Lunch/… + Log usual |
| **TestFlight 49 baseline** (`docs/audits/2026-05-12-visual-sweep/`) | PNG captures | What felt “cohesive” on device | Same feature set as today, pre–May polish churn |

Implementation followed **production tokens + feature growth**, not a pixel pass from `screens-mobile.jsx`. That is why the bundle feels “not implemented properly” — it was **partially adopted**, then overridden by the warm-stone / ink-chrome migration (2026-05-20).

**Decision you need once (pick one primary judge):**

1. **Web + `theme.css`** — you said web looks better; mobile should **mirror web tokens**, not the old Claude cool-grey palette.
2. **Claude Design HTML** — revert chrome to blue + cool grey (large rollback).
3. **v49 PNGs** — freeze `docs/audits/2026-05-12-visual-sweep/mobile/` as the only pass/fail reference.

Until that choice is explicit, every UI pass will keep making mobile worse.

---

## The visual loop (run every UI change)

### 1. Open the Claude Design prototype (layout + hierarchy)

```bash
npm run design:prototype
```

Opens `http://localhost:4173/Suppr%20Prototype.html` — use for **structure** (macro 2×2 gap 10, flat meal rows, section headers), not for hex values unless you chose master #2 above.

Also read intent: `docs/ux/claude-design-bundles/prototype/chats/chat1.md`.

### 2. Capture **current** web

```bash
npm run dev
# other terminal:
npm run visual:web
```

Output: `screenshots/visual-audit/*.png` (Today, Plan, Progress, … at 390 + 1440).

### 3. Capture **current** mobile (sim)

Prereqs: Metro, signed-in iOS sim.

```bash
npm run mobile:dev
bash apps/mobile/scripts/run-visual-sweep.sh
```

Output: `docs/audits/visual-sweep-expanded/*.png`.

### 4. Side-by-side against v49

Open these three at once (Preview / Figma / any compare tool):

| Judge (v49) | Current mobile | Current web |
|-------------|----------------|-------------|
| `docs/audits/2026-05-12-visual-sweep/mobile/dark-01-today-default.png` | `docs/audits/visual-sweep-expanded/…` or sim screenshot | `screenshots/visual-audit/today-mobile.png` |

```bash
npm run visual:compare
```

Prints exact paths and a short checklist.

### 5. Token gate (web ↔ mobile colours only)

```bash
npm test -- tests/unit/crossPlatformThemeTokens.test.ts
```

Fails if mobile `theme.ts` drifts from `theme.css`. **Does not** catch spacing or layout.

### 6. Agent review (optional, scoped)

In Cursor, one screen at a time, attach the v49 PNG + `visual:web` capture, and prompt:

> Diff mobile Today vs attached baseline. List only regressions in colour, spacing, typography. No new ideas. Propose minimal diffs in `apps/mobile` to match web `theme.css`.

Agents: `design-system-enforcer` → `visual-qa` → `sync-enforcer`. Skip `orchestrator-full-sweep` for UI sprints.

---

## What actually fixes mobile (recommended order)

Since **web looks better**, treat **`src/styles/theme.css` as canonical** until you say otherwise.

1. **Colour** — Any mobile `Accent.primary` on secondary chrome (pills, links, tabs) → use `Colors.light.textSecondary` / slot tints; keep ink only for FAB + one primary CTA per screen.
2. **Spacing** — Today mobile uses `Layout.todayScrollGap` (12px) and `Layout.todayScreenPaddingX` (20px) in `apps/mobile/constants/layout.ts` — not the global `Spacing.md` (16px) bump. Re-run `npm run visual:compare` after changes.
3. **Meals** — Prototype is a **flat list**; product is **slot headers**. Do not delete slots; **reduce header weight** (13px semibold, muted kcal, slot-tint pills) — recent pass started this.
4. **Macro display** — Prototype is always **2×2 tiles** (`gap: 10`). Confirm Settings → **Tiles (2×2)**, not Bars.
5. **Stop** parallel theme experiments until `visual:compare` checklist is green for Today + Settings.

---

## Files to trust

| Need | File |
|------|------|
| Colours (production) | `src/styles/theme.css`, `docs/ux/brand-tokens.md` |
| Colours (mobile) | `apps/mobile/constants/theme.ts` |
| Layout reference (Claude) | `docs/ux/claude-design-bundles/prototype/project/screens-mobile.jsx`, `app.css` (`.meal-row`) |
| v49 baseline | `docs/audits/2026-05-12-visual-sweep/` |
| Today sprint spec | `docs/ux/today-premium-sprint-2026-05-19-baseline.md` |
| Sign-off gates | `docs/ux/premium-launch-sign-off-checklist.md` |

---

## External tools (optional)

| Tool | Use when |
|------|----------|
| **Playwright visual compare** | You commit baseline PNGs; CI fails on diff |
| **Chromatic / Percy** | Same, hosted |
| **Figma** | Only if you re-import from prototype HTML once |

| **Storybook** | Component primitives (`npm run storybook`) |
| **Applitools** | Optional hosted AI diff (`npm run test:e2e:applitools`) |
| **Centercode** | Beta tester feedback — not layout QA |

See [`docs/testing/VISUAL_REGRESSION.md`](../testing/VISUAL_REGRESSION.md).

No plugin replaces **one chosen master + side-by-side PNGs** for full-route sign-off.

---

## Next engineering slice (suggested)

One PR, mobile-only, scoped to **Today**:

- [ ] Side-by-side pass vs `dark-01-today-default.png` (5 bullet regressions max)
- [ ] `crossPlatformThemeTokens` green
- [ ] Maestro capture committed under `screenshots/mobile-polish-verify/`
- [ ] No changes to Plan/Discover until Today sign-off

Ask in chat: *“Run the visual compare workflow and fix the top 3 Today mobile regressions vs v49.”*
