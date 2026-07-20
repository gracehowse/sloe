import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260720075508_eng1535_remove_synthetic_creators.sql",
  ),
  "utf8",
);
const schema = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");

describe("ENG-1535 synthetic creator cleanup", () => {
  it("deletes every fixed synthetic creator id", () => {
    expect(migration).toContain("delete from public.creators");
    for (let suffix = 1; suffix <= 5; suffix += 1) {
      expect(migration).toContain(
        `a1000001-0001-4000-8000-00000000000${suffix}`,
      );
    }
  });

  it("relies on explicit safe foreign-key deletion behaviour", () => {
    expect(schema).toMatch(
      /creator_id uuid references public\.creators\(id\) on delete set null/,
    );
    expect(schema).toMatch(
      /creator_id uuid not null references public\.creators\(id\) on delete cascade/,
    );
  });
});
