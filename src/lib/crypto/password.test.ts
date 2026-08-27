import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";

describe("hashPassword", () => {
  it("produces a hex hash different from the input clientHash", async () => {
    const { hash } = await hashPassword("client-side-digest-value");

    expect(hash).not.toBe("client-side-digest-value");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("generates a different random salt on every call", async () => {
    const first = await hashPassword("same-client-hash");
    const second = await hashPassword("same-client-hash");

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});

describe("verifyPassword", () => {
  it("returns true for the exact clientHash/salt/hash triple produced by hashPassword", async () => {
    const { hash, salt } = await hashPassword("correct-client-hash");

    await expect(verifyPassword("correct-client-hash", salt, hash)).resolves.toBe(true);
  });

  it("returns false for a wrong clientHash", async () => {
    const { hash, salt } = await hashPassword("correct-client-hash");

    await expect(verifyPassword("wrong-client-hash", salt, hash)).resolves.toBe(false);
  });

  it("returns false when the stored hash has been tampered with", async () => {
    const { hash, salt } = await hashPassword("correct-client-hash");
    const tamperedHash = hash.slice(0, -2) + (hash.slice(-2) === "00" ? "ff" : "00");

    await expect(verifyPassword("correct-client-hash", salt, tamperedHash)).resolves.toBe(false);
  });

  it("returns false when the salt has been tampered with", async () => {
    const { hash, salt } = await hashPassword("correct-client-hash");
    const tamperedSalt = salt.slice(0, -2) + (salt.slice(-2) === "00" ? "ff" : "00");

    await expect(verifyPassword("correct-client-hash", tamperedSalt, hash)).resolves.toBe(false);
  });
});
