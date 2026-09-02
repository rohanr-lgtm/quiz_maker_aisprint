import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Schema-contract check for the mcqs/mcq_choices/mcq_attempts migration
// (Phase 1 of the mcq-crud PRD). This can't exercise real D1 execution --
// that's verified by hand with `wrangler d1 migrations apply --local` --
// but it proves the migration file exists and defines the schema this
// feature depends on before any code is written against it.

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function readMigrationsSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql"));
  return files.map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8")).join("\n");
}

describe("mcqs table migration", () => {
  it("creates the mcqs table", () => {
    expect(readMigrationsSql()).toMatch(/CREATE TABLE\s+mcqs/i);
  });

  it.each(["id", "name", "question", "created_by", "created_at", "updated_at"])(
    "defines the %s column on mcqs",
    (column) => {
      expect(readMigrationsSql()).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }
  );

  it("indexes mcqs by created_by", () => {
    expect(readMigrationsSql()).toMatch(
      /CREATE INDEX\s+\S+\s+ON\s+mcqs\s*\(\s*created_by\s*\)/i
    );
  });
});

describe("mcq_choices table migration", () => {
  it("creates the mcq_choices table", () => {
    expect(readMigrationsSql()).toMatch(/CREATE TABLE\s+mcq_choices/i);
  });

  it.each([
    "id",
    "mcq_id",
    "choice_text",
    "is_correct",
    "position",
    "created_at",
    "updated_at",
  ])("defines the %s column on mcq_choices", (column) => {
    expect(readMigrationsSql()).toMatch(new RegExp(`\\b${column}\\b`, "i"));
  });

  it("cascades delete from mcqs to mcq_choices", () => {
    expect(readMigrationsSql()).toMatch(
      /mcq_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });

  it("indexes mcq_choices by mcq_id", () => {
    expect(readMigrationsSql()).toMatch(
      /CREATE INDEX\s+\S+\s+ON\s+mcq_choices\s*\(\s*mcq_id\s*\)/i
    );
  });
});

describe("mcq_attempts table migration", () => {
  it("creates the mcq_attempts table", () => {
    expect(readMigrationsSql()).toMatch(/CREATE TABLE\s+mcq_attempts/i);
  });

  it.each([
    "id",
    "mcq_id",
    "choice_id",
    "attempted_by",
    "is_correct",
    "created_at",
  ])("defines the %s column on mcq_attempts", (column) => {
    expect(readMigrationsSql()).toMatch(new RegExp(`\\b${column}\\b`, "i"));
  });

  it("cascades delete from mcqs to mcq_attempts", () => {
    expect(readMigrationsSql()).toMatch(
      /mcq_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });

  it("cascades delete from mcq_choices to mcq_attempts", () => {
    expect(readMigrationsSql()).toMatch(
      /choice_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });

  it("indexes mcq_attempts by mcq_id", () => {
    expect(readMigrationsSql()).toMatch(
      /CREATE INDEX\s+\S+\s+ON\s+mcq_attempts\s*\(\s*mcq_id\s*\)/i
    );
  });

  it("indexes mcq_attempts by attempted_by", () => {
    expect(readMigrationsSql()).toMatch(
      /CREATE INDEX\s+\S+\s+ON\s+mcq_attempts\s*\(\s*attempted_by\s*\)/i
    );
  });
});
