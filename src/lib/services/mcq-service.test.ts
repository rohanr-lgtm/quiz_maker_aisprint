import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn();
const mockBind = vi.fn<(...args: unknown[]) => { all: typeof mockAll }>(() => ({
  all: mockAll,
}));
// D1's PreparedStatement supports calling `.all()` directly (no params) as
// well as `.bind(...).all()` - `listMcqs` has no placeholders, so it uses
// the no-bind form.
const mockPrepare = vi.fn<(sql: string) => { bind: typeof mockBind; all: typeof mockAll }>(
  () => ({
    bind: mockBind,
    all: mockAll,
  })
);
const mockBatch = vi.fn<(statements: unknown[]) => Promise<unknown[]>>();
const mockDb = { prepare: mockPrepare, batch: mockBatch };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: mockDb } })),
}));

const {
  createMcq,
  listMcqs,
  getMcqById,
  updateMcq,
  deleteMcq,
  InvalidChoicesError,
  McqNotFoundError,
} = await import("@/lib/services/mcq-service");

const validCreateInput = {
  name: "Photosynthesis basics",
  question: "What gas do plants absorb during photosynthesis?",
  createdBy: "user-1",
  choices: [
    { text: "Oxygen", isCorrect: false },
    { text: "Carbon dioxide", isCorrect: true },
  ],
};

function mcqRow(overrides: Partial<Record<string, string>> = {}) {
  return {
    id: "mcq-1",
    name: "Photosynthesis basics",
    question: "What gas do plants absorb during photosynthesis?",
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function choiceRow(overrides: Partial<Record<string, string | number>> = {}) {
  return {
    id: "choice-1",
    mcq_id: "mcq-1",
    choice_text: "Oxygen",
    is_correct: 0,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockPrepare.mockClear();
  mockBind.mockClear();
  mockAll.mockReset();
  mockBatch.mockReset();
});

describe("createMcq", () => {
  it("inserts the question and every choice in a single batch, then returns the assembled question", async () => {
    mockBatch.mockResolvedValueOnce([
      { results: [mcqRow()] },
      { results: [choiceRow({ id: "choice-1", choice_text: "Oxygen", is_correct: 0, position: 0 })] },
      {
        results: [
          choiceRow({ id: "choice-2", choice_text: "Carbon dioxide", is_correct: 1, position: 1 }),
        ],
      },
    ]);

    const mcq = await createMcq(validCreateInput);

    expect(mockPrepare.mock.calls[0][0]).toMatch(/INSERT INTO mcqs/);
    expect(mockPrepare.mock.calls[1][0]).toMatch(/INSERT INTO mcq_choices/);
    expect(mockPrepare.mock.calls[2][0]).toMatch(/INSERT INTO mcq_choices/);

    const mcqBindArgs = mockBind.mock.calls[0];
    expect(mcqBindArgs.slice(1)).toEqual([
      validCreateInput.name,
      validCreateInput.question,
      validCreateInput.createdBy,
    ]);

    const firstChoiceBindArgs = mockBind.mock.calls[1];
    expect(firstChoiceBindArgs[2]).toBe("Oxygen");
    expect(firstChoiceBindArgs[3]).toBe(0);
    expect(firstChoiceBindArgs[4]).toBe(0);

    const secondChoiceBindArgs = mockBind.mock.calls[2];
    expect(secondChoiceBindArgs[2]).toBe("Carbon dioxide");
    expect(secondChoiceBindArgs[3]).toBe(1);
    expect(secondChoiceBindArgs[4]).toBe(1);

    expect(mockBatch).toHaveBeenCalledTimes(1);

    expect(mcq).toEqual({
      id: "mcq-1",
      name: validCreateInput.name,
      question: validCreateInput.question,
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      choices: [
        { id: "choice-1", text: "Oxygen", isCorrect: false, position: 0 },
        { id: "choice-2", text: "Carbon dioxide", isCorrect: true, position: 1 },
      ],
    });
  });

  it("rejects fewer than 2 choices before touching the database", async () => {
    await expect(
      createMcq({ ...validCreateInput, choices: [{ text: "Only one", isCorrect: true }] })
    ).rejects.toThrow(InvalidChoicesError);
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("rejects more than 6 choices before touching the database", async () => {
    const choices = Array.from({ length: 7 }, (_, index) => ({
      text: `Choice ${index}`,
      isCorrect: index === 0,
    }));
    await expect(createMcq({ ...validCreateInput, choices })).rejects.toThrow(
      InvalidChoicesError
    );
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("rejects zero choices marked correct before touching the database", async () => {
    await expect(
      createMcq({
        ...validCreateInput,
        choices: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      })
    ).rejects.toThrow(InvalidChoicesError);
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("rejects more than one choice marked correct before touching the database", async () => {
    await expect(
      createMcq({
        ...validCreateInput,
        choices: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: true },
        ],
      })
    ).rejects.toThrow(InvalidChoicesError);
    expect(mockBatch).not.toHaveBeenCalled();
  });
});

describe("listMcqs", () => {
  it("returns every question with a choice count, without one query per row", async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "mcq-1",
          name: "Photosynthesis basics",
          question: "What gas do plants absorb during photosynthesis?",
          created_by: "user-1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          choice_count: 2,
        },
      ],
    });

    const mcqs = await listMcqs();

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockPrepare.mock.calls[0][0]).toMatch(/SELECT/i);
    expect(mockPrepare.mock.calls[0][0]).toMatch(/COUNT/i);
    expect(mcqs).toEqual([
      {
        id: "mcq-1",
        name: "Photosynthesis basics",
        question: "What gas do plants absorb during photosynthesis?",
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        choiceCount: 2,
      },
    ]);
  });

  it("returns an empty array when there are no questions", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const mcqs = await listMcqs();

    expect(mcqs).toEqual([]);
  });
});

