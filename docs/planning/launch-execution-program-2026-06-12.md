# Launch execution program — 2026-06-12

**Ruling (Grace, 2026-06-12):** "Other than the couple of items we have explicitly said are post-launch, everything else HAS to be done before we can launch and needs to be done ASAP." And: the product "is not launchable from a visual UI or UX perspective yet" — visual/surface work is launch-gating, not polish.

**Issue-writing standard (Grace, same day):** every Linear item must say **how to implement, not just what** — target files, approach (named patterns/helpers), step order, constraints, ACs, tests, verification — so any agent or developer picks it up without guessing. New items follow this; old items get upgraded on touch (Urgent set batch-upgraded 2026-06-12).

**Source of truth is Linear.** This doc is the operating view: lanes, order, exemptions, throughput. Refresh the counts when the picture shifts materially.

---

## Inventory (2026-06-12, post-PR #400)

~299 open: 265 Backlog · 15 Todo · 9 Triage · 3 In Progress · 3 In Review · 4 Blocked.

## Explicit post-launch exemptions (the ONLY out-of-scope items)

| ID | Why exempt |
|---|---|
| ENG-120 | "Post-launch housekeeping" (Lucide long-tail, ~64 files) |
| ENG-62 | "Post-launch." (Cook ↔ Recipe Detail consolidation) |
| ENG-119 (mobile tail only) | "post-launch polish" per issue text — web half is Done |
| GROW-14 | "Start week 1 post-launch" (micro-creator outreach) |
| GROW-11 | "Don't pitch until Week 5+" post-launch (mid-tier outreach) |

Everything else open is **launch scope**. If something in the backlog deserves exemption, it needs Grace's explicit call — do not silently defer.

## Throughput math (honest)

≈285 in-scope items ÷ 19 days to 2026-07-01 ≈ **15 closed/day sustained**. Recent measured velocity: 649 closed in the trailing 30 days ≈ 21/day — so the rate is achievable **if** (a) agent sessions run daily at recent intensity, (b) the founder-only lane (ops/marketing, ~25 items) keeps pace in parallel, and (c) L-sized items (pantry, plan-import sprints, several category-leading features) are started early, not last. The risk is not the item count — it's the L-sized tail and founder-gated serialization.

---

## Execution lanes (ordered inside each lane: cold-open surfaces → daily-use → detail)

### Lane A — Founder-only ops (Grace; agents pre-build everything possible)
Gate A: ENG-859 (DMCA — register as individual interim, see guide), ENG-670/ENG-7 (parse-rate gate — agents build the harness, Grace curates URLs), ENG-4 (beta recruit), ENG-122 (legal sign-off), ENG-34 (FatSecret portal creds), Gate B: ENG-3, ENG-198, ENG-101, ENG-486, ENG-33, ENG-49, ENG-123. Incorporation chain: ENG-513, ENG-514. Marketing: GROW-5/6/8/9/12/13/15/16.
Each has (or is getting) an implementation guide splitting "agent can pre-build" vs "only Grace".

### Lane B — Visual / surface (launch-gating; in flight now)
1. **TF57 wave (running 2026-06-12):** ENG-1064 (ring stroke, buttons, spacing, corners), ENG-1065 (Plan cohesion F-158/159/178/179; F-160 = proposal for Grace), ENG-927 (brand strings). ENG-997 closed as superseded.
2. **Token debt + enforcement:** ENG-1013 (188 hexes) → ENG-1056 (lint warn→error + mobile selector) → ENG-1018 (radius) → ENG-1002 (mobile type scale) → ENG-1007 (census gates). Sequence matters: migrate before enforcing.
3. **Web grammar parity:** ENG-1022 (chips/segments/tags), ENG-828/ENG-778 (contrast sweeps — re-verify against Sloe palette first; pre-Sloe colour refs may be stale).
4. **Redesign P5 web parity (13):** ENG-802 804 827 829-839 — finish ENG-826 (In Review) first.
5. **Figma conformance (31):** ENG-888 epic + ENG-889–918 — run per the epic's migration guide, one surface at a time.
6. **Misc:** ENG-986 (icon SoT), ENG-1016 (haptics), ENG-805 (check-in modal demotion — In Review, finish), ENG-1020 (e2e walk remainder), ENG-1030/1031 (Progress Apple grammar), ENG-68-class leftovers.

### Lane C — Product gaps / audit remediation
1. **Audit sweep remediation (36):** ENG-667 685 695-728 746-769 845 850 GROW-17/18/19 — triage pass first: several may be stale (same class as ENG-997); verify-then-implement.
2. **MFP-refugee capture (7):** ENG-771 epic — ENG-776 (save-meal create path) next; ENG-772 done.
3. **Plan Import S1 (9) then S2 (4):** paste + auto-rebalance before PDF/image.
4. **Today tab (19):** ENG-96 (Profile/Targets dedupe), ENG-1023 (health follow-ups), ENG-854 (make-anything-fit Mode A), ENG-28, rest per project order.
5. **Pantry (ENG-1051), import titles (ENG-1047), schema hardening (ENG-1052).**

### Lane D — Category-leading growth (56: ENG-928–983)
Per Grace's ruling these are launch scope. Order by the per-item "Research priority" embedded in each (P0 first: e.g. ENG-929 multi-add, ENG-932 barcode-as-wedge), S/M-effort items first to compound. Needs an enrichment pass (implementation guides) before fan-out — most are research-shaped.

### Lane E — Platform / infra
Premium P5 architecture enablers (7), Operations (5 + ENG-1074), AI image generation (9), Creator platform (3), ENG-769 (capture harness hardening), ENG-1075/1076/1077 (audit follow-ups).

---

## Standing process

- **Waves of 3–6 exclusive-file lanes** per session (workflow-orchestrated), adversarial review (craft + parity + correctness), then orchestrator pixel-verification on sim + web before commit. One PR per wave; CI green before the next wave.
- **Verify-then-implement** on any issue older than ~2 weeks (ENG-997 precedent: stale issues describe retired mechanisms).
- **Enrichment**: every touched issue leaves with an implementation guide; Urgent set done 2026-06-12, High set next.
- **Daily Linear hygiene**: close-on-verified-fix with evidence links; initiative status update when state moves.
