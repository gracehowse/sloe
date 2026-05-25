#!/usr/bin/env node
/**
 * Creates Plan Import initiative projects + issues in Linear (idempotent by title).
 *
 * Prerequisites:
 *   export LINEAR_API_KEY='lin_api_...'   # or set in .env.local
 *
 * Run:
 *   node scripts/linear/create-plan-import-program.mjs
 *   node scripts/linear/create-plan-import-program.mjs --dry-run
 */

const LINEAR_GQL = "https://api.linear.app/graphql";

const INITIATIVE_NAME = "Plan Import";
const SPRINT1_PROJECT = "Plan Import — Sprint 1 (paste + auto-rebalance)";
const SPRINT2_PROJECT = "Plan Import — Sprint 2 (PDF + image)";
const SURFACE_PROJECT = "Plan tab"; // follow-up bugs live here + link to initiative

const ENG_TEAM_KEY = "ENG";

/** @param {string} apiKey */
async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data;
}

function findByName(nodes, name) {
  return nodes.find((n) => n.name === name);
}

const QUERIES = {
  teams: `query { teams(first: 20) { nodes { id key name } } }`,
  initiatives: `query { initiatives(first: 50) { nodes { id name url } } }`,
  projects: `query { projects(first: 250) { nodes { id name } } }`,
  issuesByProject: `
    query Issues($projectId: String!) {
      project(id: $projectId) {
        issues(first: 100) { nodes { id title identifier url } }
      }
    }
  `,
};

const PROJECT_CREATE = `
  mutation ProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project { id name url }
    }
  }
`;

const INITIATIVE_LINK = `
  mutation LinkInitiative($input: InitiativeToProjectCreateInput!) {
    initiativeToProjectCreate(input: $input) {
      success
      initiativeToProject { id }
    }
  }
`;

const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id title identifier url }
    }
  }
`;

function sprint1Issues(teamId, projectId) {
  return [
    {
      title: "Plan Import — program coordination",
      priority: 2,
      description: `Umbrella for Plan Import delivery. Links Sprint 1 + Sprint 2.

**Product decisions (locked)**
- Entry: **Plan tab only** — wholesale plan import, not Library (individual meals stay save-to-library + auto-gen as today).
- Commit: import creates a **new plan template**; user chooses whether to activate it (never silent replace).
- Plan name: **auto-parse from source** + always editable before commit.
- Trust: when source kcal ≠ Suppr calc, show **both** on review rows (source as "claimed", Suppr as primary).
- Auto-rebalance: scale protein-lean items first → carbs → fats; **never scale vegetables**.

**Repo doc:** \`docs/planning/plan-import-linear-program.md\``,
    },
    {
      title: "Plan: Generate dropdown — library vs import existing plan",
      priority: 2,
      description: `Replace single **Regenerate** chip with **Generate ▾** dropdown:
- Generate from library (current behaviour)
- Import existing plan → opens import sheet

Chip row: Plan tab setup area. Mobile first; web parity if Plan setup exists on web.`,
    },
    {
      title: "Plan import: paste sheet + plan name field",
      priority: 2,
      description: `Bottom sheet:
- Multiline paste: "Paste your meal plan. Suppr will figure out the rest."
- Plan name field (pre-filled from parse when possible; user can edit)
- Primary CTA → parse pipeline`,
    },
    {
      title: "Plan import: LLM parse → structured plan JSON schema",
      priority: 2,
      description: `Single parse pipeline output (used by paste, PDF text, vision):

\`\`\`json
{
  "planName": "string | null",
  "days": [{
    "label": "Day 1",
    "meals": [{
      "slot": "lunch",
      "title": "Chicken & rice bowl",
      "claimedKcal": 580,
      "portionHint": "optional"
    }]
  }]
}
\`\`\`

Include confidence per meal (high/medium/low). Handle vague portions gracefully.`,
    },
    {
      title: "Plan import: review screen (editable rows + dual kcal trust)",
      priority: 2,
      description: `Per-day, per-meal list:
- Day · slot · title · Suppr kcal (primary) · confidence chip
- If source claimed kcal present: show **as claimed** secondary
- Inline edit: title, portion, kcal override before commit`,
    },
    {
      title: "Plan import: assessment panel (avg vs target + 3 actions)",
      priority: 2,
      description: `Above review list:
- "Plan averages X kcal/day · Your target Y · ±Z"
- Actions: **Use as-is** | **Auto-rebalance to my targets** | **Save meals only** (no plan slots)

Auto-rebalance rules: protein-first scaling, then carbs, then fats; never vegetables.`,
    },
    {
      title: "Plan import: commit as template + optional activate",
      priority: 2,
      description: `On confirm:
1. Save each meal as Library recipe tagged \`Imported · {plan name}\`
2. Create **plan template** from parsed structure (do not replace active plan unless user chose activate)
3. Template switcher: user can switch between templates like existing plan templates

If user has active plan: prompt **Activate imported plan?** (default: keep current; imported saved as inactive template).`,
    },
    {
      title: "Library: Imported plans filter chip",
      priority: 3,
      description: `Filter chip \`Imported · {plan name}\` (or "Imported plans") so users can find/clean up meals from imports. Prevents library graveyard anxiety.`,
    },
    {
      title: "Plan import: API route + auth + rate limit",
      priority: 2,
      description: `Server route for parse + rebalance (Vercel AI / gateway). Auth required. Basic rate limit per user. Log parse failures to PostHog.`,
    },
  ].map((i) => ({ ...i, teamId, projectId }));
}

