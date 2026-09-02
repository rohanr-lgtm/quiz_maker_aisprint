import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));
vi.mock("@/lib/client-identity", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { McqPreview } from "@/components/mcq-preview";

const currentUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
};

const choices = [
  { id: "choice-1", text: "Oxygen", isCorrect: false, position: 0 },
  { id: "choice-2", text: "Carbon dioxide", isCorrect: true, position: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockReturnValue(currentUser);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPreview() {
  return render(
    <McqPreview
      mcqId="mcq-1"
      question="What gas do plants absorb during photosynthesis?"
      choices={choices}
    />
  );
}

describe("McqPreview", () => {
  it("disables Submit Answer until a choice is picked", async () => {
    const user = userEvent.setup();
    renderPreview();

    const submitButton = screen.getByRole("button", { name: /submit answer/i });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("radio", { name: /oxygen/i }));

    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits the picked choiceId and the current user's id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            attempt: { id: "attempt-1", isCorrect: false },
          }),
          { status: 201 }
        )
      )
    );
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("radio", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/mcqs/mcq-1/attempts");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ choiceId: "choice-1", attemptedBy: "user-1" });
  });

  it("shows Correct! when the attempt response is correct", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ attempt: { id: "attempt-1", isCorrect: true } }),
          { status: 201 }
        )
      )
    );
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("radio", { name: /carbon dioxide/i }));
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(await screen.findByText(/^correct!$/i)).toBeTruthy();
  });

  it("names the correct choice when the attempt response is incorrect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ attempt: { id: "attempt-1", isCorrect: false } }),
          { status: 201 }
        )
      )
    );
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("radio", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(
      await screen.findByText(/incorrect.*carbon dioxide/i)
    ).toBeTruthy();
  });

  it("shows a login message instead of submitting when there is no current user", async () => {
    mockGetCurrentUser.mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("radio", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(await screen.findByText(/please log in again/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
