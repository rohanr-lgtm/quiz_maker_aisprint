import { describe, expect, it } from "vitest";

import { CreateMcqInputSchema, UpdateMcqInputSchema } from "@/lib/schemas/mcq";

function twoValidChoices() {
  return [
    { text: "Oxygen", isCorrect: false },
    { text: "Carbon dioxide", isCorrect: true },
  ];
}

const validCreatePayload = {
  name: "Photosynthesis basics",
  question: "What gas do plants absorb during photosynthesis?",
  createdBy: "user-1",
  choices: twoValidChoices(),
};

describe("CreateMcqInputSchema", () => {
  it("accepts a valid payload with 2 choices", () => {
    expect(CreateMcqInputSchema.safeParse(validCreatePayload).success).toBe(true);
  });

  it("accepts a valid payload with 6 choices", () => {
    const choices = [
      { text: "A", isCorrect: false },
      { text: "B", isCorrect: false },
      { text: "C", isCorrect: true },
      { text: "D", isCorrect: false },
      { text: "E", isCorrect: false },
      { text: "F", isCorrect: false },
    ];
    expect(
      CreateMcqInputSchema.safeParse({ ...validCreatePayload, choices }).success
    ).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name, ...rest } = validCreatePayload;
    void name;
    expect(CreateMcqInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing question", () => {
    const { question, ...rest } = validCreatePayload;
    void question;
    expect(CreateMcqInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing createdBy", () => {
    const { createdBy, ...rest } = validCreatePayload;
    void createdBy;
    expect(CreateMcqInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects fewer than 2 choices", () => {
    const result = CreateMcqInputSchema.safeParse({
      ...validCreatePayload,
      choices: [{ text: "Only one", isCorrect: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 6 choices", () => {
    const choices = Array.from({ length: 7 }, (_, index) => ({
      text: `Choice ${index}`,
      isCorrect: index === 0,
    }));
    const result = CreateMcqInputSchema.safeParse({ ...validCreatePayload, choices });
    expect(result.success).toBe(false);
  });

  it("rejects zero choices marked correct", () => {
    const result = CreateMcqInputSchema.safeParse({
      ...validCreatePayload,
      choices: [
        { text: "A", isCorrect: false },
        { text: "B", isCorrect: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than one choice marked correct", () => {
    const result = CreateMcqInputSchema.safeParse({
      ...validCreatePayload,
      choices: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty choice text", () => {
    const result = CreateMcqInputSchema.safeParse({
      ...validCreatePayload,
      choices: [
        { text: "", isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateMcqInputSchema", () => {
  it("accepts a valid payload without createdBy", () => {
    const { createdBy, ...updatePayload } = validCreatePayload;
    void createdBy;
    expect(UpdateMcqInputSchema.safeParse(updatePayload).success).toBe(true);
  });

  it("rejects the same invalid-choice-count/correctness cases as create", () => {
    const { createdBy, ...updatePayload } = validCreatePayload;
    void createdBy;
    const result = UpdateMcqInputSchema.safeParse({
      ...updatePayload,
      choices: [{ text: "Only one", isCorrect: true }],
    });
    expect(result.success).toBe(false);
  });
});
