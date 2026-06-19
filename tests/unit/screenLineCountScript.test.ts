import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), "scripts/check-screen-line-count.mjs");

async function git(cwd: string, args: string[]) {
  await execFileAsync("git", args, { cwd });
}

describe("check-screen-line-count", () => {
  it("fails when a newly tracked screen file crosses the line limit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "screen-ratchet-"));
    await mkdir(join(dir, "apps/mobile/app"), { recursive: true });
    await writeFile(join(dir, "apps/mobile/app/too-large.tsx"), Array.from({ length: 6 }, (_, i) => `export const L${i} = ${i};`).join("\n") + "\n");
    await writeFile(join(dir, "allowlist.json"), "{}\n");
    await git(dir, ["init"]);
    await git(dir, ["add", "."]);

    await expect(
      execFileAsync(process.execPath, [scriptPath], {
        cwd: dir,
        env: {
          ...process.env,
          SCREEN_LINE_COUNT_LIMIT: "5",
          SCREEN_LINE_COUNT_ROOTS: "apps/mobile/app",
          SCREEN_LINE_COUNT_ALLOWLIST: "allowlist.json",
        },
      }),
    ).rejects.toMatchObject({ code: 1 });
  });
});
