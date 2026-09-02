import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/attempt-service", () => ({
  createAttempt: vi.fn(),
  ChoiceNotFoundError: class ChoiceNotFoundError extends Error {},
}));

vi.mock("@/lib/services/mcq-service", () => ({
  getMcqById: vi.fn(),
}));

import { POST } from "@/app/api/mcqs/[id]/attempts/route";
import { createAttempt, ChoiceNotFoundError } from "@/lib/services/attempt-service";
import { getMcqById } from "@/lib/services/mcq-service";

const validBody = { choiceId: "choice-1", attemptedBy: "user-1" };

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/mcqs/mcq-1/attempts", {
    method: "POST",
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

function makeParams(id = "mcq-1") {
  return { params: Promise.resolve({ id }) };
}

type AttemptResponseBody = { attempt?: unknown; error?: string };

async function readJson(response: Response): Promise<AttemptResponseBody> {
  return (await response.json()) as AttemptResponseBody;
}

const existingMcq = {
  id: "mcq-1",
  name: "Photosynthesis basics",
  question: "What gas do plants absorb during photosynthesis?",
  createdBy: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  choices: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMcqById).mockResolvedValue(existingMcq);
});

describe("POST /api/mcqs/[id]/attempts", () => {
  it("returns 201 with the recorded attempt on a valid body", async () => {
    const attempt = {
      id: "attempt-1",
      mcqId: "mcq-1",
      choiceId: "choice-1",
      attemptedBy: "user-1",
      isCorrect: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(createAttempt).mockResolvedValueOnce(attempt);

    const response = await POST(makeRequest(validBody), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(201);
    expect(json.attempt).toEqual(attempt);
    expect(createAttempt).toHaveBeenCalledWith("mcq-1", validBody);
  });

  it("returns 400 for a missing field and never calls createAttempt", async () => {
    const response = await POST(makeRequest({ choiceId: "choice-1" }), makeParams());

    expect(response.status).toBe(400);
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("returns 404 when the question does not exist, without calling createAttempt", async () => {
    vi.mocked(getMcqById).mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest(validBody), makeParams("does-not-exist"));
    const json = await readJson(response);

    expect(response.status).toBe(404);
    expect(json.error).toBeTruthy();
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("returns 400 when the choice does not belong to the question", async () => {
    vi.mocked(createAttempt).mockRejectedValueOnce(new ChoiceNotFoundError());

    const response = await POST(makeRequest(validBody), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(createAttempt).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await POST(makeRequest(validBody), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});
