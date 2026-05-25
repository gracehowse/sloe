#!/usr/bin/env node
/**
 * Updates existing Plan Import Linear issue descriptions to match
 * docs/planning/plan-import-linear-program.md (May 2026 spec).
 *
 * Run: node scripts/linear/update-plan-import-issues.mjs [--dry-run]
 */

const LINEAR_GQL = "https://api.linear.app/graphql";

const REPO_DOC = "docs/planning/plan-import-linear-program.md";
const PROTO = "docs/prototypes/2026-05-24-plan-import/index.html";

/** @type {Record<number, string>} */
const UPDATES = {
  646: `Umbrella for Plan Import delivery. Sprint 1 + Sprint 2.

**Product decisions (locked)**
- Entry: **Plan tab only** — wholesale plan import (individual meals stay save-to-library + auto-gen).
- Commit: new **plan template**; user chooses whether to activate (never silent replace).
- Plan name: auto-parse + always editable before commit.
- Nutrition modes at review: **(A) Author as published** · **(B) Match & verify** (default).
- Dual kcal: match mode shows Suppr primary + author secondary when source provides kcal or partial per-serving macros.
- Auto-rebalance: protein → carbs → fat; never vegetables (match mode only).
- Library import toggle: tag \`Imported · {plan name}\`; Published vs Verified markers.

**Source shapes:** meal-prep paste · **program PDF** (week grid + recipe pages with kcal panels) · coach PDF · kcal-per-meal list. Names-only grid → block at review.

**Pipeline (ENG-649):** recipes parsed first → link schedule → compile plan from matched refs.

**Repo doc:** \`${REPO_DOC}\` · Prototype: \`${PROTO}\``,

  647: `Replace ghost **Regenerate** with **Generate ▾** when a plan exists (chip row on Plan tab).

Dropdown:
- **Generate from library** — current regenerate behaviour
- **Import existing plan** → \`/plan-import\` paste flow

Empty state: same dropdown on "Generate my plan" area.

Mobile first; web parity if Plan setup exists on web.`,

  648: `Import sheet (\`/plan-import\`, step 1):
- Multiline paste: plan + recipe section (meal-prep, program PDF text, coach appendix)
- Eligibility callout: program PDF · meal-prep paste · coach PDF; warn on names-only grids
- Plan name field (pre-filled from parse; editable)
- Primary CTA → parse pipeline

Sprint 2 extends same sheet with PDF/photo tabs (ENG-655).`,

  649: `**Parse pipeline — recipes first, plan compiled second**

1. Extract recipe blocks (title, serves, ingredients, method, optional author nutrition panel)
2. Parse ingredients → Suppr match → per-recipe macros (canonical in match mode)
3. Extract weekly schedule (calendar grid and/or day × slot list)
4. Fuzzy-link slot labels → parsed recipes
5. Compile plan template rows; slot kcal = recipe nutrition × portion (no second nutrition pass)

**Output schema:** \`planName\`, \`recipes[]\` (key, title, ingredients, authorNutrition?), \`schedule[]\` (dayIndex, slot, label, recipeKeys[], claimedKcal?).

Flag unlinked/blocked slots before commit.

**Fixtures:** meal-prep paste · program PDF (grid + kcal panels) · coach PDF · kcal-per-meal list.

Shared: \`src/lib/planning/planImport/\` · API: \`/api/plan-import/parse\``,

  650: `Review screen (\`/plan-import\`, step review):
- Per-day meal rows: slot · title · Suppr kcal (primary) · confidence
- Author secondary when claimed kcal or partial per-serving macros (e.g. \`Protein ~38 g\`)
- Inline edit title before commit
- Blocked rows when no recipe link and no kcal

Assessment panel: plan avg kcal/day vs user target ±%.`,

  651: `Review controls:
- **Nutrition mode:** Author as published | Match & verify (default)
- **Library import** toggle — same nutrition pref; \`Imported · {plan name}\` tag
- **Auto-rebalance portions** toggle — match mode only; uses \`refitDayMealsToTargets\`
- Per-meal resolve: Accept Suppr · Review ingredients · Keep author's

Prototype: \`${PROTO}\` step 4.`,

  652: `On confirm:
1. Optionally save each parsed recipe to Library (\`source_name = Imported · {plan name}\`)
2. Create **plan template** from compiled slots (never silent replace)
3. Prompt **Activate imported plan?** — default keep current; imported saved as inactive template

Analytics: \`plan_template_created\`; track import source shape.`,

  653: `Dynamic Library filter chips for plan imports:
- Extract unique \`source_name\` values matching \`Imported · *\` from saved recipes
- Render as horizontal pills after static filters
- Selecting pill filters library list to that import batch

Prevents import graveyard anxiety.`,

  654: `\`POST /api/plan-import/parse\`
- Auth required (Bearer Supabase JWT)
- Body: \`{ text: string, planName?: string }\`
- LLM extract → ingredient verify per recipe → compile + link
- Rate limit per user (mirror verify-recipe / voice-log)
- Log failures to PostHog; return structured review payload`,

  655: `Extend import sheet (Sprint 2) with tabs:
- Paste (Sprint 1)
- Upload PDF
- Snap photo / screenshot

**Program PDF:** p.1 calendar grid + recipe pages with full kcal/macro panels + optional daily summaries + shopping list (ignored).

All inputs funnel into **same** parse → review → commit pipeline.`,

  656: `PDF adaptor (Sprint 2):
- Extract text (pdf.js client- or server-side)
- Pass plain text to existing LLM parse prompt
- Handle program PDF layout: grid page + recipe pages with nutrition panels
- Flag low confidence when ingredient weights missing
- Best-effort multi-column / merged cells`,

  657: `Image vision adaptor (Sprint 2):
- Trainer screenshots / single recipe pages → vision model → same structured JSON
- Expect 50–70% confidence on cropped images; review screen is safety net
- Full-week imports prefer PDF`,

  658: `Maestro: Plan → Generate ▾ → Import → paste meal-prep fixture → review → commit → template in switcher.

Fixture: \`src/lib/planning/planImport/fixtures/mealPrepWeek1.ts\``,
};

async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

async function getIssue(apiKey, number) {
  const data = await linearRequest(
    apiKey,
    `query($n: Float!) {
      issues(filter: { number: { eq: $n }, team: { key: { eq: "ENG" } } }, first: 1) {
        nodes { id identifier title description }
      }
    }`,
    { n: number },
  );
  const issue = data.issues.nodes[0];
  if (!issue) throw new Error(`ENG-${number} not found`);
  return issue;
}

async function updateDescription(apiKey, number, description, dryRun) {
  const issue = await getIssue(apiKey, number);
  if (issue.description?.trim() === description.trim()) {
    console.log(`  OK ${issue.identifier} already up to date`);
    return;
  }
  if (dryRun) {
    console.log(`  Would update ${issue.identifier}: ${issue.title}`);
    return;
  }
  await linearRequest(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { identifier url } }
    }`,
    { id: issue.id, input: { description } },
  );
  console.log(`  Updated ${issue.identifier} → ${issue.url ?? ""}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing LINEAR_API_KEY");
    process.exit(1);
  }

  console.log(`\nUpdating Plan Import issues (${dryRun ? "dry run" : "live"})…\n`);
  for (const [num, desc] of Object.entries(UPDATES)) {
    await updateDescription(apiKey, Number(num), desc, dryRun);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
