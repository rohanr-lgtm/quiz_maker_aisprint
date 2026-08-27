import { describe, it, expect } from "vitest";
import { RegisterInputSchema, LoginInputSchema } from "@/lib/schemas/user";

function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...source };
  delete copy[key];
  return copy as Omit<T, K>;
}

const validRegisterPayload = {
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
  email: "ada@example.com",
  passwordHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

describe("RegisterInputSchema", () => {
  it("accepts a valid payload", () => {
    expect(RegisterInputSchema.safeParse(validRegisterPayload).success).toBe(true);
  });

  it("rejects a payload missing a required field", () => {
    const withoutFirstName = omit(validRegisterPayload, "firstName");

    expect(RegisterInputSchema.safeParse(withoutFirstName).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = RegisterInputSchema.safeParse({
      ...validRegisterPayload,
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty passwordHash", () => {
    const result = RegisterInputSchema.safeParse({
      ...validRegisterPayload,
      passwordHash: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("LoginInputSchema", () => {
  const validLoginPayload = {
    identifier: "alovelace",
    passwordHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  };

  it("accepts a valid payload", () => {
    expect(LoginInputSchema.safeParse(validLoginPayload).success).toBe(true);
  });

  it("rejects a payload missing the identifier", () => {
    const withoutIdentifier = omit(validLoginPayload, "identifier");

    expect(LoginInputSchema.safeParse(withoutIdentifier).success).toBe(false);
  });

  it("rejects a payload missing the passwordHash", () => {
    const withoutPasswordHash = omit(validLoginPayload, "passwordHash");

    expect(LoginInputSchema.safeParse(withoutPasswordHash).success).toBe(false);
  });
});
