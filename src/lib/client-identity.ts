/**
 * Minimal client-side "current user" persistence.
 *
 * There is no server session, cookie, or token layer in this app (see
 * `register-login-logout_prd.md`'s scope). This module exists only to
 * remember who just logged in/registered, in the browser, so the MCQ
 * create/edit/preview flows have something to send as `createdBy` /
 * `attemptedBy`. Nothing here is verified server-side — see
 * `mcq-crud_prd.md`'s "Client Identity" section for the documented
 * limitation. Do not use this for anything security-sensitive.
 */

const STORAGE_KEY = "quiz-maker:currentUser";

export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
};

export function saveCurrentUser(user: CurrentUser): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getCurrentUser(): CurrentUser | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function clearCurrentUser(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
