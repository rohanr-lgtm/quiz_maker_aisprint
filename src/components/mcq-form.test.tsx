import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));
vi.mock("@/lib/client-identity", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { McqForm } from "@/components/mcq-form";

const currentUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockReturnValue(currentUser);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mcq: { id: "mcq-1" } }), { status: 201 })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function getChoiceInputs() {
  return screen.getAllByLabelText(/^choice \d+ text$/i);
}

function getRemoveButtons() {
  return screen.getAllByRole("button", { name: /^remove$/i });
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), "Photosynthesis basics");
  await user.type(
    screen.getByLabelText(/^question$/i),
    "What gas do plants absorb during photosynthesis?"
  );
  const choiceInputs = getChoiceInputs();
  await user.type(choiceInputs[0], "Oxygen");
  await user.type(choiceInputs[1], "Carbon dioxide");
  await user.click(
    screen.getByRole("radio", { name: /mark choice 2 as correct/i })
  );
}

describe("McqForm", () => {
  it("starts with 2 choice rows", () => {
    render(<McqForm mode="create" />);

    expect(getChoiceInputs()).toHaveLength(2);
  });

  it("Add choice stops adding at 6", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    const addButton = screen.getByRole("button", { name: /add choice/i });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(getChoiceInputs()).toHaveLength(6);
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(addButton);
    expect(getChoiceInputs()).toHaveLength(6);
  });

  it("Remove stops removing at 2", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    expect((getRemoveButtons()[0] as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /add choice/i }));
    await user.click(screen.getByRole("button", { name: /add choice/i }));
    expect(getChoiceInputs()).toHaveLength(4);

    await user.click(getRemoveButtons()[0]);
    await user.click(getRemoveButtons()[0]);
    expect(getChoiceInputs()).toHaveLength(2);
    expect((getRemoveButtons()[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a validation error and never calls fetch when no choice is marked correct", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await user.type(screen.getByLabelText(/^name$/i), "Photosynthesis basics");
    await user.type(
      screen.getByLabelText(/^question$/i),
      "What gas do plants absorb during photosynthesis?"
    );
    const choiceInputs = getChoiceInputs();
    await user.type(choiceInputs[0], "Oxygen");
    await user.type(choiceInputs[1], "Carbon dioxide");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByText(/mark exactly one choice as correct/i)
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a valid submit calls POST /api/mcqs with createdBy from the current user", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/mcqs");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      name: "Photosynthesis basics",
      question: "What gas do plants absorb during photosynthesis?",
      createdBy: "user-1",
      choices: [
        { text: "Oxygen", isCorrect: false },
        { text: "Carbon dioxide", isCorrect: true },
      ],
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/mcq"));
  });

  it("in edit mode, a valid submit calls PUT /api/mcqs/[id] without createdBy", async () => {
    const user = userEvent.setup();
    render(
      <McqForm
        mode="edit"
        mcqId="mcq-1"
        initialValues={{
          name: "Old name",
          question: "Old question?",
          choices: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/mcqs/mcq-1");
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      name: "Old name",
      question: "Old question?",
      choices: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });
  });

  it("Cancel navigates to /mcq without calling fetch", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(pushMock).toHaveBeenCalledWith("/mcq");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a login message instead of submitting when there is no current user", async () => {
    mockGetCurrentUser.mockReturnValue(null);
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/please log in again/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
