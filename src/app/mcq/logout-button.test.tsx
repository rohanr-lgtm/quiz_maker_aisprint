import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { mockClearCurrentUser } = vi.hoisted(() => ({
  mockClearCurrentUser: vi.fn(),
}));
vi.mock("@/lib/client-identity", () => ({
  clearCurrentUser: mockClearCurrentUser,
}));

import { LogoutButton } from "@/app/mcq/logout-button";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("clicking Logout calls the logout endpoint and navigates to /login", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockClearCurrentUser).toHaveBeenCalled();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
