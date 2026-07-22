import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, type UserConfig } from "vite";
import { rnw } from "vite-plugin-rnw";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(dirname, "../apps/mobile");
const stubsRoot = path.resolve(dirname, "./mobile-stubs");

const MOBILE_PATH_PREFIXES = ["/apps/mobile/", "\\apps\\mobile\\"];

function isMobileModule(importer: string | undefined): boolean {
  if (!importer) return false;
  return MOBILE_PATH_PREFIXES.some((prefix) => importer.includes(prefix));
}

function resolveMobileFile(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Vite config merged into the root Storybook build for RN-web mobile stories. */
export function mergeMobileStorybookVite(config: UserConfig): UserConfig {
  return mergeConfig(config, {
    plugins: [
      {
        name: "suppr-mobile-storybook-resolver",
        enforce: "pre",
        resolveId(source, importer) {
          if (!isMobileModule(importer)) return null;

          if (source === "@/context/theme") {
            return path.resolve(mobileRoot, "stories/_fixtures/storybook-theme.tsx");
          }
          if (source.startsWith("@/")) {
            return resolveMobileFile(path.resolve(mobileRoot, source.slice(2)));
          }
          if (source.startsWith("@suppr/shared/")) {
            return resolveMobileFile(
              path.resolve(dirname, "../src/lib", source.slice("@suppr/shared/".length)),
            );
          }
          if (source === "@suppr/nutrition-core") {
            return path.resolve(dirname, "../src/lib/nutrition-core/index.ts");
          }
          if (source.startsWith("@suppr/nutrition-core/")) {
            return resolveMobileFile(
              path.resolve(
                dirname,
                "../src/lib/nutrition-core",
                source.slice("@suppr/nutrition-core/".length),
              ),
            );
          }
          return null;
        },
      },
      rnw({
        jsxRuntime: "automatic",
        babel: {
          plugins: ["react-native-reanimated/plugin"],
        },
      }),
    ],
    resolve: {
      alias: {
        "expo-haptics": path.join(stubsRoot, "expo-haptics.ts"),
        "@react-native-async-storage/async-storage": path.join(stubsRoot, "async-storage.ts"),
      },
    },
    optimizeDeps: {
      include: ["react-native-web", "react-native-reanimated"],
    },
  });
}
