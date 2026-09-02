import { describe, expect, it } from "vitest";

import { AttemptInputSchema } from "@/lib/schemas/attempt";

const validPayload = {
  choiceId: "choice-1",
  attemptedBy: "user-1",
};

describe("AttemptInputSchema", () => {
  it("accepts a valid payload", () => {
    expect(AttemptInputSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects a missing choiceId", () => {
    const { choiceId, ...rest } = validPayload;
    void choiceId;
    expect(AttemptInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing attemptedBy", () => {
    const { attemptedBy, ...rest } = validPayload;
    void attemptedBy;
    expect(AttemptInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an empty choiceId", () => {
    expect(
      AttemptInputSchema.safeParse({ ...validPayload, choiceId: "" }).success
    ).toBe(false);
  });
});
