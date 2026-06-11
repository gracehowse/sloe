# Synthetic-user testing: methodology, tooling landscape, build-vs-buy — research survey

**Date:** 2026-06-11
**Status:** Research only — no code changes. **FOR GRACE'S CALL.**
**Question:** What is the best methodology and tooling for persona-driven exploratory app testing in 2026 — and is Claude-as-executor the right choice versus a dedicated product? (Prompted by the game-dev comparison: bot-players exist for games — does an equivalent exist for apps?)
**Context:** Phase 1 of Suppr's persona framework is built — Claude agents driving the iOS sim via simctl/idb accessibility tree + Playwright web, a persona roster with seeded test accounts, structured findings deduped and filed to Linear, nightly cadence. Scripted layers (Maestro mobile E2E, Playwright web E2E, Storybook+axe) are additive and stay (per `feedback_storybook_additive_keep_all_layers`).

---

## 1. Executive answer

**Keep building on Claude — with three honest caveats.** As of June 2026 there is **no commercial product that does persona-driven exploratory testing on iOS**. The genuinely autonomous/exploratory products are web-first; the mobile-first AI products are script-generation and self-healing regression, not persona exploration; the persona products don't drive a real app. Suppr's combination — iOS-first, accessibility-tree harness, seeded persona accounts, deep domain spec for oracles, Linear pipeline — is not purchasable today. The caveats: (a) raw API cost of a nightly fleet is **not** obviously cheaper than the closest commercial option, (b) the oracle problem is the weak link and will decide whether the framework produces signal or noise, and (c) sim-only coverage misses an entire class of bugs Suppr has already been bitten by. §6 takes the adversarial case seriously.

---

## 2. Commercial landscape 2026

Type key: **SH** = script-generation / self-healing regression (AI at authoring/maintenance time, deterministic execution). **AX** = genuinely autonomous exploratory agents at runtime. **VO** = visual/replay oracle. **PR** = persona research (no app driving). **GA** = generic computer-use agent.