function sprint2Issues(teamId, projectId) {
  return [
    {
      title: "Plan import: multi-source input sheet (paste / PDF / photo)",
      priority: 2,
      description: `Extend import sheet with tabs or segmented control:
- Paste (Sprint 1)
- Upload PDF
- Snap photo / screenshot

All inputs funnel into **same** structured JSON → same review screen.`,
    },
    {
      title: "Plan import: PDF text extract adaptor (pdf.js → parse pipeline)",
      priority: 2,
      description: `Extract text from uploaded PDF client- or server-side, pass plain text to existing LLM parse prompt. Handle multi-column / merged cells best-effort; flag low confidence in review.`,
    },
    {
      title: "Plan import: image vision adaptor (Sonnet vision → parse pipeline)",
      priority: 2,
      description: `Trainer screenshots / photos → vision model → same structured plan JSON. Expect 50–70% confidence on cropped/compressed images; review screen is the safety net.`,
    },
    {
      title: "Plan import: E2E + Maestro — paste happy path",
      priority: 3,
      description: `Maestro: Plan → Import → paste sample plan → review → commit → template visible in switcher. Seed or fixture plan text in repo.`,
    },
  ].map((i) => ({ ...i, teamId, projectId }));
}

function followUpIssues(teamId, projectId, initiativeId) {
  return [
    {
      title: "Plan: show day P/C/F/Fi chips before regenerate (planTargets load race)",
      priority: 2,
      description: `**Bug:** Per-day P · C · F · Fi chips in \`planner.tsx\` (~2608) only render when \`planTargets\` is loaded. On fresh Plan entry, \`planTargets\` is null until DB fetch completes — looks like macros only appear after Regenerate.

**Fix:** Show chips with skeleton or defer gating until targets fetch settles (empty state ≠ hidden).`,
    },
    {
      title: "Plan: fibre day total near-zero (seed data + fiberG field)",
      priority: 3,
      description: `**Bug:** Daily fibre sums \`meal.fiberG ?? 0\` but seed recipes lack fibre from OFF/FatSecret (often 0 for processed foods). Per-meal fibre targets (~daily/4) then always miss.

**Fix options:** (a) backfill fibre on seed/import recipes where possible; (b) document as data-source limitation in UI; (c) verify \`meal.fiber_g\` vs \`meal.micros.fiberG\` mapping.`,
    },
  ].map((i) => ({
    ...i,
    teamId,
    projectId,
    description:
      i.description +
      `\n\n**Initiative:** Plan Import (follow-up from import work; ship independently.)`,
  }));
}

async function ensureProject(apiKey, { name, teamId, initiativeId, targetDate, description, dryRun }) {
  const projects = (await linearRequest(apiKey, QUERIES.projects, undefined)).projects.nodes;
  const existing = findByName(projects, name);
  if (existing) {
    console.log(`Project exists: ${name} (${existing.id})`);
    return existing;
  }
  const input = {
    name,
    teamIds: [teamId],
    targetDate,
    description,
    priority: 2,
  };
  if (dryRun) {
    console.log(`Would create project: ${name}`);
    return { id: "dry-run", name };
  }
  const data = await linearRequest(apiKey, PROJECT_CREATE, { input });
  const p = data.projectCreate.project;
  await linearRequest(apiKey, INITIATIVE_LINK, {
    input: { initiativeId, projectId: p.id },
  });
  console.log(`Created project: ${p.name} → ${p.url}`);
  return p;
}

