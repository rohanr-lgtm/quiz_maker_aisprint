import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Schema-contract check for the users table migration (Phase 2 of the
// register-login-logout PRD). This can't exercise real D1 execution --
// that's verified by hand with `wrangler d1 migrations apply --local` --
// but it proves the migration file exists and defines the schema this
// feature depends on before any code is written against it.

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function readMigrationsSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql"));
  return files.map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8")).join("\n");
}

describe("users table migration", () => {
  it("creates the users table", () => {
    expect(readMigrationsSql()).toMatch(/CREATE TABLE\s+users/i);
  });

  it.each([
    "id",
    "first_name",
    "last_name",
    "username",
    "email",
    "password_hash",
    "password_salt",
    "created_at",
    "updated_at",
  ])("defines the %s column", (column) => {
    expect(readMigrationsSql()).toMatch(new RegExp(`\\b${column}\\b`, "i"));
  });

  it("enforces a unique index on username", () => {
    expect(readMigrationsSql()).toMatch(/CREATE UNIQUE INDEX\s+\S+\s+ON\s+users\s*\(\s*username\s*\)/i);
  });

  it("enforces a unique index on email", () => {
    expect(readMigrationsSql()).toMatch(/CREATE UNIQUE INDEX\s+\S+\s+ON\s+users\s*\(\s*email\s*\)/i);
  });
});
