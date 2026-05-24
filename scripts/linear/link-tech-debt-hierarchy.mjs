#!/usr/bin/env node
/**
 * Links ENG-665 as coordination parent:
 *   ENG-665 → ENG-573 (P5 umbrella) → ENG-619, 620, 622 (unchanged)
 *   ENG-665 → ENG-661, 662, 663, 664 (TODO-derived tech debt)
 *
 * ENG-533 stays under ENG-523 (capture program); priority set separately.
 *
 * Run: node scripts/linear/link-tech-debt-hierarchy.mjs [--dry-run]
 */

const LINEAR_GQL = "https://api.linear.app/graphql";

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
        nodes { id identifier title parent { identifier } }
      }
    }`,
    { n: number },
  );
  const issue = data.issues.nodes[0];
  if (!issue) throw new Error(`ENG-${number} not found`);
  return issue;
}

async function setParent(apiKey, childNumber, parentNumber, dryRun) {
  const child = await getIssue(apiKey, childNumber);
  const parent = await getIssue(apiKey, parentNumber);
  if (child.parent?.identifier === parent.identifier) {
    console.log(`  OK ${child.identifier} already under ${parent.identifier}`);
    return;
  }
  if (dryRun) {
    console.log(`  Would set ${child.identifier} parent → ${parent.identifier}`);
    return;
  }
  await linearRequest(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { identifier parent { identifier } } }
    }`,
    { id: child.id, input: { parentId: parent.id } },
  );
  console.log(`  Linked ${child.identifier} → ${parent.identifier}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing LINEAR_API_KEY");
    process.exit(1);
  }

  console.log("\n=== ENG-665 coordination hierarchy ===\n");

  // P5 stack under coordination issue
  await setParent(apiKey, 573, 665, dryRun);

  // TODO-derived issues (direct children of 665)
  for (const n of [661, 662, 663, 664]) {
    await setParent(apiKey, n, 665, dryRun);
  }

  console.log(
    dryRun
      ? "\nDry run complete."
      : "\nDone. ENG-619/620/622 remain under ENG-573; ENG-533 unchanged (ENG-523).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
