# Linear Backlog Restructure — 2026-06-11

**Owner:** autonomous backlog-hygiene pass (Claude)
**Trigger:** Grace — "Linear needs a thorough review — updating and reorganising. Issues still relevant might need to be moved under different or new projects/initiatives, consolidated, etc."
**Inputs:** live Linear GraphQL (team ENG, `e72181eb-19be-40ab-96e6-36230cc8352e`); the 2026-06-11 launch-readiness audit (`docs/ux/reviews/2026-06-11-launch-readiness-audit.md`, esp. §24 Backlog Assessment); git history on `main`; tonight's audit-filed issues ENG-1024..1052.
**Scope of authority:** execute reversible changes (moves, relabels, new projects, consolidations); conservative on closures; surface strategic calls rather than guess.

---

## 1. Headline counts

| Metric | Count |
|---|---|
| Open issues reviewed (excl. `Duplicate` state) | **336** |
| Already `Duplicate` (pre-existing, untouched) | 22 |
| **Orphaned (no project) at start** | 40 |
| **Orphaned (no project) at end** | **0** |
| New projects created | **4** (Gate 0 — launch hardening; AI features; Synthetic persona testing; Category-leading growth backlog) |
| Issues moved to a new/correct project | **86** (13 audit P0-P1s + 27 other orphans + 56 Category-leading + ENG-927 home corrections; −11 double-counted homes resolved) |
| Consolidated (closed as duplicate) | **2** (ENG-1042→ENG-858; ENG-1050→ENG-999) |
| Closed as Done (verified) | **0** — see §5 strategic call (the 31 In Review redesign issues were *not* bulk-closed; per-AC evidence is incomplete) |
| Closed as obsolete | 0 |
| Relabelled / re-prioritised | **1** (`launch-blocker` stripped from ENG-696) |
| Initiatives archived (empty duplicate) | **1** ("Premium experience — launch bar" duplicate `d4966476`, completed + project-less) |

> Net: every open issue now lives in a project; the audit's three flagged backlog problems (§24) are addressed; the launch-blocker set is coherent (20 active).

---

## 2. Structure as found vs. CLAUDE.md

The live structure is **much larger** than the three-initiative model in `.claude/CLAUDE.md`. There are **8 active initiatives** (plus the one empty duplicate now archived), not 3. CLAUDE.md's "Linear updates" section is **stale** and should be refreshed (strategic call §5.1). What was found:

- **Launch 2026-07-01** — matches CLAUDE.md + now gains Gate 0 and AI features.
- **Surface polish** — matches + now gains Category-leading growth backlog.
- **Platform foundations** — matches + now gains AI features and Synthetic persona testing.
- **Redesign — Design Direction 2026** (7 projects, P0–P5 + Figma conformance) — **not in CLAUDE.md.** The redesign shipped to `main` (`19bbff72` "the Sloe redesign", `55571a2e` "Design Direction 2026 close-out"); 31 sub-issues sit `In Review`.
- **Recipe import, AI imagery & creators** (Creator platform, AI image generation, Import posture & legal) — **not in CLAUDE.md.**
- **Premium experience — launch bar** (Premium P0–P5) — **not in CLAUDE.md**; now largely empty (P1–P4 = 0 issues). Likely superseded by the Redesign initiative.
- **Full-product audit sweep — 2026-05-25** (Audit sweep remediation, 34) — **not in CLAUDE.md.**
- **Plan Import** (2 sprints) — **not in CLAUDE.md.**

---

## 3. New projects created (with initiative wiring)

| Project | id | Initiative(s) | Why |
|---|---|---|---|
| **Gate 0 — launch hardening** | `e14030fd-…` | Launch 2026-07-01 | Homes the audit's net-new P0/P1 security/data/parity cluster (§26 "Gate 0"). 14 issues. |
| **AI features** | `9d24087b-…` | Launch 2026-07-01 + Platform foundations (dual) | Home for meal-coach engine, digest narrative, recipe-import vision parsing, nutrition-label OCR (decision docs `docs/decisions/2026-06-11-*`). Distinct from "AI image generation" (recipe imagery). 0 issues yet — decision docs landed, tickets not yet filed. |
| **Synthetic persona testing** | `1b3b4adf-…` | Platform foundations | Home for the synthetic-persona QA framework (`docs/testing/personas/` — MFP-refugee power logger, cold-start newcomer, lazy partial logger, Instagram recipe saver + RUNNER). 2 issues — the first `persona-feedback` findings (ENG-1053 Progress two-different-7-day-averages data-trust bug; ENG-1054 Log-sheet "Use this" CTA below the fold) landed mid-pass and were homed here. |
| **Category-leading growth backlog** | `4678349f-…` | Surface polish | Re-homed the 56 "[Category-leading]" research items out of "Figma conformance migration" (where they were miscategorised). Beta-window growth quality, not launch blockers (audit §24.3). |

