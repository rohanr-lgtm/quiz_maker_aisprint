import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { mockSaveCurrentUser } = vi.hoisted(() => ({
  mockSaveCurrentUser: vi.fn(),
}));
vi.mock("@/lib/client-identity", () => ({
  saveCurrentUser: mockSaveCurrentUser,
}));

import RegisterPage from "@/app/register/page";

const PLAINTEXT_PASSWORD = "CorrectHorseBatteryStaple1";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First Name"), "Ada");
  await user.type(screen.getByLabelText("Last Name"), "Lovelace");
  await user.type(screen.getByLabelText("Username"), "alovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), PLAINTEXT_PASSWORD);
  await user.type(screen.getByLabelText("Confirm Password"), PLAINTEXT_PASSWORD);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterPage", () => {
  it("shows a validation error and never calls fetch when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("Confirm Password"), "SomethingElse1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a passwordHash (not the plaintext password) to /api/auth/register", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 201 })
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/auth/register");
    const body = JSON.parse(String(init?.body));
    expect(body.passwordHash).toBeTruthy();
    expect(body.passwordHash).not.toBe(PLAINTEXT_PASSWORD);
    expect(JSON.stringify(body)).not.toContain(PLAINTEXT_PASSWORD);
  });

  it("renders the server's 409 error inline and does not navigate away", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Username or email is already taken" }),
        { status: 409 }
      )
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/already taken/i)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /mcq on a successful registration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 201 })
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/mcq"));
  });

  it("saves the returned user to client identity before redirecting", async () => {
    const returnedUser = {
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "alovelace",
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: returnedUser }), { status: 201 })
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mockSaveCurrentUser).toHaveBeenCalledWith(returnedUser)
    );
  });

  it("does not save a user to client identity on a failed registration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Username or email is already taken" }),
        { status: 409 }
      )
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/already taken/i)).toBeTruthy();
    expect(mockSaveCurrentUser).not.toHaveBeenCalled();
  });
});
