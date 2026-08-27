import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/user-service", () => ({
  createUser: vi.fn(),
  getUserByIdentifier: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

import { POST } from "@/app/api/auth/logout/route";
import * as userService from "@/lib/services/user-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/logout", () => {
  it("returns 200 with { success: true } and makes no user-service calls", async () => {
    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(userService.createUser).not.toHaveBeenCalled();
    expect(userService.getUserByIdentifier).not.toHaveBeenCalled();
    expect(userService.getUserById).not.toHaveBeenCalled();
    expect(userService.updateUser).not.toHaveBeenCalled();
    expect(userService.deleteUser).not.toHaveBeenCalled();
  });
});
