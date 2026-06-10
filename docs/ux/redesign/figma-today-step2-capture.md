# Figma Today — step 2 capture runbook

**File:** [Sloe · Screens](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/) (`B3UdOFup7ITersgNuoXh0l`)  
**Prereq:** Local server — `cd docs/prototypes && python3 -m http.server 8765`  
**Stitch HTML:** rebuilt 2026-06-04 (minimal strip, budget chips, plum overage lap, Fibre on TD4)

## How capture works

1. Open each **capture URL** below in Chrome (Figma capture toolbar appears).
2. Wait for “sent to Figma” / success in the toolbar.
3. In Figma, open the file — new capture lands under the target **node** (or a new page if append failed).
4. **Replace** the old hero on that frame (select hero group → swap with capture, or paste on top and delete stale layers).
5. On `308:2` only: **delete or label** the bottom “Weekly Insight” marketing block — canonical insight is **`480:2` TD3**.

## Capture URLs (open in order)

| # | Stitch HTML | Figma frame | Node | Capture ID |
|---|-------------|-------------|------|------------|
| 1 | [today-over.html](http://127.0.0.1:8765/stitch-sloe/today-over.html) | S6 · Today (over) | `357:2` | `440fc084-082d-40b1-b102-d4035b7d1b0e` |
| 2 | [today.html](http://127.0.0.1:8765/stitch-sloe/today.html) | 01 · Today (logged) | `308:2` | `ac7cbb60-15cb-45ed-b3c8-c00d9017b8df` |
| 3 | [today-empty.html](http://127.0.0.1:8765/stitch-sloe/today-empty.html) | S5 · Today (empty) | `360:2` | `eaf64ac3-ae55-44ab-a2b8-5078115170aa` |
| 4 | [today-dark.html](http://127.0.0.1:8765/stitch-sloe/today-dark.html) | L5 · Today (dark) | `314:2` | `4694ec41-0f75-48c8-a7ff-ab26ff65d962` |

### Full capture links (macOS — paste in browser)

**1 · Over (P0 chip + ring)**  
http://127.0.0.1:8765/stitch-sloe/today-over.html#figmacapture=440fc084-082d-40b1-b102-d4035b7d1b0e&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2F440fc084-082d-40b1-b102-d4035b7d1b0e%2Fsubmit&figmadelay=1500

**2 · Logged under**  
http://127.0.0.1:8765/stitch-sloe/today.html#figmacapture=ac7cbb60-15cb-45ed-b3c8-c00d9017b8df&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2Fac7cbb60-15cb-45ed-b3c8-c00d9017b8df%2Fsubmit&figmadelay=1500

**3 · Empty**  
http://127.0.0.1:8765/stitch-sloe/today-empty.html#figmacapture=eaf64ac3-ae55-44ab-a2b8-5078115170aa&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2Feaf64ac3-ae55-44ab-a2b8-5078115170aa%2Fsubmit&figmadelay=1500

**4 · Dark**  
http://127.0.0.1:8765/stitch-sloe/today-dark.html#figmacapture=4694ec41-0f75-48c8-a7ff-ab26ff65d962&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2F4694ec41-0f75-48c8-a7ff-ab26ff65d962%2Fsubmit&figmadelay=1500

## After capture — quick manual fixes

| Priority | Frame | If capture missed it |
|----------|-------|----------------------|
| P0 | All heroes | Week strip: no clay fill; clay number + dot on selected day |
| P0 | `357:2` | Chip text **Over budget** |
| P1 | `357:2` | Ring: plum base + lighter plum second lap (no coral) |
| P1 | `308:2` | Remove/label bottom marketing Weekly Insight → use `480:2` |
| P2 | `481:2` | **Fiber → Fibre** (TD4 meal log — edit in Figma or re-capture `today-meallog.html`) |

## Optional: TD sections

TD1–TD4 HTML already matches app structure. Re-capture only if frames are stale:

- `today-activity.html` → `459:2`
- `today-hydration.html` → `463:2`
- `today-insight.html` → `480:2`
- `today-meallog.html` → `481:2`

Generate a new capture ID per page via Figma MCP `generate_figma_design` with `fileKey` + `nodeId`.

## 2026-06-04 capture results (raw imports)

These landed as **new frames** in the file — copy the hero into the canonical frames above, then delete the import scratch frames when done.

| Variant | Figma import link |
|---------|-------------------|
| Over | https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l?node-id=605-2 |
| Logged under | https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l?node-id=606-2 |
| Empty | https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l?node-id=607-2 |
| Dark | https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l?node-id=608-2 |

**Merge recipe:** open import → select hero (greeting through ring card) → copy → paste into `357:2` / `308:2` / `360:2` / `314:2` → align to frame width → delete old hero layers.

## Dark mode capture notes (2026-06-04)

- **`#figma-capture-root`** must use `#19181C` on dark variants (not `#FFFFFF`) or the hero imports as a light slab on `314:2`.
- **Remaining/Consumed** pill active state uses `#35323A` / cream text in dark (not white / plum).
- Re-capture **`today-dark.html`** at **390px** (`#figma-capture-root`) before merging into **`314:2`**; do not paste the light logged capture (`611`/`613`) into L5.
- Optional partial capture: `#figma-capture-what-next` for the north-star card only.

## Done when

- [ ] `357:2` shows **Over budget** + plum overage lap  
- [ ] Week strip has **no pill** on `308:2`, `360:2`, `357:2`, `314:2`  
- [ ] `481:2` says **Fibre**  
- [ ] `314:2` L5 dark: plum-charcoal canvas, dark hero card, dark macros (not white import)  
- [ ] Agents diff against `480:2` for weekly insight, not `308:2` bottom card  

See also: `figma-today-consistency-audit-2026-06-04.md`, `design-sources-stitch-figma.md`.