describe("getMcqById", () => {
  it("returns undefined and never queries choices when the question does not exist", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const mcq = await getMcqById("does-not-exist");

    expect(mcq).toBeUndefined();
    expect(mockPrepare).toHaveBeenCalledTimes(1);
  });

  it("returns the question with its choices ordered by position", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow()] })
      .mockResolvedValueOnce({
        results: [
          choiceRow({ id: "choice-1", is_correct: 0, position: 0 }),
          choiceRow({ id: "choice-2", choice_text: "Carbon dioxide", is_correct: 1, position: 1 }),
        ],
      });

    const mcq = await getMcqById("mcq-1");

    expect(mockPrepare.mock.calls[1][0]).toMatch(/mcq_choices/);
    expect(mockPrepare.mock.calls[1][0]).toMatch(/ORDER BY position/i);
    expect(mcq?.choices).toEqual([
      { id: "choice-1", text: "Oxygen", isCorrect: false, position: 0 },
      { id: "choice-2", text: "Carbon dioxide", isCorrect: true, position: 1 },
    ]);
  });
});

describe("updateMcq", () => {
  const validUpdateInput = {
    name: "Updated name",
    question: "Updated question?",
    choices: [
      { text: "A", isCorrect: true },
      { text: "B", isCorrect: false },
    ],
  };

  it("replaces the full choice set and returns the updated question", async () => {
    mockBatch.mockResolvedValueOnce([
      { results: [mcqRow({ name: "Updated name", question: "Updated question?" })] },
      { results: [] },
      { results: [choiceRow({ id: "choice-1", choice_text: "A", is_correct: 1, position: 0 })] },
      { results: [choiceRow({ id: "choice-2", choice_text: "B", is_correct: 0, position: 1 })] },
    ]);

    const mcq = await updateMcq("mcq-1", validUpdateInput);

    expect(mockPrepare.mock.calls[0][0]).toMatch(/UPDATE mcqs/);
    expect(mockPrepare.mock.calls[1][0]).toMatch(/DELETE FROM mcq_choices/);
    expect(mockPrepare.mock.calls[2][0]).toMatch(/INSERT INTO mcq_choices/);
    expect(mcq.name).toBe("Updated name");
    expect(mcq.choices).toHaveLength(2);
  });

  it("rejects invalid choice sets before touching the database", async () => {
    await expect(
      updateMcq("mcq-1", { ...validUpdateInput, choices: [{ text: "Only one", isCorrect: true }] })
    ).rejects.toThrow(InvalidChoicesError);
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("throws McqNotFoundError when the question does not exist", async () => {
    mockBatch.mockResolvedValueOnce([{ results: [] }, { results: [] }]);

    await expect(updateMcq("does-not-exist", validUpdateInput)).rejects.toThrow(
      McqNotFoundError
    );
  });
});

describe("deleteMcq", () => {
  it("deletes the question and returns without error when it existed", async () => {
    mockAll.mockResolvedValueOnce({ results: [{ id: "mcq-1" }] });

    await expect(deleteMcq("mcq-1")).resolves.toBeUndefined();
    expect(mockPrepare.mock.calls[0][0]).toMatch(/DELETE FROM mcqs WHERE id = \?1/);
    expect(mockBind.mock.calls[0]).toEqual(["mcq-1"]);
  });

  it("throws McqNotFoundError when the question does not exist", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    await expect(deleteMcq("does-not-exist")).rejects.toThrow(McqNotFoundError);
  });
});
