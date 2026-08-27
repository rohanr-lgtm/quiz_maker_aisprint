import { describe, it, expect } from "vitest";
import { hashPasswordForTransit } from "@/lib/crypto/client-hash";

describe("hashPasswordForTransit", () => {
  it("produces the known SHA-256 hex digest for an empty string", async () => {
    await expect(hashPasswordForTransit("")).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("produces the known SHA-256 hex digest for a fixed test password", async () => {
    await expect(hashPasswordForTransit("password")).resolves.toBe(
      "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
    );
  });

  it("is deterministic for the same input", async () => {
    const first = await hashPasswordForTransit("CorrectHorseBatteryStaple1");
    const second = await hashPasswordForTransit("CorrectHorseBatteryStaple1");
    expect(first).toBe(second);
    expect(first).toBe(
      "bbce092bf34c87675f9240a11708eee4b609e648b21b0fe7e83c2a50570fd745"
    );
  });
});