async function listProjectIssues(apiKey, projectId) {
  if (projectId === "dry-run") return [];
  const data = await linearRequest(apiKey, QUERIES.issuesByProject, { projectId });
  return data.project?.issues?.nodes ?? [];
}

async function ensureIssue(apiKey, issue, existingTitles, dryRun, parentId) {
  if (existingTitles.has(issue.title)) {
    console.log(`  Skip (exists): ${issue.title}`);
    return null;
  }
  const input = {
    teamId: issue.teamId,
    title: issue.title,
    description: issue.description,
    projectId: issue.projectId,
    priority: issue.priority ?? 3,
    ...(parentId ? { parentId } : {}),
  };
  if (dryRun) {
    console.log(`  Would create: ${issue.title}`);
    return null;
  }
  const data = await linearRequest(apiKey, ISSUE_CREATE, { input });
  const created = data.issueCreate.issue;
  existingTitles.add(issue.title);
  console.log(`  Created: ${created.identifier} ${created.title} → ${created.url}`);
  return created;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing LINEAR_API_KEY. Export from Linear Settings → API, or add to .env.local",
    );
    process.exit(1);
  }

  const teams = (await linearRequest(apiKey, QUERIES.teams, undefined)).teams.nodes;
  const eng = teams.find((t) => t.key === ENG_TEAM_KEY);
  if (!eng) throw new Error(`Team ${ENG_TEAM_KEY} not found`);

  const initiatives = (await linearRequest(apiKey, QUERIES.initiatives, undefined)).initiatives
    .nodes;
  const initiative = findByName(initiatives, INITIATIVE_NAME);
  if (!initiative) {
    throw new Error(
      `Initiative "${INITIATIVE_NAME}" not found. Create it in Linear first or check name.`,
    );
  }
  console.log(`Initiative: ${initiative.name} → ${initiative.url}\n`);

  const sprint1Desc = `Paste-text import + LLM parse + review + auto-rebalance + commit as plan template. ~2 weeks.`;
  const sprint2Desc = `PDF upload + image/screenshot vision adaptors into same review/commit pipeline. ~3 weeks.`;

  const sprint1 = await ensureProject(apiKey, {
    name: SPRINT1_PROJECT,
    teamId: eng.id,
    initiativeId: initiative.id,
    targetDate: "2026-07-01",
    description: sprint1Desc,
    dryRun,
  });

  const sprint2 = await ensureProject(apiKey, {
    name: SPRINT2_PROJECT,
    teamId: eng.id,
    initiativeId: initiative.id,
    targetDate: "2026-07-15",
    description: sprint2Desc,
    dryRun,
  });

  const projects = (await linearRequest(apiKey, QUERIES.projects, undefined)).projects.nodes;
  const planTab = findByName(projects, SURFACE_PROJECT);

  const sprint1IssuesList = await listProjectIssues(apiKey, sprint1.id);
  const sprint1Titles = new Set(sprint1IssuesList.map((i) => i.title));

  console.log(`\n${SPRINT1_PROJECT} issues:`);
  const allS1 = sprint1Issues(eng.id, sprint1.id);
  const coord = allS1[0];
  const coordIssue = await ensureIssue(apiKey, coord, sprint1Titles, dryRun);
  const parentId = coordIssue?.id ?? sprint1IssuesList.find((i) => i.title === coord.title)?.id;

  for (const issue of allS1.slice(1)) {
    await ensureIssue(apiKey, issue, sprint1Titles, dryRun, parentId);
  }

  const sprint2IssuesList = await listProjectIssues(apiKey, sprint2.id);
  const sprint2Titles = new Set(sprint2IssuesList.map((i) => i.title));
  console.log(`\n${SPRINT2_PROJECT} issues:`);
  for (const issue of sprint2Issues(eng.id, sprint2.id)) {
    await ensureIssue(apiKey, issue, sprint2Titles, dryRun, parentId);
  }

  if (planTab) {
    const planIssues = await listProjectIssues(apiKey, planTab.id);
    const planTitles = new Set(planIssues.map((i) => i.title));
    console.log(`\n${SURFACE_PROJECT} follow-ups:`);
    for (const issue of followUpIssues(eng.id, planTab.id, initiative.id)) {
      await ensureIssue(apiKey, issue, planTitles, dryRun);
    }
  } else {
    console.warn(`\nWarn: project "${SURFACE_PROJECT}" not found — skipping Plan macro/fibre follow-ups`);
  }

  console.log(
    dryRun
      ? "\nDry run complete."
      : "\nDone. Update docs/planning/plan-import-linear-program.md with new ENG-### links.",
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
