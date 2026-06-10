/**
 * greetingNameMetadata — pins the shared name-extraction the Today
 * greeting uses on BOTH platforms.
 *
 * `firstNameFromMetadata` (in `src/lib/copy/today.ts`) reads the
 * display name out of a Supabase auth user's `user_metadata` and
 * returns its first token. The "Your name" Settings field on web
 * (`src/app/components/Settings.tsx`) and mobile
 * (`apps/mobile/components/settings/SettingsBundleContent.tsx`) write
 * `user_metadata.full_name` via `supabase.auth.updateUser`; this helper
 * is what turns that stored value into "Morning, Grace".
 *
 * What this test protects:
 *   - Precedence order across the four accepted metadata keys.
 *   - First-token extraction ("Grace Turner" → "Grace").
 *   - Empty / whitespace / missing metadata → `undefined`, so the
 *     greeting falls back to the name-free "Good morning".
 *   - The helper output feeds `todayGreeting` cleanly (the
 *     clear-the-name path produces the un-personalised greeting).
 */

import { describe, it, expect } from "vitest";

import {
  GREETING_NAME_METADATA_KEYS,
  firstNameFromMetadata,
  todayGreeting,
} from "../../src/lib/copy/today";

describe("firstNameFromMetadata", () => {
  it("reads full_name first and returns the first token", () => {
    expect(firstNameFromMetadata({ full_name: "Grace Turner" })).toBe("Grace");
  });

  it("trims surrounding whitespace before tokenising", () => {
    expect(firstNameFromMetadata({ full_name: "  Grace   Turner  " })).toBe(
      "Grace",
    );
  });

  it("honours the documented precedence order", () => {
    // full_name wins over the others.
    expect(
      firstNameFromMetadata({
        full_name: "Ada Lovelace",
        name: "Charles",
        first_name: "Babbage",
        preferred_name: "Countess",
      }),
    ).toBe("Ada");
    // name is used when full_name is absent/blank.
    expect(
      firstNameFromMetadata({ full_name: "  ", name: "Charles Babbage" }),
    ).toBe("Charles");
    // first_name is the next fallback.
    expect(firstNameFromMetadata({ first_name: "Babbage" })).toBe("Babbage");
    // preferred_name is the last resort.
    expect(firstNameFromMetadata({ preferred_name: "Countess Lovelace" })).toBe(
      "Countess",
    );
  });

  it("returns undefined for empty / whitespace / missing names", () => {
    expect(firstNameFromMetadata({ full_name: "" })).toBeUndefined();
    expect(firstNameFromMetadata({ full_name: "   " })).toBeUndefined();
    expect(firstNameFromMetadata({})).toBeUndefined();
    expect(firstNameFromMetadata(null)).toBeUndefined();
    expect(firstNameFromMetadata(undefined)).toBeUndefined();
  });

  it("ignores non-string metadata values", () => {
    expect(
      firstNameFromMetadata({ full_name: 42 as unknown as string }),
    ).toBeUndefined();
    expect(
      firstNameFromMetadata({
        full_name: null as unknown as string,
        name: "Grace",
      }),
    ).toBe("Grace");
  });

  it("exposes the precedence keys for callers that pre-fill the field", () => {
    expect(GREETING_NAME_METADATA_KEYS).toEqual([
      "full_name",
      "name",
      "first_name",
      "preferred_name",
    ]);
  });

  it("feeds todayGreeting: a name personalises, clearing falls back", () => {
    const named = firstNameFromMetadata({ full_name: "Grace Turner" });
    expect(todayGreeting(9, named)).toBe("Morning, Grace");

    // Cleared name → undefined → name-free greeting.
    const cleared = firstNameFromMetadata({ full_name: "   " });
    expect(todayGreeting(9, cleared)).toBe("Good morning");
  });
});
