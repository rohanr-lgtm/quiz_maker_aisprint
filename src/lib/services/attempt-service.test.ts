import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn();
const mockBind = vi.fn<(...args: unknown[]) => { all: typeof mockAll }>(() => ({
  all: mockAll,
}));
const mockPrepare = vi.fn<(sql: string) => { bind: typeof mockBind }>(() => ({
  bind: mockBind,
}));
const mockDb = { prepare: mockPrepare };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: mockDb } })),
}));

const { createAttempt, ChoiceNotFoundError } = await import(
  "@/lib/services/attempt-service"
);

beforeEach(() => {
  mockPrepare.mockClear();
  mockBind.mockClear();
  mockAll.mockReset();
});

describe("createAttempt", () => {
  it("records a correct attempt when the chosen choice is marked correct", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [{ is_correct: 1 }] })
      .mockResolvedValueOnce({
        results: [
          {
            id: "attempt-1",
            mcq_id: "mcq-1",
            choice_id: "choice-2",
            attempted_by: "user-1",
            is_correct: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    const attempt = await createAttempt("mcq-1", {
      choiceId: "choice-2",
      attemptedBy: "user-1",
    });

    expect(mockPrepare.mock.calls[0][0]).toMatch(/SELECT is_correct FROM mcq_choices/);
    expect(mockBind.mock.calls[0]).toEqual(["choice-2", "mcq-1"]);
    expect(mockPrepare.mock.calls[1][0]).toMatch(/INSERT INTO mcq_attempts/);
    expect(mockBind.mock.calls[1]).toEqual([
      expect.any(String),
      "mcq-1",
      "choice-2",
      "user-1",
      1,
    ]);
    expect(attempt).toEqual({
      id: "attempt-1",
      mcqId: "mcq-1",
      choiceId: "choice-2",
      attemptedBy: "user-1",
      isCorrect: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("records an incorrect attempt when the chosen choice is not marked correct", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [{ is_correct: 0 }] })
      .mockResolvedValueOnce({
        results: [
          {
            id: "attempt-2",
            mcq_id: "mcq-1",
            choice_id: "choice-1",
            attempted_by: "user-1",
            is_correct: 0,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    const attempt = await createAttempt("mcq-1", {
      choiceId: "choice-1",
      attemptedBy: "user-1",
    });

    expect(attempt.isCorrect).toBe(false);
  });

  it("throws ChoiceNotFoundError when the choice does not belong to the question, and never inserts", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    await expect(
      createAttempt("mcq-1", { choiceId: "choice-from-another-mcq", attemptedBy: "user-1" })
    ).rejects.toThrow(ChoiceNotFoundError);

    expect(mockPrepare).toHaveBeenCalledTimes(1);
  });
});
