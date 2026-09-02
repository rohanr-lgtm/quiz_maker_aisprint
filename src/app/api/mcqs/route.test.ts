import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/mcq-service", () => ({
  createMcq: vi.fn(),
  listMcqs: vi.fn(),
  InvalidChoicesError: class InvalidChoicesError extends Error {},
}));

import { GET, POST } from "@/app/api/mcqs/route";
import { createMcq, listMcqs, InvalidChoicesError } from "@/lib/services/mcq-service";

const validBody = {
  name: "Photosynthesis basics",
  question: "What gas do plants absorb during photosynthesis?",
  createdBy: "user-1",
  choices: [
    { text: "Oxygen", isCorrect: false },
    { text: "Carbon dioxide", isCorrect: true },
  ],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/mcqs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

type McqsResponseBody = {
  mcq?: unknown;
  mcqs?: unknown[];
  error?: string;
};

async function readJson(response: Response): Promise<McqsResponseBody> {
  return (await response.json()) as McqsResponseBody;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/mcqs", () => {
  it("returns 200 with the list of questions", async () => {
    const summaries = [
      {
        id: "mcq-1",
        name: "Photosynthesis basics",
        question: "What gas do plants absorb during photosynthesis?",
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        choiceCount: 2,
      },
    ];
    vi.mocked(listMcqs).mockResolvedValueOnce(summaries);

    const response = await GET();
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.mcqs).toEqual(summaries);
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(listMcqs).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await GET();
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});

describe("POST /api/mcqs", () => {
  it("returns 201 with the created question on a valid body", async () => {
    const createdMcq = {
      id: "mcq-1",
      name: validBody.name,
      question: validBody.question,
      createdBy: validBody.createdBy,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      choices: validBody.choices.map((choice, index) => ({
        id: `choice-${index}`,
        ...choice,
        position: index,
      })),
    };
    vi.mocked(createMcq).mockResolvedValueOnce(createdMcq);

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(201);
    expect(json.mcq).toEqual(createdMcq);
    expect(createMcq).toHaveBeenCalledWith(validBody);
  });

  it("returns 400 for fewer than 2 choices and never calls createMcq", async () => {
    const response = await POST(
      makeRequest({ ...validBody, choices: [{ text: "Only one", isCorrect: true }] })
    );
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json.error).toBeTruthy();
    expect(createMcq).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing name and never calls createMcq", async () => {
    const { name, ...rest } = validBody;
    void name;

    const response = await POST(makeRequest(rest));

    expect(response.status).toBe(400);
    expect(createMcq).not.toHaveBeenCalled();
  });

  it("returns 400 when createMcq reports invalid choices", async () => {
    vi.mocked(createMcq).mockRejectedValueOnce(
      new InvalidChoicesError("Exactly one choice must be marked correct")
    );

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/exactly one/i);
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(createMcq).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await POST(makeRequest(validBody));
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});
