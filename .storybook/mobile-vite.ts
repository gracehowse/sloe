import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, type UserConfig, type Plugin } from "vite";
import { rnw } from "vite-plugin-rnw";
import { projectId, publicAnonKey } from "../utils/supabase/info.tsx";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..");
const mobileRoot = path.resolve(dirname, "../apps/mobile");
const stubsRoot = path.resolve(dirname, "./mobile-stubs");
const coverageStubs = path.resolve(dirname, "./stubs");

const storybookSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
const storybookSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;

const MOBILE_PATH_PREFIXES = ["/apps/mobile/", "\\apps\\mobile\\"];

function isMobileModule(importer: string | undefined): boolean {
  if (!importer) return false;
  return MOBILE_PATH_PREFIXES.some((prefix) => importer.includes(prefix));
}

/** True when `source` resolves to the web or mobile Supabase browser client. */
function isSupabaseClientSource(source: string, importer: string | undefined): boolean {
  if (
    source === "@/lib/supabase" ||
    source === "@/lib/supabase/browserClient" ||
    source.includes("lib/supabase/browserClient")
  ) {
    return true;
  }
  if (/(?:^|[\\/])lib[\\/]supabase(?:\.(?:ts|tsx|js|mjs))?$/.test(source)) {
    return true;
  }
  // Relative imports like `./supabase` from apps/mobile/lib/authedFetch.ts
  if (
    importer &&
    (source === "./supabase" ||
      source === "./supabase.ts" ||
      source === "../lib/supabase" ||
      source === "../lib/supabase.ts")
  ) {
    const resolved = path.normalize(path.resolve(path.dirname(importer), source));
    if (/(?:^|[\\/])lib[\\/]supabase(?:\.(?:ts|tsx|js))?$/.test(resolved)) {
      return true;
    }
  }
  return false;
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

/**
 * Bulk-generated stories often reference `noop` without defining it.
 * ESM does not fall back to globals, so inject a local binding when missing.
 */
function storyNoopShim(): Plugin {
  return {
    name: "suppr-story-noop-shim",
    enforce: "pre",
    transform(code, id) {
      if (!/\.stories\.[cm]?[jt]sx?$/.test(id)) return null;
      if (!/\bnoop\b/.test(code)) return null;
      if (
        /(?:^|\n)\s*(?:import\s+\{[^}]*\bnoop\b|const\s+noop\b|function\s+noop\b|let\s+noop\b)/.test(
          code,
        )
      ) {
        return null;
      }
      return {
        code: `const noop = (..._args: unknown[]) => undefined;\n${code}`,
        map: null,
      };
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

          // Module-scope createBrowserClient / createClient("", "") throws in
          // Chromatic's extraction browser — stub every supabase client import.
          // Includes relative `./supabase` from apps/mobile/lib/authedFetch.ts.
          if (isSupabaseClientSource(source, importer)) {
            return path.join(coverageStubs, "supabase-browser-client.ts");
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
      storyNoopShim(),
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
        "expo-router": path.join(coverageStubs, "expo-router"),
        "expo-keep-awake": path.join(coverageStubs, "expo-keep-awake.ts"),
        "expo-constants": path.join(coverageStubs, "expo-constants.ts"),
        "expo-image": path.join(coverageStubs, "expo-image.tsx"),
        "expo-blur": path.join(coverageStubs, "expo-blur.tsx"),
        "expo-image-picker": path.join(coverageStubs, "expo-image-picker.ts"),
        "expo-camera": path.join(coverageStubs, "expo-camera.tsx"),
        "expo-web-browser": path.join(coverageStubs, "expo-web-browser.ts"),
        "expo-splash-screen": path.join(coverageStubs, "expo-splash-screen.ts"),
        "expo-apple-authentication": path.join(coverageStubs, "expo-apple-authentication.tsx"),
        "@expo/vector-icons": path.join(coverageStubs, "expo-vector-icons.tsx"),
        "posthog-react-native": path.join(coverageStubs, "posthog-react-native.tsx"),
        "@sentry/react-native": path.join(coverageStubs, "sentry-react-native.ts"),
        "@shopify/react-native-skia": path.join(coverageStubs, "react-native-skia.tsx"),
        "react-native-reanimated": path.join(coverageStubs, "reanimated"),
        "@react-native-async-storage/async-storage": path.join(stubsRoot, "async-storage.ts"),
        [path.resolve(mobileRoot, "lib/supabase.ts")]: path.join(
          coverageStubs,
          "supabase-browser-client.ts",
        ),
        [path.resolve(repoRoot, "src/lib/supabase/browserClient.ts")]: path.join(
          coverageStubs,
          "supabase-browser-client.ts",
        ),
      },
    },
    define: {
      __DEV__: JSON.stringify(true),
      global: "globalThis",
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(storybookSupabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(storybookSupabaseAnonKey),
    },
    optimizeDeps: {
      include: ["react-native-web", "react-native-reanimated"],
    },
  });
}
