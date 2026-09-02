import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCurrentUser,
  getCurrentUser,
  saveCurrentUser,
  type CurrentUser,
} from "@/lib/client-identity";

const testUser: CurrentUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "alovelace",
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("client-identity", () => {
  it("returns null when no user has been saved", () => {
    expect(getCurrentUser()).toBeNull();
  });

  it("round-trips a saved user", () => {
    saveCurrentUser(testUser);
    expect(getCurrentUser()).toEqual(testUser);
  });

  it("returns null when the stored value is malformed JSON", () => {
    window.localStorage.setItem("quiz-maker:currentUser", "{not-valid-json");
    expect(getCurrentUser()).toBeNull();
  });

  it("clears the saved user so a later read returns null", () => {
    saveCurrentUser(testUser);
    clearCurrentUser();
    expect(getCurrentUser()).toBeNull();
  });

  it("overwrites a previously saved user rather than merging", () => {
    saveCurrentUser(testUser);
    const otherUser: CurrentUser = {
      id: "user-2",
      firstName: "Grace",
      lastName: "Hopper",
      username: "ghopper",
    };
    saveCurrentUser(otherUser);
    expect(getCurrentUser()).toEqual(otherUser);
  });
});