---

## 4. Changes executed (full log)

### 4a. Moves — audit P0/P1s into Gate 0 — launch hardening (9)
ENG-1035 (P0 tier-lockdown bypass), ENG-1036 (RLS SECURITY DEFINER view), ENG-1037 (recipe-import SSRF), ENG-1038 (vendor cache), ENG-1039 (calcGoalTimeline two-point delta), ENG-1040 (mobile shopping portion multiplier), ENG-1041 (mobile fiber_g export), ENG-1043 (redeem_promo lockdown), ENG-1044 (tab order/glyph). Plus homed later: ENG-1024 (TDEE slope interpolate, Urgent), ENG-1045 (middleware getUser), ENG-1046 (foodSelectionToMeal dead code), ENG-1048 (web optimistic rollback), ENG-1049 (adherence/7-of-7 grammar). → **14 in Gate 0.**

> Note: the legal trio ENG-857/858/859 stays in **Import posture & legal** (its correct dedicated home, already `launch-blocker`-labelled). Gate 0 collects the *un-homed* security/data/parity audit items, not the legal project. Cross-referenced in the audit doc.

### 4b. Moves — other orphans to correct existing projects (27 total)
| Issue | → Project | Rationale |
|---|---|---|
| ENG-843 | Operations | CI `check:type-scale` gate config |
| ENG-844 | Landing + Marketing site | landing stale tab IA |
| ENG-856 | Premium P5 — Architecture enablers | decompose Today megafile (pairs ENG-703/619) |
| ENG-874, ENG-879 | Today tab | Apple Health / Health Sync MFP-meal surface |
| ENG-881, ENG-997, ENG-998, ENG-1002, ENG-1022 | Design system cleanup | colour token / Frost accent / type-scale / chip grammar |
| ENG-986 | Design system cleanup | shared macro-icon mapping (glyph-drift) |
| ENG-987 | AI image generation | image-prompt template (Nano switch) |
| ENG-989, ENG-1052 | Schema refactor | step-centric recipe schema / smallint→int hardening |
| ENG-991 | Pre-launch monetisation + billing | HSA/FSA via TrueMed |
| ENG-992 | Progress tab | Life-Score weekly number |
| ENG-993 | Operations | PostHog first-party proxy (infra) |
| ENG-999 | AI image generation | fal image-gen cost guardrail + model tier |
| ENG-1020, ENG-1023 | Today tab | e2e-walk P2/P3 + health follow-ups |
| ENG-1030, ENG-1031 | Progress tab | Apple Health grammar / chart swipe paging |
| ENG-1042 | Import posture & legal | then consolidated → ENG-858 (see 4d) |
| ENG-1047 | Recipes tab | generic "Imported recipe" title |
| ENG-1050 | AI image generation | then consolidated → ENG-999 (see 4d) |
| ENG-1051 | Plan tab | pantry/staples model |

### 4c. Moves — Category-leading tranche (57)
All 56 "[Category-leading]" issues (ENG-928→983) → **Category-leading growth backlog**. ENG-927 (brand drift Suppr→Sloe — *not* a category-leading item) → **Design system cleanup**.

### 4d. Consolidations (closed as duplicate, evidence-cited)
- **ENG-1042 → ENG-858.** Both = the import source-card credit/disclaimer requirement. ENG-858 ("Surface link-back + creator credit on imported recipes") is the canonical, predates ENG-1042, carries `launch-blocker`. ENG-1042 was the audit's P1-7 disclaimer item (`audit §11 P1-7`). Duplicate relation + comment + state set. Tracking continues on ENG-858.
- **ENG-1050 → ENG-999.** Both = fal image-gen cost guard. ENG-999 is broader (guardrail **and** Nano-vs-FLUX tier selection at viral scale); ENG-1050 was the audit's narrower P2 (`audit §12`). Duplicate relation + comment + state set. Tracking continues on ENG-999.

