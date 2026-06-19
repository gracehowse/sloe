#!/usr/bin/env node
/**
 * Roll up Linear project + initiative lifecycle fields from child issue states.
 *
 * Linear does NOT auto-update project status when issues close — see
 * https://linear.app/docs/project-status
 *
 * Usage:
 *   node scripts/linear/sync-project-and-initiative-status.mjs
 *   node scripts/linear/sync-project-and-initiative-status.mjs --dry-run
 *   node scripts/linear/sync-project-and-initiative-status.mjs --project "Redesign P0 — Foundations & design-system tokens"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LINEAR_GQL = "https://api.linear.app/graphql";

/** Never auto-complete these — they are permanent homes for ongoing work. */
const ONGOING_INITIATIVES = new Set([
  "Surface polish",
  "Platform foundations",
]);

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

const PROJECT_STATUSES = `
  query {
    projectStatuses {
      nodes { id name type }
    }
  }
`;

const PROJECTS = `
  query Projects($after: String) {
    projects(first: 50, after: $after) {
      nodes {
        id
        name
        status { id name type }
        initiatives { nodes { id name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PROJECT_ISSUES = `
  query ProjectIssues($projectId: ID!, $after: String) {
    issues(filter: { project: { id: { eq: $projectId } } }, first: 100, after: $after) {
      nodes { id identifier state { name type } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PROJECT_UPDATE = `
  mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
    projectUpdate(id: $id, input: $input) {
      success
      project { name status { name type } }
    }
  }
`;

const INITIATIVES = `
  query Initiatives {
    initiatives(first: 50) {
      nodes {
        id
        name
        status
        projects { nodes { id name status { name type } } }
      }
    }
  }
`;

const INITIATIVE_UPDATE = `
  mutation InitiativeUpdate($id: String!, $input: InitiativeUpdateInput!) {
    initiativeUpdate(id: $id, input: $input) {
      success
      initiative { name status }
    }
  }
`;

function statusByType(statusNodes, type) {
  const hit = statusNodes.find((s) => s.type === type);
  if (!hit) throw new Error(`No project status with type "${type}"`);
  return hit;
}

function statusByName(statusNodes, name) {
  const hit = statusNodes.find((s) => s.name === name);
  if (!hit) throw new Error(`No project status named "${name}"`);
  return hit;
}

/** Issue workflow types that do not block project completion. */
const TERMINAL_ISSUE_TYPES = new Set(["completed", "canceled", "duplicate"]);

/**
 * @param {{ state: { type: string } }[]} issues
 * @returns {"backlog" | "planned" | "started" | "completed" | "canceled" | "empty"}
 */
function deriveProjectStatusType(issues) {
  if (issues.length === 0) return "empty";

  const types = issues.map((i) => i.state.type);
  const activeTypes = types.filter((t) => !TERMINAL_ISSUE_TYPES.has(t));

  if (activeTypes.length === 0) {
    const meaningful = types.filter((t) => t !== "duplicate");
    if (meaningful.length === 0 || meaningful.every((t) => t === "canceled")) {
      return "canceled";
    }
    return "completed";
  }

  // Linear never rolls project state up — partial completion still shows Backlog unless we infer it.
  if (types.some((t) => t === "started") || types.some((t) => t === "completed")) {
    return "started";
  }

  if (types.some((t) => t === "unstarted")) return "planned";
  return "backlog";
}

async function fetchAllProjectIssues(apiKey, projectId) {
  const issues = [];
  let after = null;
  for (;;) {
    const data = await linearRequest(apiKey, PROJECT_ISSUES, { projectId, after });
    issues.push(...data.issues.nodes);
    if (!data.issues.pageInfo.hasNextPage) break;
    after = data.issues.pageInfo.endCursor;
  }
  return issues;
}

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

function deriveInitiativeStatus(initiative) {
  const projects = initiative.projects.nodes;
  if (projects.length === 0) return null;

  const projectTypes = projects.map((p) => p.status?.type).filter(Boolean);
  if (projectTypes.length === 0) return null;

  const allCompleted = projectTypes.every((t) => t === "completed" || t === "canceled");
  if (allCompleted && !projectTypes.every((t) => t === "canceled")) {
    return "Completed";
  }
  if (projectTypes.some((t) => t === "started")) return "Active";
  if (projectTypes.some((t) => t === "planned")) return "Active";
  return "Planned";
}

/** Linear project status type ordering for promote-only rollups. */
const TYPE_RANK = { backlog: 0, planned: 1, started: 2, completed: 3, canceled: 3 };

function shouldApplyProjectChange(currentType, derived) {
  if (!allowDowngrade && currentType === "completed") return false;
  if (!allowDowngrade && currentType === "canceled") return false;
  if (!allowDowngrade && (TYPE_RANK[currentType] ?? 0) > (TYPE_RANK[derived] ?? 0)) return false;
  return currentType !== derived;
}

function shouldApplyInitiativeChange(current, target) {
  if (!allowDowngrade && current === "Completed") return false;
  if (!allowDowngrade && current === "Active" && target === "Planned") return false;
  return current !== target;
}

const dryRun = process.argv.includes("--dry-run");
const allowDowngrade = process.argv.includes("--allow-downgrade");
const projectFilter = (() => {
  const idx = process.argv.indexOf("--project");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("LINEAR_API_KEY missing — set in .env.local or env");
  process.exit(1);
}

const statusNodes = (await linearRequest(apiKey, PROJECT_STATUSES)).projectStatuses.nodes;
const statusMap = {
  backlog: statusByType(statusNodes, "backlog"),
  planned: statusByType(statusNodes, "planned"),
  started: statusByName(statusNodes, "In Progress"),
  completed: statusByType(statusNodes, "completed"),
  canceled: statusByType(statusNodes, "canceled"),
};

let projects = await fetchAllProjects(apiKey);
if (projectFilter) {
  projects = projects.filter((p) => p.name === projectFilter || p.id === projectFilter);
  if (projects.length === 0) {
    console.error(`Project not found: ${projectFilter}`);
    process.exit(1);
  }
}

const projectChanges = [];

for (const project of projects) {
  const issues = await fetchAllProjectIssues(apiKey, project.id);
  const derived = deriveProjectStatusType(issues);
  if (derived === "empty") continue;

  const target = statusMap[derived];
  const currentType = project.status?.type;
  if (!shouldApplyProjectChange(currentType, derived)) continue;

  projectChanges.push({
    project,
    issues,
    derived,
    target,
    from: project.status?.name ?? "(none)",
    to: target.name,
  });
}

console.log(`\nProject rollup${dryRun ? " (dry-run)" : ""}: ${projectChanges.length} change(s)\n`);

for (const change of projectChanges) {
  const { project, issues, derived, target, from, to } = change;
  const done = issues.filter((i) => i.state.type === "completed").length;
  const open = issues.length - done - issues.filter((i) => i.state.type === "canceled").length;
  console.log(
    `- ${project.name}: ${from} → ${to} (${done}/${issues.length} done${open ? `, ${open} open` : ""})`,
  );

  if (!dryRun) {
    await linearRequest(apiKey, PROJECT_UPDATE, {
      id: project.id,
      input: { statusId: target.id },
    });
  }
}

const initiatives = (await linearRequest(apiKey, INITIATIVES)).initiatives.nodes;
const initiativeChanges = [];

for (const initiative of initiatives) {
  if (ONGOING_INITIATIVES.has(initiative.name)) continue;

  const target = deriveInitiativeStatus(initiative);
  if (!target || !shouldApplyInitiativeChange(initiative.status, target)) continue;

  initiativeChanges.push({ initiative, from: initiative.status, to: target });
}

console.log(`\nInitiative rollup${dryRun ? " (dry-run)" : ""}: ${initiativeChanges.length} change(s)\n`);

for (const change of initiativeChanges) {
  const { initiative, from, to } = change;
  const projectsSummary = initiative.projects.nodes
    .map((p) => `${p.name} (${p.status?.name ?? "?"})`)
    .join("; ");
  console.log(`- ${initiative.name}: ${from} → ${to}`);
  console.log(`    projects: ${projectsSummary}`);

  if (!dryRun) {
    await linearRequest(apiKey, INITIATIVE_UPDATE, {
      id: initiative.id,
      input: { status: to },
    });
  }
}

if (projectChanges.length === 0 && initiativeChanges.length === 0) {
  console.log("All project and initiative statuses already match issue rollups.");
}