| Product | Type | iOS support | Persona exploratory? | Price posture | Source |
|---|---|---|---|---|---|
| **Maestro (maestro.dev)** | SH + agent bridge | Yes (IPA, sim, no instrumentation) | No — but MCP server (Feb 2026) lets an external LLM "drive" devices, explore, self-heal tests; `assertWithAI`/`extractTextWithAI` give LLM-judged assertions via Maestro Cloud (free account suffices) | OSS CLI free; cloud paid | [Maestro MCP intro](https://maestro.dev/blog/maestro-mcp-an-introduction), [MCP docs](https://docs.maestro.dev/get-started/maestro-mcp), [assertWithAI](https://docs.maestro.dev/api-reference/commands/assertwithai), [AI config](https://docs.maestro.dev/api-reference/configuration/ai-configuration) |
| **QA Wolf** | SH (managed service) | Yes (Appium mobile added) | No — humans + AI build/maintain scripted suites | ~$40–44/test/mo; median ACV ~$90K/yr. Not solo-founder viable | [Vendr](https://www.vendr.com/marketplace/qa-wolf), [Bug0 pricing analysis](https://bug0.com/knowledge-base/qa-wolf-pricing) |
| **Rainforest QA** | SH | Web-only focus | No — explicitly human-in-the-loop, deterministic execution, anti-"autonomous" positioning | Mid-market/enterprise | [rainforestqa.com](https://www.rainforestqa.com/), [vs QA.tech](https://www.rainforestqa.com/blog/rainforest-vs-qatech) |
| **QA.tech** | AX | Claims iOS incl. TestFlight builds on its mobile product page (recent; maturity unverified — core docs are web-only) | Closest commercial match: fleet of autonomous agents explores app, NL test goals, "discovers edge cases through varied behavior" | Pay-as-you-go $500/mo for 1,000 executions, $1/extra | [Pricing](https://qa.tech/pricing), [AI agent docs](https://docs.qa.tech/core-concepts/ai-agent-testing), [Mobile page](https://qa.tech/product/mobile-testing) |
| **Sofy.ai** | SH/AX hybrid | Yes — 2,000+ real iOS/Android devices | Partial — "AI agents write, execute, maintain tests"; not persona-driven | $749/mo Starter, $1,999/mo Pro | [Pricing](https://sofy.ai/pricing/) |
| **Kobiton** | Device cloud + SH | Yes — real devices, scriptless Appium gen | No | From ~$83/mo (device cloud) | [kobiton.com](https://kobiton.com/), [CTO Club review](https://thectoclub.com/tools/kobiton-review/) |
| **mabl** | SH (agentic positioning) | Mobile exists; web-first DNA | No — auto-healing regression, "85% maintenance reduction" | Enterprise, quote-based | [mabl.com](https://www.mabl.com/ai-test-automation) |
| **Functionize** | SH ("digital workers") | Web-first | No | Enterprise | [functionize.com](https://www.functionize.com/page/functionize-vs-mabl) |
| **Testim (Tricentis)** | SH (self-healing locators) | Mobile product exists; record-and-maintain workflow | No | Enterprise | [TestCollab comparison](https://testcollab.com/blog/ai-testing-tools) |
| **Momentic** | SH (intent-based locators, NL tests) | **Native iOS added March 2026** — very new | No — authored tests, AI grounding at runtime | Quote-based (could not verify list pricing) | [Mobile launch](https://momentic.ai/blog/mobile), [docs](https://momentic.ai/docs) |
| **Octomind** | SH (URL → auto-generated Playwright) | No — web only | No — explicit philosophy: "AI doesn't belong in test runtime"; AI authors, Playwright executes deterministically | Startup-friendly, free tier | [TestSprite comparison](https://www.testsprite.com/use-cases/en/compare/momentic-vs-octomind) |
| **Meticulous** | VO (replay real user sessions against new code) | No — web only, needs recording snippet + traffic | No — regression via replay, mocked backend, deterministic Chromium | Startup-friendly | [How it works](https://www.meticulous.ai/how-it-works) |
| **Applitools (Eyes/Autonomous)** | VO + SH | Eyes SDKs cover native mobile; Autonomous is web | No | From ~$969/mo (Test Unit model) | [Platform pricing](https://applitools.com/platform-pricing/), [Delta-QA analysis](https://delta-qa.com/en/blog/applitools-pricing-2026/) |
| **Autosana** (YC) | SH/AX hybrid | Yes — iOS/Android/web, "E2E testing layer for your coding agents", MCP + GitHub Actions | Partial — NL test creation + self-healing; not persona-driven | Startup; pricing not public (could not verify) | [autosana.ai](https://autosana.ai/), [YC profile](https://www.ycombinator.com/companies/autosana) |
| **Drizz** | SH (vision-AI engine) | Yes — iOS + Android, vision-based not locator-based | No | Seed-stage ($2.7M, 2025); pricing not public | [drizz.dev](https://www.drizz.dev/), [funding](https://www.startuphub.ai/ai-news/funding-round/2025/drizz-exits-stealth-with-2-7m-for-mobile-app-testing-agent) |
| **Synthetic Users** | PR | n/a — interviews AI personas, never touches your app | Personas yes, app-driving no | $2–27 per synthetic interview | [syntheticusers.com](https://www.syntheticusers.com/), [NN/g caution](https://www.nngroup.com/articles/synthetic-users/) |
| **Claude computer use** | GA | Drives anything visible on a screen incl. iOS sim (what Suppr uses, via a11y tree rather than pixels) | Yes — with your own harness/personas | API tokens (see §5 cost) | [Computer use docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use) |
| **ChatGPT agent** (ex-Operator) | GA | No — browser/virtual-desktop only; standalone Operator was shut down 2025-08-31 and absorbed into ChatGPT agent mode | Not usable as an iOS executor | $200/mo Pro tier for meaningful limits | [OpenAI ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/), [Operator Wikipedia](https://en.wikipedia.org/wiki/OpenAI_Operator) |

**Game-side analogues (the friend's world):**

| Product | What it does | What transfers to apps |
|---|---|---|
| **modl.ai** | `modl:test` AI bots play/explore games, detect visual glitches, missing assets, perf issues, logic bugs; auto-generates bug reports with visuals + severity scores; imitation-learning on real player behaviour | The *output contract*: structured bug report + evidence + severity, auto-filed. The *bot fleet exploring content* concept. NOT the tech: imitation-learned policies need player telemetry at scale; engine integration is game-specific | [modl.ai](https://modl.ai/), [GamesBeat funding](https://gamesbeat.com/modl-ai-seriesa-ai-bot-qa-testing-griffin-gaming-microsoft-m12/) |
| **Razer QA Companion-AI** (GDC 2025 Copilot → 2026 Companion) | Zero-integration, vision-based: analyzes gameplay footage, flags off-design behaviour, generates structured repro-step bug reports with video evidence, monitors FPS/CPU/GPU; gameplay agents that execute test cases in development | Vision-as-oracle on the rendered surface, evidence-attached reports, perf telemetry alongside functional findings | [Razer blog](https://www.razer.com/blog/ai-that-plays-to-test-razer-qa-companion-ai-at-gdc-2026), [razer.ai/qa](https://www.razer.ai/qa/) |

**Landscape verdict.** The market splits cleanly: (1) AI-assisted *scripted regression* (most of the table — mature, iOS-capable, solves a problem Maestro+Playwright already solve for Suppr); (2) *autonomous exploratory* (QA.tech, early Sofy/Autosana claims — web-DNA, iOS support new or thin, none persona-driven); (3) *persona simulation* (Synthetic Users, UXAgent — never touches the real app). The intersection Suppr needs — **persona × exploratory × real iOS app × domain-aware oracle** — is empty. The friend's game world is ahead of the app world here precisely because games have an engine to integrate against and telemetry to imitate; apps don't, which is why app-side products retreated to script generation.

---

## 3. Research / OSS receipts

**LLM-driven mobile GUI testing (all Android — iOS academic work is essentially absent, which itself is a finding):**

- **GPTDroid** (Liu et al., ICSE 2024) — formulates GUI testing as LLM Q&A with *functionality-aware memory*. 75% activity coverage on 93 apps, **31% more bugs than the best baseline, 53 new bugs found on real Google Play apps, 35 confirmed/fixed by developers**. The strongest published evidence that LLM exploratory testing finds real bugs scripted suites miss. [Paper](https://arxiv.org/pdf/2310.15780), [ICSE](https://dl.acm.org/doi/abs/10.1145/3597503.3639180); zero-shot predecessor [QTypist/Chatting-with-GPT-3](https://arxiv.org/pdf/2305.09434).
- **DroidBot-GPT** (2023) — first GPT-powered Android UI automation; translates GUI state to NL prompts. [ResearchGate](https://www.researchgate.net/publication/370058559_DroidBot-GPT_GPT-powered_UI_Automation_for_Android).
- **AppAgent** (Tencent, 2023) — multimodal agent operating apps through a simplified action space; learns app usage by exploration + documenting. Foundation for the "agent learns the app, then tests it" pattern.
- **DroidAgent** (Yoon et al., 2024) — *intent-driven* testing: the agent sets its own high-level tasks per app, with planner/actor/observer/memory roles — the academic ancestor of persona-goal testing. [Paper](https://coinse.github.io/publications/pdfs/Yoon2024aa.pdf).
- **Mobile-Agent-v3 / GUI-Owl** (Alibaba X-PLUG, 2025) — SOTA open-source GUI agent framework: 73.3 on AndroidWorld. Multi-agent roles: **manager (plans), worker (acts), reflector (verifies each action's effect), notetaker (persists knowledge across the run)** — plus a self-evolving trajectory-production pipeline that turns successful runs into training/replay data. The reflection + notetaking loop is directly liftable. [arXiv](https://arxiv.org/abs/2508.15144), [GitHub](https://github.com/X-PLUG/MobileAgent).
- **VisionDroid** ("Seeing is Believing", 2024) — vision-LLM-driven detection of **non-crash functional bugs** (the hard oracle class: app doesn't crash, but behaviour is wrong) by judging screen sequences for logical coherence. [Paper](https://arxiv.org/pdf/2407.03037).
- **AUITestAgent** (2024) — requirements-oriented: NL requirement in, GUI function test + verdict out; separates interaction from verification. [Paper](https://arxiv.org/pdf/2407.09018).
- **Action-effect verification** ("Don't Act Blindly", 2026) — robust GUI automation by verifying each action's post-state and self-correcting before proceeding; the per-step antidote to silent drift. [Paper](https://arxiv.org/pdf/2604.05477).
- **Apple Ferret-UI / Ferret-UI 2 / Ferret-UI Lite** — Apple's own MLLMs for grounded UI understanding across iPhone/iPad/Web/TV; research models, no product or QA tooling shipped. Confirms Apple is investing in UI understanding, not selling a testing agent. [Ferret-UI 2](https://machinelearning.apple.com/research/ferret-ui-2), [Ferret-UI Lite](https://machinelearning.apple.com/research/ferret-ui). Could not verify any Apple-internal QA-agent usage.

**Persona / synthetic-user research:**

- **UXAgent** (Amazon Science, CHI 2025) — the canonical persona-testing system: Persona Generator (demographic sampling → full personas) → LLM agent with a **two-loop architecture (fast perceive-act loop + slow persona-reasoning loop)** → universal browser connector; outputs qualitative ("interview the agent about what it found confusing"), quantitative (action counts), and video. Heuristic evaluation with 16 UX researchers: praised for catching study-design flaws pre-human-study; **key limitation: agents complete tasks too optimally — they don't reproduce the non-linear, exploratory, error-prone behaviour of real humans**. [arXiv](https://arxiv.org/abs/2502.12561), [system paper](https://arxiv.org/abs/2504.09407), [site](https://uxagent.hailab.io/).
- **Active Personas** (2025, design-science study) — reports strong alignment between AI-persona feedback and human feedback on usability/accessibility issues. Positive but single-study; treat as suggestive. [Springer](https://link.springer.com/chapter/10.1007/978-3-032-14518-5_20).
- **NN/g on synthetic users** — the sober counterweight: synthetic research is a discovery co-pilot, not a replacement for watching real humans; it tells you what's *plausible*, not what's *true*. [NN/g](https://www.nngroup.com/articles/synthetic-users/).
- **Grounding evidence** — UGround (ICLR 2025) shows pure-vision grounding can beat a11y-tree-based agents by up to 20% absolute *on web benchmarks*, while survey work finds a11y trees give compact global semantics and hybrid (tree for structure, vision for verification) is the practical optimum. [UGround](https://osu-nlp-group.github.io/UGround/), [paper](https://arxiv.org/html/2410.05243v1). On iOS specifically, a practitioner replication of exactly Suppr's setup found **coordinate/vision tapping landed 42–57% of taps vs ~100% after measuring positions from the accessibility tree** (`idb`/`ui_describe_point`) — tree-first is right on iOS. [Meiklejohn, "Teaching Claude to QA a Mobile App" (2026-03)](https://christophermeiklejohn.com/ai/zabriskie/development/android/ios/2026/03/22/teaching-claude-to-qa-a-mobile-app.html).

---

## 4. Methodology: what good looks like in 2026

The convergent best-practice checklist, with where Suppr's phase-1 framework stands:

1. **Action grounding: a11y-tree-first, vision-on-demand.** Plan and act from the accessibility tree (compact, semantic, exact coordinates); take a screenshot when the tree is ambiguous, when verifying visual outcomes, or when content renders outside the tree (canvas, images, custom drawing — e.g. the Skia ring). ✅ Suppr already does this. ➕ Gap: codify "screenshot-verify after every state-changing action" (Mobile-Agent-v3's reflector; "Don't Act Blindly").
2. **Persona = goals + frictions + seeded state, not demographics.** A persona needs (a) a concrete goal stack ("log dinner fast, hates weighing food"), (b) behavioural frictions (impatient, skims copy, fat-fingers), (c) an account whose data matches the story (UXAgent's generator; DroidAgent's intent-driven tasks). ✅ Roster + seeded accounts exist. ➕ Gap: explicitly script *frictions* into prompts, or every persona converges to the same optimal path — the UXAgent failure mode.
3. **The oracle problem is the core problem.** An explorer without an oracle is a random walker. Layer oracles, strongest first:
   - **Hard oracles:** crashes, error logs, failed network calls, stuck spinners, dead taps (action → no state change).
   - **Spec oracles:** assertions derived from product docs. *This is Suppr's unfair advantage* — `docs/`, CLAUDE.md nutrition rules, and the targets/TDEE docs are a machine-readable spec no vendor tool would have. "Calorie target 1300 for this persona's stats" is a finding only a domain-aware oracle can raise.
   - **Metamorphic oracles:** relations that must hold without knowing the right answer — log the same food twice → totals double; switch units g↔oz → kcal unchanged; delete a logged item → ring returns to prior state; same query on web and iOS → same nutrition numbers (the parity rule as an executable oracle). Classic answer to "how do you know it's wrong without a spec". [Test-oracle survey](https://dl.acm.org/doi/10.1145/3715107).
   - **Vision-LLM judgment:** "does this screen make sense / is anything overlapping or truncated" (VisionDroid; Maestro `assertWithAI`). Weakest layer — use for triage, never as a sole gate.
4. **Findings are a triage queue, not test failures.** Exploratory output is probabilistic; never gate CI on it. File with confidence + severity + evidence (screenshot, a11y snippet, repro steps) — the modl.ai/Razer output contract. ✅ Suppr files to Linear. ➕ Gap: require a minimum-confidence bar and attached evidence before an issue is created.
5. **Flake control by separation of concerns.** Octomind's maxim — "AI doesn't belong in test runtime" — is right *for the regression layer*: exploration is allowed to be non-deterministic, regression must be deterministic. The pipeline between them: a confirmed exploratory finding gets a **promoted, deterministic Maestro/Playwright repro** when it's worth pinning. This keeps the three scripted layers additive (the standing rule) and makes the explorer a *generator* of scripted coverage.
6. **Dedup via stable fingerprints + run memory.** Fingerprint = screen/route + element + failure class; persist past findings and the app map across nights so the agent explores new ground instead of re-finding Tuesday's bug (GPTDroid's functionality-aware memory; GUI-Owl's self-evolving trajectories). ✅ Dedup exists. ➕ Gap: cross-run memory of *explored territory*, not just filed findings.
7. **Seeded-state hygiene.** Per-persona accounts reset to a known snapshot before each run; never share accounts between personas; treat state drift as a harness bug. (Meticulous solves this by mocking the backend — a reasonable web-side trick, wrong for Suppr where the Supabase round-trip is part of what's under test.)
8. **Cost control: model tiering + budgets + caching.** Cheap model for the perceive-act loop, strong model for plan/reflect/judge; hard per-session token budget; prompt-cache the persona + app-map prefix. (See §6 for the honest numbers.)
9. **CI integration: nightly, never blocking.** Nightly cadence with a morning digest; only hard-oracle crash findings may page. ✅ Matches the design.
10. **Where persona exploration genuinely adds value over scripted E2E** (the evidence): finding bugs on paths nobody scripted (GPTDroid: +31% bugs, 53 new in production apps); catching incoherent-but-not-crashing behaviour (VisionDroid class); pre-human-study UX read-throughs (UXAgent's validated use); domain-plausibility violations (Suppr's adaptive-TDEE ~1300 kcal episode is exactly the shape of bug a persona with a spec oracle would flag and a Maestro flow never would). Where it does *not* add value: anything already pinned by a deterministic test; pixel-perfect visual regression (Storybook/Applitools-class diffing is strictly better); performance measurement.

---

## 5. The Suppr verdict — build on Claude, with discipline (FOR GRACE'S CALL)

**Recommendation: keep the Claude-based framework as the exploratory layer. Confidence 8/10 on the direction, 6/10 on cost-efficiency until a month of precision data exists.**

Why build wins for Suppr specifically:

1. **The product Grace would want to buy does not exist.** Persona-driven exploratory testing of a real iOS app is offered by nobody in §2. The closest (QA.tech mobile) is weeks-old web-DNA tooling with goal-driven agents but no persona model, no domain oracle, and unverified iOS maturity.
2. **The oracle advantage is structural, not incremental.** Every vendor tool is generic by necessity; Suppr's explorer reads the repo's own docs and nutrition rules. No SaaS will ever know that a maintenance estimate of 1300 kcal for a given persona is a bug. For a nutrition product where correctness is the brand ("if nutrition matching is uncertain, do not guess"), the domain oracle is most of the value.
3. **The harness was nearly free and compounds.** The a11y-tree driving skill, seeded accounts, and Linear pipeline are the same assets used for everyday dev verification (`suppr-ios-sim-testing`, `suppr-web-testing`); the persona layer rides on them. A vendor adoption would *add* integration work, not remove it.
4. **iOS-first eliminates most of the market anyway** (web-only: QA.tech docs-core, Octomind, Meticulous, Rainforest focus; iOS-new: Momentic 2026-03; iOS-capable-but-scripted: Maestro, Sofy, Kobiton, Autosana, Drizz).

### Where we'd be better off buying (or borrowing)

- **Maestro Cloud AI assertions (free tier)** — adopt `assertWithAI` for the handful of scripted Maestro flows where element-based assertions are brittle (dynamic content, the ring's rendered state). Keep them `optional: true` so AI flakiness never blocks CI. Receipt: [AI config docs](https://docs.maestro.dev/api-reference/configuration/ai-configuration).
- **Visual-regression oracle** — if/when pixel-diff coverage beyond Storybook is wanted, buy it (Applitools Eyes or a cheaper percy-class tool) rather than asking the LLM to eyeball diffs; LLM judgment misses 4.0:1-vs-4.5:1-class deltas (already learned: `feedback_root_cause_class_of_bug`).
- **Real-device pass pre-launch** — a one-month device-cloud rental (Kobiton from ~$83/mo or BrowserStack equivalent) in the final pre-launch month, plus Grace's own device via TestFlight. Sim-only blind spots are real (§6).
- **Web exploratory volume, if it ever needs scale** — QA.tech PAYG ($500/mo, 1,000 executions) is a fair benchmark price; if Suppr's web persona runs ever exceed that in token spend without exceeding it in value, switch the *web* half and keep iOS in-house.
- **Not worth buying:** managed services (QA Wolf ~$90K ACV), enterprise platforms (mabl/Functionize/Tricentis), game-side tools (engine-specific), Synthetic Users (no app driving; the persona-interview trick is replicable in-house for tokens).

### What to ADOPT into the framework (from papers/products)

1. **Reflector + notetaker roles** (Mobile-Agent-v3): after every state-changing action, verify the effect against the a11y tree/screenshot before proceeding; persist a run-notes file (app map, explored routes, dead ends) across nights. [arXiv 2508.15144](https://arxiv.org/abs/2508.15144)
2. **Functionality-aware memory** (GPTDroid): carry "what this screen is for + what's been tried" in the prompt, not just raw action history — drives coverage instead of loops. [arXiv 2310.15780](https://arxiv.org/pdf/2310.15780)
3. **Two-loop persona architecture + agent interviews** (UXAgent): separate the fast act-loop from the slow persona-reasoning loop; end each session by interviewing the agent in persona ("what was confusing? what almost made you give up?") and file *that* as UX-research signal, distinct from bug findings. [arXiv 2502.12561](https://arxiv.org/abs/2502.12561)
4. **Metamorphic nutrition oracles** (test-oracle literature → Suppr domain): encode the §4.3 relations (double-log, unit-switch, delete-restore, web↔iOS parity) as cheap programmatic checks the agent runs during exploration. Highest signal-per-token of anything on this list.
5. **Evidence-attached, severity-scored findings** (modl.ai / Razer output contract): no Linear issue without screenshot + repro steps + confidence + severity; auto-dedup by fingerprint.
6. **Promote-to-deterministic pipeline** (Octomind's runtime philosophy): confirmed finding → fix → deterministic Maestro/Playwright repro added in the same change, keeping the scripted layers the source of regression truth.
7. **Model tiering + per-night budget caps** (cost control, §6).

### The strongest argument AGAINST — taken seriously

**"This is an expensive random walker that will flood Linear with confident noise."** Three legs:

1. **Cost is not actually cheaper than buying, at API prices.** Honest math (Anthropic list pricing: Sonnet 4.6 $3/$15 per MTok, Opus 4.8 $5/$25, Haiku 4.5 $1/$5): a 45-minute persona session ≈ 60–100 agent turns; with prompt caching, plausibly ~$2–4 on Sonnet-class, ~$5–8 on Opus-class per session. Six personas nightly on Sonnet ≈ **$400–700/month** — the same order as QA.tech's $500/mo PAYG. The in-house cost advantage is real only because (a) sessions can run under the existing Claude Code subscription rather than metered API, (b) tiering (Haiku act-loop + Sonnet reasoning) can roughly halve it, and (c) the spend buys domain-aware findings, not generic ones. *Mitigation:* hard per-night token budget; tiered models; start at 2–3 personas/night, not the full roster.
2. **The oracle is weak exactly where the persona idea is most novel.** LLM judgment of "is this UX wrong?" produces plausible-sounding false positives, and UXAgent's own evaluation says agents behave too optimally to reproduce real-human confusion — so the framework can simultaneously over-report speculative nits and under-report genuine usability walls. This is the documented failure mode from Suppr's own history too: phantom findings from a stale bundle (ENG-764/770) and over-claiming agents. *Mitigation:* confidence gate + evidence requirement before filing; weekly precision review (**target ≥40% of filed findings accepted**; if below that after 4 weeks, narrow the oracle to crash/data-integrity/metamorphic classes and drop free-form UX judgment); verify every finding against current code/bundle before filing (`feedback_visual_sweep_stale_bundle`).
3. **Sim-only blind spots are a proven bug class for Suppr.** The iOS 26 HealthKit hang, the ISP route block to Supabase, real-device perf — none discoverable in the sim. A nightly sim fleet can create false confidence. *Mitigation:* scope claim explicitly (the persona layer tests *app logic and UX in sim*, nothing else); monthly real-device TestFlight pass; pre-launch device-cloud month (above).

**Kill/scale rule (proposed):** run 4 weeks of nightly sessions with the precision metric tracked in the digest. ≥40% accepted-finding precision and ≥1 P1-class catch → scale the roster. Below that → cut to crash + metamorphic oracles only, halve the cadence, and revisit after launch.

---

## 6. Pending / could-not-verify

- Momentic, Autosana, Drizz list pricing — not public; quote-based.
- QA.tech iOS/TestFlight maturity — product page claims vs docs (web-only examples) conflict; would need a trial to verify.
- Claude vs Operator OSWorld numbers circulating (73% vs 38%) come from a competitor's blog — treat as unverified marketing; the directionally safe claim is that Anthropic's computer-use models lead OSWorld-class benchmarks as of early 2026 and Operator-the-product no longer exists.
- Apple internal use of UI agents for QA — no public evidence beyond the Ferret-UI research line.
- No published head-to-head of persona-LLM exploration vs scripted E2E on *bug yield per dollar* exists anywhere yet; GPTDroid's +31%/53-new-bugs result is the nearest proxy and predates current-generation models.

## Pending Notion mirror actions

- None — research doc, no decision resolved, no roadmap state change. If Grace ratifies the verdict (§5), add a Decisions log row linking this file.