### 4e. Relabel
- **ENG-696** — stripped `launch-blocker`. Low-priority web Plan-Import parity for a feature that is itself a backlog sprint; a beta-window nicety, not a hard launch gate (audit §24.3). Comment added.

### 4f. Initiative cleanup
- Archived the empty, `Completed`, project-less duplicate initiative **"Premium experience — launch bar"** (`d4966476`). The active one (`30550be5`, `atRisk`, 6 projects) is the real one. Reversible (Linear `initiativeDelete` = trash).

---

## 5. STRATEGIC CALLS FOR GRACE (not executed — need your judgment)

### 5.1 — Refresh CLAUDE.md's "Linear updates" section (process)
The documented initiative inventory (3 initiatives) is badly out of date — there are 8. The dual-initiative pattern, project list, and "current initiative inventory (as of 2026-05-16)" all predate the Redesign, Recipe-import, Premium-experience, Audit-sweep, and Plan-Import initiatives. **Recommend** I rewrite that section to match reality in a follow-up. (conf 9)

### 5.2 — The 31 In Review redesign issues: bulk-verify-and-close, or keep open? (the biggest cleanup lever)
The Sloe redesign **shipped and un-gated** (`19bbff72`, `55571a2e`, `852c8df1` default-ON). All 31 `In Review` issues live in the Redesign initiative. I **deliberately did not close them** because the audit proves several ACs are *still open* despite the close-out commit:
- **ENG-811** ("add a hardcoded-hex lint guard") — verified: **no such lint exists** (`scripts/` has `check:type-scale` but no hex/colour guard; audit §15 also recommends landing it). NOT done.
- **ENG-808** (emoji→Lucide) — audit §12 still lists emoji→Lucide residuals on 4 surfaces.
- **Tab order / glyph** (ENG-1017 / P1-9) — audit confirms still divergent.
- 246 hex literals + 875 off-scale spacing literals still in the tree (audit §22).

So the redesign *structure* shipped but the *enforcement/cleanup* tail did not. **Recommendation:** run a one-issue-at-a-time verification pass (not a bulk close) — close the ones whose AC is genuinely met (e.g. ENG-826 calorie ring, `ba10feb4`; ENG-840 un-gate, `852c8df1`; ENG-839 green CI, `caee917a`), keep the enforcement laggards open and move them under Design system cleanup. I can do this pass on request. (conf 8 — needs per-issue AC reading)

### 5.3 — "Premium experience — launch bar" initiative looks superseded
After cleanup it has Premium P0 (1 issue), Premium P5 (7, shared with Platform foundations), and P1–P4 **empty**. The Premium-bar work appears absorbed by the Redesign initiative and Gate 0. **Recommendation:** either (a) archive the empty P1–P4 projects and fold the survivors into Surface polish / Platform foundations, or (b) confirm it's a live lens you still track. I did **not** touch it — dismantling an initiative can lose roadmap signal. (conf 6)

### 5.4 — "Figma conformance migration" is still a 37-issue catch-all
Even after pulling the 56 Category-leading items, it holds three distinct workstreams: (a) the conform-to-Figma epics (ENG-888→902), (b) the Figma-Only build issues (ENG-903→918), and (c) **7 DECISION issues** (ENG-919–925 — Plan single vs multi-day, recipe rings vs tiles, filter taxonomy, fasting presets, meal-row image, Ask-coach scope). Those decisions gate downstream build work and several carry `needs/decision`. **Recommendation:** the 7 DECISION issues want your resolution — they're blocking, not buildable. Want them pulled into a short "Design decisions to ratify" view? (conf 7)

### 5.5 — "Schema refactor" project nearly empty (2 issues)
After homing, Schema refactor holds only ENG-989 + ENG-1052. If the schema-refactor program is complete, consider archiving the project; if not, it's under-populated relative to the P3 schema-hardening items in the audit (§13). Your call on whether to keep it as a standing home. (conf 5)

### 5.6 — Two near-empty product-area projects worth a second look
"Premium bar audit (2026-05-12)" is `complete` but retains 2 open stragglers (ENG-376 mobile weight chart, ENG-486 paywall offerings-loading **Blocked**). ENG-486 being Blocked + launch-relevant suggests it should move to Pre-launch monetisation or Gate 1. I left both in place pending your read. (conf 6)

---

## 6. Target structure (initiatives → projects → open-issue counts)

