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

import LoginPage from "@/app/login/page";

const PLAINTEXT_PASSWORD = "CorrectHorseBatteryStaple1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("shows a validation error and never calls fetch when fields are empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(
      await screen.findByText(/username or email is required/i)
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a passwordHash (not the plaintext password) to /api/auth/login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username or email/i), "alovelace");
    await user.type(screen.getByLabelText("Password"), PLAINTEXT_PASSWORD);
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/auth/login");
    const body = JSON.parse(String(init?.body));
    expect(body.passwordHash).toBeTruthy();
    expect(body.passwordHash).not.toBe(PLAINTEXT_PASSWORD);
    expect(JSON.stringify(body)).not.toContain(PLAINTEXT_PASSWORD);
  });

  it("shows the identical generic error message on a mocked 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Invalid username/email or password" }),
        { status: 401 }
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username or email/i), "alovelace");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(
      await screen.findByText(/invalid username\/email or password/i)
    ).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /mcq on a successful login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username or email/i), "alovelace");
    await user.type(screen.getByLabelText("Password"), PLAINTEXT_PASSWORD);
    await user.click(screen.getByRole("button", { name: /^login$/i }));

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
      new Response(JSON.stringify({ user: returnedUser }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username or email/i), "alovelace");
    await user.type(screen.getByLabelText("Password"), PLAINTEXT_PASSWORD);
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() =>
      expect(mockSaveCurrentUser).toHaveBeenCalledWith(returnedUser)
    );
  });

  it("does not save a user to client identity on a failed login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Invalid username/email or password" }),
        { status: 401 }
      )
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username or email/i), "alovelace");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(
      await screen.findByText(/invalid username\/email or password/i)
    ).toBeTruthy();
    expect(mockSaveCurrentUser).not.toHaveBeenCalled();
  });
});
