import { cn } from "@/lib/utils";

// Throwaway smoke test for Phase 1 of the register-login-logout PRD.
// Proves Vitest runs, jsdom is active, and the `@/` alias resolves.
// Delete this file once Phase 2's real tests exist.
describe("vitest harness", () => {
  it("runs basic assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ alias", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
