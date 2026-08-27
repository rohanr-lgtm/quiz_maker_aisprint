import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn();
const mockBind = vi.fn<(...args: unknown[]) => { all: typeof mockAll }>(() => ({ all: mockAll }));
const mockPrepare = vi.fn<(sql: string) => { bind: typeof mockBind }>(() => ({ bind: mockBind }));
const mockDb = { prepare: mockPrepare };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: mockDb } })),
}));

const {
  createUser,
  getUserByIdentifier,
  getUserById,
  updateUser,
  deleteUser,
  DuplicateUserError,
} = await import("@/lib/services/user-service");

const validCreateInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
  email: "ada@example.com",
  passwordHash: "client-side-sha256-digest",
};

function userRow(overrides: Partial<Record<string, string>> = {}) {
  return {
    id: "user-1",
    first_name: "Ada",
    last_name: "Lovelace",
    username: "alovelace",
    email: "ada@example.com",
    password_hash: "server-derived-hash",
    password_salt: "server-derived-salt",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockPrepare.mockClear();
  mockBind.mockClear();
  mockAll.mockReset();
});

describe("createUser", () => {
  it("inserts password_hash/password_salt derived from PBKDF2, never the raw passwordHash", async () => {
    mockAll.mockResolvedValueOnce({ results: [userRow()] });

    const user = await createUser(validCreateInput);

    const boundArgs = mockBind.mock.calls[0];
    const [firstName, lastName, username, email, boundPasswordHash, boundPasswordSalt] = boundArgs;

    expect(firstName).toBe(validCreateInput.firstName);
    expect(lastName).toBe(validCreateInput.lastName);
    expect(username).toBe(validCreateInput.username);
    expect(email).toBe(validCreateInput.email);
    expect(boundPasswordHash).not.toBe(validCreateInput.passwordHash);
    expect(boundPasswordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(boundPasswordSalt).toMatch(/^[0-9a-f]{32}$/);

    expect(mockPrepare.mock.calls[0][0]).toMatch(/INSERT INTO users/);

    expect(user).toEqual({
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "alovelace",
      email: "ada@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("password_hash");
  });

  it("throws DuplicateUserError when the database reports a unique constraint violation", async () => {
    mockAll.mockRejectedValueOnce(new Error("UNIQUE constraint failed: users.username"));

    await expect(createUser(validCreateInput)).rejects.toThrow(DuplicateUserError);
  });

  it("rethrows unexpected database errors as-is", async () => {
    mockAll.mockRejectedValueOnce(new Error("D1 connection reset"));

    await expect(createUser(validCreateInput)).rejects.toThrow("D1 connection reset");
  });
});

describe("getUserByIdentifier", () => {
  it("queries by username or email with a single bound placeholder", async () => {
    mockAll.mockResolvedValueOnce({ results: [userRow()] });

    const user = await getUserByIdentifier("alovelace");

    expect(mockPrepare.mock.calls[0][0]).toMatch(/username = \?1/);
    expect(mockPrepare.mock.calls[0][0]).toMatch(/email = \?1/);
    expect(mockBind.mock.calls[0]).toEqual(["alovelace"]);
    expect(user?.id).toBe("user-1");
    expect(user?.passwordHash).toBe("server-derived-hash");
  });

  it("returns undefined when no user matches the identifier", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const user = await getUserByIdentifier("nobody");

    expect(user).toBeUndefined();
  });
});

describe("getUserById", () => {
  it("returns undefined when no user matches the id", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const user = await getUserById("does-not-exist");

    expect(mockBind.mock.calls[0]).toEqual(["does-not-exist"]);
    expect(user).toBeUndefined();
  });
});

describe("updateUser", () => {
  it("builds an UPDATE with bound, numbered placeholders and no user-controlled string concatenation", async () => {
    mockAll.mockResolvedValueOnce({
      results: [userRow({ first_name: "Updated", updated_at: "2026-01-02T00:00:00.000Z" })],
    });

    const user = await updateUser("user-1", { firstName: "Updated" });

    const sql = mockPrepare.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE users SET first_name = \?1/);
    expect(sql).not.toContain("Updated");
    expect(mockBind.mock.calls[0]).toEqual(["Updated", "user-1"]);
    expect(user.firstName).toBe("Updated");
  });

  it("throws DuplicateUserError when the update collides with an existing username or email", async () => {
    mockAll.mockRejectedValueOnce(new Error("UNIQUE constraint failed: users.email"));

    await expect(updateUser("user-1", { email: "taken@example.com" })).rejects.toThrow(
      DuplicateUserError
    );
  });
});

describe("deleteUser", () => {
  it("issues a DELETE bound to the given id", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    await deleteUser("user-1");

    expect(mockPrepare.mock.calls[0][0]).toMatch(/DELETE FROM users WHERE id = \?1/);
    expect(mockBind.mock.calls[0]).toEqual(["user-1"]);
  });
});