```
Launch 2026-07-01 [Active]
  ├─ Gate 0 — launch hardening ............ 14   ← NEW
  ├─ AI features .......................... 0    ← NEW (dual)
  ├─ Phase 0 — Viral push prep ............ 14
  ├─ Pre-launch monetisation + billing .... 10
  ├─ MFP-refugee capture .................. 8
  ├─ Today tab ............................ 23   (dual)
  ├─ Recipes tab .......................... 8    (dual)
  ├─ Pre-launch incorporation + legal ..... 7
  └─ Premium bar audit (2026-05-12) ....... 2    (complete; 2 stragglers — §5.6)

Surface polish [Active]
  ├─ Category-leading growth backlog ...... 56   ← NEW
  ├─ Today tab ............................ 23   (dual)
  ├─ Recipes tab .......................... 8    (dual)
  ├─ Progress tab ......................... 6
  ├─ Onboarding + Auth .................... 4
  ├─ Landing + Marketing site ............. 3
  └─ Plan tab ............................. 2

Platform foundations [Active]
  ├─ Design system cleanup ................ 17
  ├─ Premium P5 — Architecture enablers ... 7    (shared w/ Premium initiative)
  ├─ Operations ........................... 4
  ├─ Schema refactor ...................... 2    (§5.5)
  ├─ Post-iOS platform .................... 1
  ├─ AI features .......................... 0    ← NEW (dual)
  └─ Synthetic persona testing ............ 2    ← NEW (first persona-feedback findings)

Redesign — Design Direction 2026 [Active]   (shipped; 31 issues In Review — §5.2)
  ├─ Figma conformance migration .......... 37   (§5.4 — still a catch-all)
  ├─ Redesign P5 — Web & mobile-web parity  16
  ├─ Redesign P0 — Foundations & tokens ... 7
  ├─ Redesign P4 — Progress/Settings/etc .. 7
  ├─ Redesign P2 — Food logging & search .. 6
  ├─ Redesign P3 — Recipes & Plan ......... 6
  └─ Redesign P1 — Today & daily loop ..... 5

Full-product audit sweep — 2026-05-25 [Active]
  └─ Audit sweep remediation .............. 34

Recipe import, AI imagery & creators [Active]
  ├─ AI image generation .................. 9
  ├─ Import posture & legal ............... 4    (ENG-857/858/859 legal P0 bundle)
  └─ Creator platform ..................... 3

Plan Import [Active]
  ├─ Plan Import — Sprint 1 (paste) ....... 9
  └─ Plan Import — Sprint 2 (PDF + image) . 4

Premium experience — launch bar [Active]   (§5.3 — likely superseded)
  ├─ Premium P5 — Architecture enablers ... 7    (shared)
  ├─ Premium P0 — Evidence & enforcement .. 1
  └─ Premium P1–P4 ........................ 0
```

---

## 7. Launch-blocker set (post-restructure)

20 active `launch-blocker` issues (ENG-1042 dropped via consolidation; ENG-696 stripped):

- **Billing (6) — left untouched, owned by the monetisation-sequencing agent:** ENG-33, 49, 101, 123, 198, 667.
- **Legal P0 bundle (3):** ENG-857 (verbatim prose — P0, Urgent), 858 (disclaimer/credit), 859 (DMCA agent).
- **Gate 0 security/data (4):** ENG-1035 (tier bypass P0), 1036 (RLS view), 1037 (SSRF), 1038 (vendor cache).
- **Trust/safety/crash gates (7):** ENG-670 (Reel parse-rate gate), 715 (fasting health claim), 772 (editable eaten_at), 784 (portion micros scaling), 793 (check-in burn vs measured energy), 794 (notifications crash P0).

This matches the audit's §26 Gate-0 intent: the two P0s + the legal/security cluster + genuine trust gates; growth-quality "category-leading" features no longer carry the label.

---

## 8. What was NOT touched (guardrails honoured)

- The 6 billing launch-blockers (ENG-33/49/101/123/198/667) — monetisation agent owns them.
- The 35 polish/growth issues that had `launch-blocker` stripped earlier this session.
- The 2 already-closed (ENG-815 dup-of-814; ENG-883 obsolete).
- The 22 pre-existing `Duplicate`-state issues (Premium-bar-audit tranche).
- No issue deleted anywhere (consolidations = state→Duplicate + relation, reversible).
- No In Review redesign issue force-closed without per-AC evidence (§5.2).
