import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hashPassword } from "@/lib/crypto/password";

/**
 * All access to the `users` table lives in this module — no component or
 * route handler should call `env.DB` directly (see `.cursor/rules/d1.mdc`).
 */

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  /** Client-side SHA-256 digest of the plaintext password — never the plaintext. */
  passwordHash: string;
};

export type UpdateUserInput = Partial<{
  firstName: string;
  lastName: string;
  username: string;
  email: string;
}>;

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  createdAt: string;
};

export type UserRecord = PublicUser & {
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
};

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
};

export class DuplicateUserError extends Error {
  constructor(message = "Username or email is already taken") {
    super(message);
    this.name = "DuplicateUserError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    ...toPublicUser(row),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    updatedAt: row.updated_at,
  };
}

const RETURNING_COLUMNS =
  "id, first_name, last_name, username, email, password_hash, password_salt, created_at, updated_at";

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const { env } = await getCloudflareContext({ async: true });
  const { hash, salt } = await hashPassword(input.passwordHash);

  try {
    const { results } = await env.DB.prepare(
      `INSERT INTO users (first_name, last_name, username, email, password_hash, password_salt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       RETURNING ${RETURNING_COLUMNS}`
    )
      .bind(input.firstName, input.lastName, input.username, input.email, hash, salt)
      .all<UserRow>();

    const row = results[0];
    if (!row) {
      throw new Error("Insert did not return the created user");
    }
    return toPublicUser(row);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateUserError();
    }
    throw error;
  }
}

/** `identifier` may be either a username or an email. */
export async function getUserByIdentifier(identifier: string): Promise<UserRecord | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    "SELECT * FROM users WHERE username = ?1 OR email = ?1"
  )
    .bind(identifier)
    .all<UserRow>();

  const row = results[0];
  return row ? toUserRecord(row) : undefined;
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare("SELECT * FROM users WHERE id = ?1")
    .bind(id)
    .all<UserRow>();

  const row = results[0];
  return row ? toUserRecord(row) : undefined;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateUserInput, string> = {
  firstName: "first_name",
  lastName: "last_name",
  username: "username",
  email: "email",
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let placeholder = 1;

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [
    keyof UpdateUserInput,
    string,
  ][]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    setClauses.push(`${column} = ?${placeholder}`);
    values.push(value);
    placeholder += 1;
  }

  if (setClauses.length === 0) {
    const existing = await getUserById(id);
    if (!existing) {
      throw new Error("User not found");
    }
    return existing;
  }

  setClauses.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  const { env } = await getCloudflareContext({ async: true });

  try {
    const { results } = await env.DB.prepare(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?${placeholder} RETURNING ${RETURNING_COLUMNS}`
    )
      .bind(...values)
      .all<UserRow>();

    const row = results[0];
    if (!row) {
      throw new Error("User not found");
    }
    return toPublicUser(row);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateUserError();
    }
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).all();
}
