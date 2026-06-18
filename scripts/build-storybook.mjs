import { cp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const outputDir = resolve(root, "storybook-static");

await rm(outputDir, { recursive: true, force: true });

await new Promise((resolveBuild, rejectBuild) => {
  const child = spawn("npx", ["storybook", "build"], {
    cwd: root,
    env: {
      ...process.env,
      SUPPR_STORYBOOK_SKIP_STATIC_DIRS: "1",
    },
    stdio: "inherit",
  });
  child.on("error", rejectBuild);
  child.on("exit", (code, signal) => {
    if (code === 0) {
      resolveBuild();
      return;
    }
    rejectBuild(new Error(`storybook build failed with ${signal ?? `exit code ${code}`}`));
  });
});

await cp(resolve(root, "public"), outputDir, {
  recursive: true,
  force: true,
  errorOnExist: false,
});
