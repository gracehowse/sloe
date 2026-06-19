#!/usr/bin/env node
/**
 * Post Linear project + initiative status updates (narrative rollups).
 *
 * Linear's initiative overview shows "projects requiring updates" when child
 * projects have no `lastUpdate` — distinct from project lifecycle state
 * (Backlog/In Progress/Completed). See sync-project-and-initiative-status.mjs
 * for lifecycle rollups.
 *
 * Usage:
 *   node scripts/linear/sync-status-updates.mjs
 *   node scripts/linear/sync-status-updates.mjs --dry-run
 *   node scripts/linear/sync-status-updates.mjs --project "Today tab"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LINEAR_GQL = "https://api.linear.app/graphql";
const TERMINAL_ISSUE_TYPES = new Set(["completed", "canceled", "duplicate"]);

function loadApiKey() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    const m = raw.match(/^LINEAR_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  return process.env.LINEAR_API_KEY?.trim();
}

async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

const PROJECTS = `
  query Projects($after: String) {
    projects(first: 50, after: $after) {
      nodes {
        id
        name
        status { name type }
        lastUpdate { createdAt }
        initiatives { nodes { id name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PROJECT_ISSUES = `
  query ProjectIssues($projectId: ID!, $after: String) {
    issues(filter: { project: { id: { eq: $projectId } } }, first: 100, after: $after) {
      nodes {
        state { type }
        labels { nodes { name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PROJECT_UPDATE_CREATE = `
  mutation ProjectUpdateCreate($input: ProjectUpdateCreateInput!) {
    projectUpdateCreate(input: $input) {
      success
      projectUpdate { id }
    }
  }
`;

const INITIATIVES = `
  query Initiatives {
    initiatives(first: 50) {
      nodes { id name status lastUpdate { createdAt } }
    }
  }
`;

const INITIATIVE_DETAIL = `
  query InitiativeDetail($id: String!) {
    initiative(id: $id) {
      id
      name
      status
      lastUpdate { createdAt }
      projects { nodes { id name status { name type } lastUpdate { createdAt } } }
    }
  }
`;

const INITIATIVE_UPDATE_CREATE = `
  mutation InitiativeUpdateCreate($input: InitiativeUpdateCreateInput!) {
    initiativeUpdateCreate(input: $input) {
      success
      initiativeUpdate { id }
    }
  }
`;

async function fetchAllProjects(apiKey) {
  const projects = [];
  let after = null;
  for (;;) {
    const data = await linearRequest(apiKey, PROJECTS, { after });
    projects.push(...data.projects.nodes);
    if (!data.projects.pageInfo.hasNextPage) break;
    after = data.projects.pageInfo.endCursor;
  }
  return projects;
}

async function fetchProjectIssueStats(apiKey, projectId) {
  const issues = [];
  let after = null;
  for (;;) {
    const data = await linearRequest(apiKey, PROJECT_ISSUES, { projectId, after });
    issues.push(...data.issues.nodes);
    if (!data.issues.pageInfo.hasNextPage) break;
    after = data.issues.pageInfo.endCursor;
  }
  const done = issues.filter((i) => i.state.type === "completed").length;
  const open = issues.filter((i) => !TERMINAL_ISSUE_TYPES.has(i.state.type));
  const blockers = open.filter((i) =>
    i.labels?.nodes?.some((l) => l.name === "launch-blocker"),
  ).length;
  return { done, total: issues.length, open: open.length, blockers };
}

function deriveHealth({ open, blockers, statusType }) {
  if (statusType === "completed" || statusType === "canceled") return "onTrack";
  if (blockers > 0) return "atRisk";
  if (open === 0) return "onTrack";
  return "onTrack";
}

function projectUpdateBody({ name, statusName, done, total, open, blockers }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const lines = [
    `**${name}** — ${statusName} · ${done}/${total} issues Done (${pct}%).`,
    open > 0 ? `${open} open` + (blockers > 0 ? ` (${blockers} launch-blocker)` : "") + "." : "All issues terminal.",
    "",
    "_Auto status sync — `npm run linear:sync-status-updates`._",
  ];
  return lines.join("\n");
}

function initiativeUpdateBody(initiative, projectSummaries) {
  const active = projectSummaries.filter(
    (p) => !["completed", "canceled"].includes(p.statusType),
  );
  const lines = [
    `## ${initiative.name}`,
    "",
    ...active.map(
      (p) =>
        `- **${p.name}** (${p.statusName}) — ${p.done}/${p.total} Done, ${p.open} open` +
        (p.blockers > 0 ? ` · ${p.blockers} launch-blocker` : ""),
    ),
    "",
    active.some((p) => p.blockers > 0)
      ? "**Health:** atRisk — launch-blocker issues still open in child projects."
      : "**Health:** onTrack — child project updates posted; work proceeding.",
    "",
    "_Auto rollup — `npm run linear:sync-status-updates`._",
  ];
  return lines.join("\n");
}

const dryRun = process.argv.includes("--dry-run");
const projectFilter = (() => {
  const idx = process.argv.indexOf("--project");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();
const force = process.argv.includes("--force");

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("LINEAR_API_KEY missing — set in .env.local or env");
  process.exit(1);
}

let projects = await fetchAllProjects(apiKey);
if (projectFilter) {
  projects = projects.filter((p) => p.name === projectFilter || p.id === projectFilter);
}

const projectSummaries = new Map();
/** Initiative IDs whose child projects received an update this run — always refresh rollup. */
const initiativesTouched = new Set();

