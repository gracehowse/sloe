# Today hero status chip — Under / Over budget (2026-06-04)

## Decision

The calorie-ring status chip on Sloe Today uses Figma-aligned labels:

- Empty day → **Fresh start**
- At or under target → **Under budget**
- Over target → **Over budget**

Implemented in `src/lib/copy/today.ts` (`todayStatusChip`). Shared web ↔ mobile when Today Sloe parity lands.

## Context

An earlier calm-tone pass forbade “under budget” / “over budget” on general Today surfaces (net balance uses deficit/surplus). The 2026-06-04 stitch measured-spec note pinned “On track” for the chip — **superseded** by product direction: the chip is the one place those words are intentional and match `01 · Today` in Figma.

`FORBIDDEN_TODAY_PHRASES` still lists those bigrams so coach lines, banners, and weekly insight do not drift back; only `todayStatusChip` returns them.

## Verification

- `tests/unit/todayCopyParity.test.ts` — chip + date helpers
- `apps/mobile/tests/unit/todayHeroRingSloeChipStats.test.tsx`
