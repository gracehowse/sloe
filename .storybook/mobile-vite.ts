import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, type UserConfig, type Plugin } from "vite";
import { rnw } from "vite-plugin-rnw";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..");
const mobileRoot = path.resolve(dirname, "../apps/mobile");
const stubsRoot = path.resolve(dirname, "./mobile-stubs");
const coverageStubs = path.resolve(dirname, "./stubs");

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

function turboModuleShim(): Plugin {
  return {
    name: "suppr-rn-turbo-module-shim",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes(`${path.sep}apps${path.sep}mobile${path.sep}`)) return null;
      if (!code.includes("TurboModuleRegistry")) return null;
      const next = code.replace(
        /import\s*\{([^}]*)\}\s*from\s*["']react-native["'];?/g,
        (full, specs: string) => {
          const parts = specs
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          const kept = parts.filter((p: string) => !/\bTurboModuleRegistry\b/.test(p));
          if (kept.length === parts.length) return full;
          const importLine =
            kept.length > 0 ? `import { ${kept.join(", ")} } from "react-native";` : "";
          return `${importLine}\nconst TurboModuleRegistry = { get: () => null, getEnforcing: () => null };`;
        },
      );
      return next === code ? null : next;
    },
  };
}

/** Vite config merged into the root Storybook build for RN-web mobile stories. */
export function mergeMobileStorybookVite(config: UserConfig): UserConfig {
  return mergeConfig(config, {
    plugins: [
      {
        name: "suppr-mobile-storybook-resolver",
        enforce: "pre",
        resolveId(source, importer) {
          if (source.startsWith("@suppr/storybook-stubs/")) {
            return resolveMobileFile(
              path.join(coverageStubs, source.slice("@suppr/storybook-stubs/".length)),
            );
          }

          // Package aliases are needed for both role + colocated mobile stories.
          if (source === "@suppr/nutrition-core") {
            return path.resolve(repoRoot, "src/lib/nutrition-core/index.ts");
          }
          if (source.startsWith("@suppr/nutrition-core/")) {
            return resolveMobileFile(
              path.resolve(
                repoRoot,
                "src/lib/nutrition-core",
                source.slice("@suppr/nutrition-core/".length),
              ),
            );
          }
          if (source.startsWith("@suppr/shared/")) {
            return resolveMobileFile(
              path.resolve(repoRoot, "src/lib", source.slice("@suppr/shared/".length)),
            );
          }

          if (!isMobileModule(importer)) return null;

          if (source === "@/context/theme") {
            const fixture = path.resolve(mobileRoot, "stories/_fixtures/storybook-theme.tsx");
            if (fs.existsSync(fixture)) return fixture;
            return path.join(coverageStubs, "mobile-theme.tsx");
          }
          if (source === "@/context/auth" || source.startsWith("@/context/auth")) {
            return path.join(coverageStubs, "mobile-auth.tsx");
          }
          if (source === "@/lib/analytics" || source.startsWith("@/lib/analytics")) {
            return path.join(coverageStubs, "analytics.ts");
          }
          if (source.startsWith("@/")) {
            const mobileHit = resolveMobileFile(path.resolve(mobileRoot, source.slice(2)));
            if (mobileHit) return mobileHit;
            return resolveMobileFile(path.resolve(repoRoot, "src", source.slice(2)));
          }
          return null;
        },
      },
      turboModuleShim(),
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
        "expo-router": path.join(coverageStubs, "expo-router.tsx"),
        "expo-keep-awake": path.join(coverageStubs, "expo-keep-awake.ts"),
        "expo-constants": path.join(coverageStubs, "expo-constants.ts"),
        "react-native-reanimated": path.join(coverageStubs, "reanimated.ts"),
        "@react-native-async-storage/async-storage": path.join(stubsRoot, "async-storage.ts"),
      },
    },
    define: {
      __DEV__: JSON.stringify(true),
      global: "globalThis",
    },
    optimizeDeps: {
      include: ["react-native-web", "react-native-reanimated"],
    },
  });
}