for (const project of projects) {
  const statusType = project.status?.type;
  if (statusType === "completed" || statusType === "canceled") continue;
  if (!force && project.lastUpdate) continue;

  const stats = await fetchProjectIssueStats(apiKey, project.id);
  const summary = {
    id: project.id,
    name: project.name,
    statusName: project.status?.name ?? "Unknown",
    statusType,
    initiatives: project.initiatives?.nodes ?? [],
    ...stats,
  };
  projectSummaries.set(project.id, summary);

  const health = deriveHealth({ ...stats, statusType });
  const body = projectUpdateBody({ name: project.name, statusName: summary.statusName, ...stats });

  console.log(`Project update: ${project.name} → ${health} (${stats.done}/${stats.total})`);
  if (!dryRun) {
    await linearRequest(apiKey, PROJECT_UPDATE_CREATE, {
      input: { projectId: project.id, body, health },
    });
    for (const ini of summary.initiatives) initiativesTouched.add(ini.id);
  }
}

const initiativeList = (await linearRequest(apiKey, INITIATIVES)).initiatives.nodes;

for (const ini of initiativeList) {
  const initiative = (await linearRequest(apiKey, INITIATIVE_DETAIL, { id: ini.id })).initiative;
  if (initiative.status === "Completed") continue;

  const childProjects = initiative.projects.nodes.filter(
    (p) => !["completed", "canceled"].includes(p.status?.type),
  );
  if (childProjects.length === 0) continue;

  const needsInitiativeUpdate =
    force ||
    initiativesTouched.has(initiative.id) ||
    !initiative.lastUpdate ||
    childProjects.some((p) => !p.lastUpdate);
  if (!needsInitiativeUpdate) continue;

  const summaries = [];
  for (const child of childProjects) {
    let summary = projectSummaries.get(child.id);
    if (!summary) {
      const stats = await fetchProjectIssueStats(apiKey, child.id);
      summary = {
        id: child.id,
        name: child.name,
        statusName: child.status?.name ?? "Unknown",
        statusType: child.status?.type,
        ...stats,
      };
    }
    summaries.push(summary);
  }

  const hasBlockers = summaries.some((s) => s.blockers > 0);
  const health = hasBlockers ? "atRisk" : "onTrack";
  const body = initiativeUpdateBody(initiative, summaries);

  console.log(`Initiative update: ${initiative.name} → ${health} (${summaries.length} active projects)`);
  if (!dryRun) {
    await linearRequest(apiKey, INITIATIVE_UPDATE_CREATE, {
      input: { initiativeId: initiative.id, body, health },
    });
  }
}

console.log(dryRun ? "\nDry run complete." : "\nStatus updates posted.");
