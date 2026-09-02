import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/mcq-service", () => ({
  getMcqById: vi.fn(),
  updateMcq: vi.fn(),
  deleteMcq: vi.fn(),
  InvalidChoicesError: class InvalidChoicesError extends Error {},
  McqNotFoundError: class McqNotFoundError extends Error {},
}));

import { GET, PUT, DELETE } from "@/app/api/mcqs/[id]/route";
import {
  getMcqById,
  updateMcq,
  deleteMcq,
  InvalidChoicesError,
  McqNotFoundError,
} from "@/lib/services/mcq-service";

const validUpdateBody = {
  name: "Updated name",
  question: "Updated question?",
  choices: [
    { text: "A", isCorrect: true },
    { text: "B", isCorrect: false },
  ],
};

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/mcqs/mcq-1", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

function makeParams(id = "mcq-1") {
  return { params: Promise.resolve({ id }) };
}

type McqResponseBody = { mcq?: unknown; error?: string; success?: boolean };

async function readJson(response: Response): Promise<McqResponseBody> {
  return (await response.json()) as McqResponseBody;
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
});

describe("GET /api/mcqs/[id]", () => {
  it("returns 200 with the question when found", async () => {
    vi.mocked(getMcqById).mockResolvedValueOnce(existingMcq);

    const response = await GET(makeRequest("GET"), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.mcq).toEqual(existingMcq);
    expect(getMcqById).toHaveBeenCalledWith("mcq-1");
  });

  it("returns 404 when the question does not exist", async () => {
    vi.mocked(getMcqById).mockResolvedValueOnce(undefined);

    const response = await GET(makeRequest("GET"), makeParams("does-not-exist"));
    const json = await readJson(response);

    expect(response.status).toBe(404);
    expect(json.error).toBeTruthy();
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(getMcqById).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await GET(makeRequest("GET"), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});

describe("PUT /api/mcqs/[id]", () => {
  it("returns 200 with the updated question on a valid body", async () => {
    const updatedMcq = {
      ...existingMcq,
      name: validUpdateBody.name,
      question: validUpdateBody.question,
      choices: validUpdateBody.choices.map((choice, index) => ({
        id: `choice-${index}`,
        ...choice,
        position: index,
      })),
    };
    vi.mocked(updateMcq).mockResolvedValueOnce(updatedMcq);

    const response = await PUT(makeRequest("PUT", validUpdateBody), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.mcq).toEqual(updatedMcq);
    expect(updateMcq).toHaveBeenCalledWith("mcq-1", validUpdateBody);
  });

  it("returns 400 for invalid choices and never calls updateMcq", async () => {
    const response = await PUT(
      makeRequest("PUT", {
        ...validUpdateBody,
        choices: [{ text: "Only one", isCorrect: true }],
      }),
      makeParams()
    );

    expect(response.status).toBe(400);
    expect(updateMcq).not.toHaveBeenCalled();
  });

  it("returns 404 when updateMcq reports the question does not exist", async () => {
    vi.mocked(updateMcq).mockRejectedValueOnce(new McqNotFoundError());

    const response = await PUT(makeRequest("PUT", validUpdateBody), makeParams("does-not-exist"));
    const json = await readJson(response);

    expect(response.status).toBe(404);
    expect(json.error).toBeTruthy();
  });

  it("returns 400 when updateMcq reports invalid choices", async () => {
    vi.mocked(updateMcq).mockRejectedValueOnce(
      new InvalidChoicesError("Exactly one choice must be marked correct")
    );

    const response = await PUT(makeRequest("PUT", validUpdateBody), makeParams());

    expect(response.status).toBe(400);
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(updateMcq).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await PUT(makeRequest("PUT", validUpdateBody), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});

describe("DELETE /api/mcqs/[id]", () => {
  it("returns 200 with success on a known id", async () => {
    vi.mocked(deleteMcq).mockResolvedValueOnce(undefined);

    const response = await DELETE(makeRequest("DELETE"), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deleteMcq).toHaveBeenCalledWith("mcq-1");
  });

  it("returns 404 when the question does not exist", async () => {
    vi.mocked(deleteMcq).mockRejectedValueOnce(new McqNotFoundError());

    const response = await DELETE(makeRequest("DELETE"), makeParams("does-not-exist"));
    const json = await readJson(response);

    expect(response.status).toBe(404);
    expect(json.error).toBeTruthy();
  });

  it("returns 500 with no leaked internal details on an unexpected error", async () => {
    vi.mocked(deleteMcq).mockRejectedValueOnce(new Error("D1 connection reset at internal/pool.js:42"));

    const response = await DELETE(makeRequest("DELETE"), makeParams());
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).not.toMatch(/D1 connection reset/);
  });
});
