import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { McqRowActions } from "@/app/mcq/mcq-row-actions";

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

// Base UI's click interaction schedules the actual `open` state update via
// requestAnimationFrame (see useClick's onMouseDown), so the menu content
// appears one frame after the click promise resolves. `findByRole` polls
// until then instead of asserting immediately.
async function openMenu() {
  const user = userEvent.setup();
  render(<McqRowActions mcqId="mcq-1" />);
  await user.click(screen.getByRole("button", { name: /question actions/i }));
  await screen.findByRole("menuitem", { name: /^edit$/i });
  return user;
}

describe("McqRowActions", () => {
  it("shows Edit, Preview, and Delete when opened", async () => {
    await openMenu();

    expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeTruthy();
  });

  it("Edit navigates to /mcq/[id]/edit", async () => {
    await openMenu();

    const editItem = screen.getByRole("menuitem", { name: /^edit$/i });
    expect(editItem.getAttribute("href")).toBe("/mcq/mcq-1/edit");
  });

  it("Preview navigates to /mcq/[id]/preview", async () => {
    await openMenu();

    const previewItem = screen.getByRole("menuitem", { name: /^preview$/i });
    expect(previewItem.getAttribute("href")).toBe("/mcq/mcq-1/preview");
  });

  it("clicking Delete opens the confirm dialog and does not call fetch", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));

    expect(
      await screen.findByText(/delete this question/i)
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Cancel closes the confirm dialog without calling fetch", async () => {
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await screen.findByText(/delete this question/i);

    await user.click(await screen.findByRole("button", { name: /^cancel$/i }));

    await waitFor(() =>
      expect(screen.queryByText(/delete this question/i)).toBeNull()
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("confirming delete calls DELETE /api/mcqs/[id] and refreshes", async () => {
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await screen.findByText(/delete this question/i);

    await user.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/mcqs/mcq-1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
