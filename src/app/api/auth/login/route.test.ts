import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/user-service", () => ({
  getUserByIdentifier: vi.fn(),
}));

vi.mock("@/lib/crypto/password", () => ({
  verifyPassword: vi.fn(),
}));

import { POST } from "@/app/api/auth/login/route";
import { getUserByIdentifier } from "@/lib/services/user-service";
import { verifyPassword } from "@/lib/crypto/password";

const GENERIC_ERROR = "Invalid username/email or password";

const validBody = {
  identifier: "alovelace",
  passwordHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

const storedUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
  email: "ada@example.com",
  passwordHash: "server-derived-hash",
  passwordSalt: "server-derived-salt",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
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

type LoginResponseBody = {
  user?: { id: string; firstName: string; lastName: string; username: string; email: string };
  error?: string;
};

async function readJson(response: Response): Promise<LoginResponseBody> {
  return (await response.json()) as LoginResponseBody;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns 200 with the user (no password fields) on valid credentials", async () => {
    vi.mocked(getUserByIdentifier).mockResolvedValueOnce(storedUser);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.user).toEqual({
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "alovelace",
      email: "ada@example.com",
    });
    expect(json.user).not.toHaveProperty("passwordHash");
    expect(json.user).not.toHaveProperty("passwordSalt");
    expect(verifyPassword).toHaveBeenCalledWith(
      validBody.passwordHash,
      storedUser.passwordSalt,
      storedUser.passwordHash
    );
  });

  it("returns a generic 401 for an unknown identifier, without calling verifyPassword", async () => {
    vi.mocked(getUserByIdentifier).mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(401);
    expect(json.error).toBe(GENERIC_ERROR);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns the identical generic 401 message for a known identifier with a wrong password", async () => {
    vi.mocked(getUserByIdentifier).mockResolvedValueOnce(storedUser);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(401);
    expect(json.error).toBe(GENERIC_ERROR);
  });

  it("returns 400 when the identifier is missing", async () => {
    const response = await POST(makeRequest(omit(validBody, "identifier")));

    expect(response.status).toBe(400);
    expect(getUserByIdentifier).not.toHaveBeenCalled();
  });

  it("returns 400 when the passwordHash is missing", async () => {
    const response = await POST(makeRequest(omit(validBody, "passwordHash")));

    expect(response.status).toBe(400);
    expect(getUserByIdentifier).not.toHaveBeenCalled();
  });
});
