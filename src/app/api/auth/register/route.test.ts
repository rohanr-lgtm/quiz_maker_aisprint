import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/user-service", () => ({
  createUser: vi.fn(),
  DuplicateUserError: class DuplicateUserError extends Error {},
}));

import { POST } from "@/app/api/auth/register/route";
import { createUser, DuplicateUserError } from "@/lib/services/user-service";

const validBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
  email: "ada@example.com",
  passwordHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...source };
  delete copy[key];
  return copy as Omit<T, K>;
}

type RegisterResponseBody = {
  user?: { id: string; firstName: string; lastName: string; username: string; email: string; createdAt: string };
  error?: string;
};

async function readJson(response: Response): Promise<RegisterResponseBody> {
  return (await response.json()) as RegisterResponseBody;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("returns 201 with the created user on a valid body", async () => {
    const createdUser = {
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "alovelace",
      email: "ada@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(createUser).mockResolvedValueOnce(createdUser);

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(201);
    expect(json.user).toEqual(createdUser);
    expect(createUser).toHaveBeenCalledWith(validBody);
  });

  it("returns 400 for an invalid field and never calls createUser", async () => {
    const response = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json.error).toBeTruthy();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing required field and never calls createUser", async () => {
    const withoutFirstName = omit(validBody, "firstName");

    const response = await POST(makeRequest(withoutFirstName));

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when createUser reports a duplicate username or email", async () => {
    vi.mocked(createUser).mockRejectedValueOnce(new DuplicateUserError("Username or email is already taken"));

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(409);
    expect(json.error).toMatch(/already taken/i);
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(createUser).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
    expect(json.error).not.toMatch(/internal\/pool/);
  });
});
