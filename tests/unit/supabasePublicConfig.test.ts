/**
 * @vitest-environment node
 */
/**
 * supabasePublicUrl / supabasePublicAnonKey (web) — the shared resolver that
 * lets local/staging dev point the web Supabase clients at a non-prod project
 * via NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, while falling
 * back to the hard-coded prod project baked into `utils/supabase/info.tsx`.
 *
 * The contract that matters: behaviour is UNCHANGED (hard-coded prod values)
 * whenever the env vars are unset or blank — so prod + CI are unaffected — and
 * the env override wins (with a trailing slash trimmed off the URL) when set.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../utils/supabase/publicConfig.ts";
import { projectId, publicAnonKey } from "../../utils/supabase/info.tsx";

const FALLBACK_URL = `https://${projectId}.supabase.co`;

describe("supabase public config resolver (web)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the hard-coded prod project when env is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(supabasePublicUrl()).toBe(FALLBACK_URL);
    expect(supabasePublicAnonKey()).toBe(publicAnonKey);
  });

  it("prefers NEXT_PUBLIC_SUPABASE_URL / ANON_KEY when set (dev/staging override)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local-staging.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-anon-key");
    expect(supabasePublicUrl()).toBe("https://local-staging.supabase.co");
    expect(supabasePublicAnonKey()).toBe("local-anon-key");
  });

  it("trims a trailing slash off the env URL so client paths don't double up", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local-staging.supabase.co/");
    expect(supabasePublicUrl()).toBe("https://local-staging.supabase.co");
  });

  it("ignores a whitespace-only env value and uses the fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "   ");
    expect(supabasePublicUrl()).toBe(FALLBACK_URL);
  });
});
