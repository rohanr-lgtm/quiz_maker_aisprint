Date created: August 25, 2026
Date last modified: August 27, 2026

# Register, Login, and Logout - Technical PRD

## Overview/Problem

Multiple teachers need to collaborate on a shared test bank of multiple-choice questions, but the application currently has no concept of a user at all — anyone can open it and there is no way to tell one teacher's work apart from another's. Before any question-bank features can be built, the application needs a basic way for a teacher to create an account, sign in as themselves, and sign out. Without this, every later feature (ownership of questions, collaboration, permissions) has nothing to attach to.

---

## Hypothesis

We believe that adding simple username/email + password registration, login, and logout will give teachers a persistent identity in the system, unblocking the multi-teacher question-bank collaboration features planned for the next phase.

---

## Scope

### In Scope

- A `users` database table (D1) storing first name, last name, username, email, and a hashed password.
- A database migration that creates the `users` table.
- A user service (`src/lib/services/user-service.ts`) providing the base data-access methods: create, read (by id, by username/email), update, and delete a user.
- Three HTTP POST endpoints backed by the user service:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Password hashing on the client before the password is sent over the wire, and salted password hashing again on the server before it is stored — so the plaintext password is never transmitted and never stored.
- A password comparison flow on login that re-derives the stored hash from the submitted (already client-hashed) password and compares it to what is in the database.
- Simple registration and login pages (forms) that call the endpoints above.
- On successful registration or login, the user is taken to a stub page at `/mcq` that will become the multiple-choice question bank in a future phase.
- A logout action, reachable from the `/mcq` stub, that returns the user to the login page.
- Basic input validation (required fields, email format, password length) and duplicate username/email handling.
- Test-driven development with Vitest: for every phase below, failing tests are written first against that phase's not-yet-built behavior, then implementation makes them pass. Test status (red/green) is a build signal alongside the Acceptance Criteria.

### Out of Scope

- Social login / OAuth (Google, Microsoft, etc.).
- Tokens of any kind (JWT, API keys, refresh tokens).
- Session management, cookies, or any mechanism that keeps a user "logged in" across requests or page reloads.
- Route protection / auth guards on `/mcq` or any other page — reachability of `/mcq` without a session is expected in this phase.
- Password reset / "forgot password" flow.
- Email verification.
- Roles or permissions (e.g., admin vs. teacher).
- Rate limiting or account lockout after repeated failed logins.
- The multiple-choice question bank itself — `/mcq` is a stub page only.

### Cut

- **Server-side sessions (cookies)** - Deliberately excluded per explicit product direction for this phase; the goal is the simplest possible register/login/logout loop. Revisit before any real user data or MCQ authoring is exposed behind `/mcq`.
- **bcrypt/argon2 for password hashing** - Cut because these rely on native bindings that are not available in the Cloudflare Workers runtime. Replaced with the Web Crypto API (`crypto.subtle`), which is available in both the browser and Workers, using PBKDF2 with a per-user salt (see [Technical Requirements](#technical-requirements)).
- **`@cloudflare/vitest-pool-workers` (real Workers runtime test execution)** - Cut in favor of the standard `jsdom` Vitest environment with mocked D1/`getCloudflareContext`, per `.cursor/skills/testing/SKILL.md`. Running tests against the real Workers runtime is a bigger setup change; raise it with the user separately if mocked coverage proves insufficient.
- **End-to-end/browser automation tests (e.g., Playwright)** - Cut for this phase. Vitest + Testing Library covers unit and component-level behavior; the full click-through loop is still verified manually in the last phase.

---

## Technical Requirements

### Password Hashing Approach

Because there is no session/token layer, "login" in this phase means: submit credentials, server verifies them, and returns a success response that the client uses to redirect to `/mcq`. Security is limited to protecting the password value itself:

1. **Client-side (browser):** Before the HTTP POST, hash the plaintext password with SHA-256 via `crypto.subtle.digest("SHA-256", ...)` and send the resulting hex digest as `passwordHash`. The plaintext password never leaves the browser.
2. **Server-side (Worker):** On register, generate a random 16-byte salt (`crypto.getRandomValues`) and derive a stored hash from the client's `passwordHash` using PBKDF2 (`crypto.subtle.importKey` + `deriveBits`, SHA-256, ≥100,000 iterations). Store `password_hash` and `password_salt` (both hex) in the `users` table — never the client's raw digest and never the plaintext.
3. **On login:** Look up the user, re-run PBKDF2 over the submitted `passwordHash` using the stored salt, and compare the result to the stored `password_hash` using a constant-time comparison.

**Important constraint:** Since the server only ever receives a password digest, it cannot enforce password strength rules (minimum length, character requirements) — those must be validated client-side, on the plaintext, before hashing.

This uses only built-in Web Crypto APIs — no new npm dependency is required for hashing.

### Database Schema

D1 is not yet configured in this project (see `.cursor/rules/d1.mdc`). Phase 2 below provisions it. Once provisioned, the schema is:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_username ON users (username);
CREATE UNIQUE INDEX idx_users_email ON users (email);
```

Notes:
- `username` and `email` are both required and both unique, even though a teacher may choose to make them the same value.
- `password_hash` / `password_salt` are the server-derived PBKDF2 output and salt — never the client's raw SHA-256 digest.
- No `role` or `status` column — not needed until roles are in scope.

### API Endpoints

#### POST /api/auth/register

**Request Body:**
```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "alovelace",
  "email": "ada@example.com",
  "passwordHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

**Response:**
- Success (201): `{ "user": { "id", "firstName", "lastName", "username", "email", "createdAt" } }`
- Error (400): `{ "error": "message" }` — missing/invalid field (e.g., malformed email, empty name)
- Error (409): `{ "error": "Username or email is already taken" }`
- Error (500): `{ "error": "Something went wrong. Please try again." }`

#### POST /api/auth/login

**Request Body:**
```json
{
  "identifier": "alovelace",
  "passwordHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

`identifier` may be a username or an email.

**Response:**
- Success (200): `{ "user": { "id", "firstName", "lastName", "username", "email" } }`
- Error (400): `{ "error": "Username/email and password are required" }`
- Error (401): `{ "error": "Invalid username/email or password" }` — deliberately generic; do not reveal whether the identifier or password was wrong
- Error (500): `{ "error": "Something went wrong. Please try again." }`

#### POST /api/auth/logout

**Request Body:** none required (no server-side session exists to invalidate).

**Response:**
- Success (200): `{ "success": true }`

This endpoint exists to satisfy the requirement of a logout action backed by the user-facing flow, but since no session/cookie is created at login, there is nothing server-side to tear down. The real logout behavior is client-side: discard any in-memory user state and redirect to `/login`.

### User Interface Requirements

#### Register Page (/register)

- Fields: First Name, Last Name, Username, Email, Password, Confirm Password.
- Client-side validation before submit: all fields required, email must look like an email, password minimum 8 characters, Confirm Password must match Password.
- On submit: hash the password (SHA-256) in the browser, `POST /api/auth/register` with the hash in place of the password.
- On success: redirect to `/mcq`.
- On error: show the server's error inline (e.g., "Username or email is already taken") using the `field` component's `FieldError`.
- Link to `/login` for users who already have an account.

#### Login Page (/login)

- Fields: Username or Email, Password.
- On submit: hash the password (SHA-256) in the browser, `POST /api/auth/login`.
- On success: redirect to `/mcq`.
- On error: show a single generic message ("Invalid username/email or password").
- Link to `/register` for new users.

#### MCQ Stub Page (/mcq)

- Placeholder content only (e.g., "Question Bank — Coming Soon").
- A Logout button that calls `POST /api/auth/logout`, then redirects to `/login`.
- No auth guard — reaching this page directly without logging in is possible in this phase (see Scope > Out of Scope).

#### Home Page (/)

- Update the existing stub `src/app/page.tsx` to redirect to `/login`, since there is no meaningful landing content yet.

---

## Testing Strategy

This feature is built test-first with **Vitest**, following `.cursor/skills/testing/SKILL.md`. Vitest is not installed in this starter yet — installing and configuring it is Phase 1.

### TDD loop per phase

Every phase below follows the same red → green loop:

1. **Red**: Write the test file(s) listed for that phase against code that does not exist yet (or exists but doesn't yet have the behavior). Run `npm run test` and confirm those specific tests fail — not because of a typo or missing import, but because the behavior genuinely isn't implemented.
2. **Green**: Implement just enough of that phase's tasks to make the tests pass, without breaking any earlier phase's tests.
3. Only move to the next phase once its tests are green and the full suite (`npm run test`) still passes.

Test status is a build signal in addition to the Acceptance Criteria — a phase isn't "done" if its tests are red, and the Acceptance Criteria aren't trustworthy if the tests behind them are hollow (see `.cursor/skills/testing/SKILL.md` on tests that can't fail).

### Test environment conventions

- Colocate tests with their subject: `src/lib/services/user-service.ts` → `src/lib/services/user-service.test.ts`.
- Mock at the module boundary with `vi.mock`. Never let a test reach a real D1 database.
- Mock `getCloudflareContext` from `@opennextjs/cloudflare` to supply a fake `env.DB` (a small in-memory stub or `vi.fn()`-based mock of `prepare().bind().all()`), per the testing skill.
- Server-only modules need `vi.mock("server-only", () => ({}))` before import, if/when `server-only` is used.
- Route handlers (`src/app/api/**/route.ts`) are plain async functions — test them by calling `POST(request)` directly with a constructed `Request`, mocking `user-service` at the module boundary rather than re-mocking D1 at that layer.
- `/register` and `/login` pages are client components (they need form state and `fetch`), so they render under `@testing-library/react` with mocked `fetch`. The `/mcq` stub can stay a Server Component for its content, with the Logout button isolated into a small client component so it remains testable.
- Every test must be able to fail — no `expect(true).toBe(true)`. Assert on returned values, thrown errors, HTTP status/body, or rendered DOM, not on implementation internals.

---

## Implementation Phases

### Phase 1: Testing Framework Setup - COMPLETED

**Objective**: Get Vitest running end-to-end (including the `@/` alias and jsdom) before any red tests are written against it.

**Tasks**:
1. Install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths`.
2. Add `vitest.config.ts` at the repo root (React plugin + `vite-tsconfig-paths` + `jsdom` environment + `globals: true`), per `.cursor/skills/testing/SKILL.md`.
3. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`.
4. Add one throwaway smoke test (e.g., `src/lib/sanity.test.ts` asserting `1 + 1 === 2`, or similar) to prove the harness runs and resolves the `@/` alias, then delete it once Phase 2's real tests exist.

**Test Plan (Red → Green)**:
- Red: confirmed — `npm run test` failed with `Missing script: "test"` before this phase's changes.
- Green: confirmed — `npm run test` runs `src/lib/sanity.test.ts` and passes (2/2 tests), proving jsdom and the `@/` alias both resolve correctly.

**Deliverables**:
- `vitest.config.ts` — done.
- `test` / `test:watch` scripts in `package.json` — done.
- `vitest`, `@vitejs/plugin-react` (pinned to `5.2.0` — see note below), `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `vite-tsconfig-paths` as dev dependencies — done.
- `src/lib/sanity.test.ts` smoke test — done; to be deleted once Phase 2 adds real tests.

**Implementation note**: `@vitejs/plugin-react@6.x` (latest) pulls in `@rolldown/plugin-babel`, which has a peer conflict with `@babel/core` versions already required elsewhere in this project (via `shadcn`), causing `npm install` to fail with `ERESOLVE`. Pinned to `@vitejs/plugin-react@5.2.0`, which only peer-depends on `vite` and installs cleanly. `npm run lint` and `npm run test` both pass after this change.

### Phase 2: Provision D1 and Create the Users Table - COMPLETED

**Objective**: Get a real database in place before writing any application code against it.

**Tasks**:
1. Create the D1 database: `npx wrangler d1 create quiz-maker-db` (confirm name with user).
2. Add the returned `d1_databases` block to `wrangler.jsonc` with binding `DB`.
3. Run `npm run cf-typegen` to regenerate `cloudflare-env.d.ts`.
4. Create the migration: `npx wrangler d1 migrations create quiz-maker-db create_users_table`.
5. Fill in the migration with the `users` table and its two unique indexes.
6. Apply the migration locally: `npx wrangler d1 migrations apply quiz-maker-db --local`. Do **not** apply to `--remote`.

**Test Plan (Red → Green)**:
- This phase is infrastructure/config, not application logic, so its "test" is a lightweight schema-contract check rather than behavior mocked in memory — real coverage of query behavior comes in Phase 3 against a mocked `DB`.
- Added `migrations/create_users_table.test.ts`: reads every `.sql` file under `migrations/` from disk and asserts the SQL text contains `CREATE TABLE users`, each required column (`id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `password_salt`, `created_at`, `updated_at`), and `CREATE UNIQUE INDEX` statements on `users (username)` and `users (email)`.
- Red: confirmed — all 12 assertions failed against the empty, freshly-generated `0001_create_users_table.sql` stub.
- Green: confirmed — all 12 assertions pass after the migration SQL (task 5) was written.

**Deliverables**:
- `wrangler.jsonc` updated with the `DB` binding — done (`database_name: "quiz-maker-db"`, region APAC).
- `cloudflare-env.d.ts` regenerated via `npm run cf-typegen` — done (`DB: D1Database` now typed).
- `migrations/0001_create_users_table.sql` creating the `users` table and both unique indexes — done, and applied locally (`wrangler d1 migrations apply quiz-maker-db --local`), verified by querying `sqlite_master` directly against the local D1 instance.
- `migrations/create_users_table.test.ts` — done.
- Confirmed the remote database was **not** touched — only `--local` commands were run.

### Phase 3: User Service and Password Hashing - COMPLETED

**Objective**: Centralize all database access and password-hashing logic behind a small set of reusable modules.

**Tasks**:
1. Add `src/lib/crypto/password.ts` — server-side PBKDF2 hashing (`hashPassword(clientHash)` → `{ hash, salt }`) and verification (`verifyPassword(clientHash, salt, storedHash)` → `boolean`) using `crypto.subtle`.
2. Add `src/lib/schemas/user.ts` — Zod schemas for register and login request bodies.
3. Add `src/lib/services/user-service.ts` with:
   - `createUser(input)` — validates uniqueness, hashes password, inserts row, returns the user without password fields.
   - `getUserByIdentifier(identifier)` — looks up by username or email.
   - `getUserById(id)`.
   - `updateUser(id, input)`.
   - `deleteUser(id)`.
4. Confirm whether `zod` should be added as a dependency (not currently installed) — ask before installing, per project working agreements.

**Test Plan (Red → Green)**:
- `src/lib/crypto/password.test.ts`:
  - `hashPassword` returns a different `salt` on each call (random), and a `hash` that is not equal to the input `clientHash`.
  - `verifyPassword` returns `true` for the exact `clientHash`/`salt`/`hash` triple produced by `hashPassword`, and `false` for a wrong `clientHash` or a tampered `hash`/`salt`.
- `src/lib/schemas/user.test.ts`:
  - `RegisterInputSchema` accepts a valid payload and rejects missing fields and a malformed email.
  - `LoginInputSchema` accepts a valid payload and rejects a missing `identifier` or `passwordHash`.
- `src/lib/services/user-service.test.ts` (mock `getCloudflareContext` → fake `env.DB`):
  - `createUser` inserts a row with `password_hash`/`password_salt` set (never the raw `passwordHash` field) and returns a user object with no password fields.
  - `createUser` throws/returns a conflict when the username or email already exists (simulate the unique-constraint failure from the mocked `DB`).
  - `getUserByIdentifier` queries by username or email and returns `undefined`/`null` when not found.
  - `updateUser` and `deleteUser` call `DB` with bound parameters (assert on the mock's call arguments) and never build SQL via string concatenation.
- Red: all of the above fail on an empty `src/lib/`, since none of these modules exist yet.
- Green: implementing tasks 1–3 makes each test pass without loosening any assertion.

**Red (confirmed)**: `npm run test` failed all 3 new suites with "Failed to resolve import" errors for `@/lib/crypto/password`, `@/lib/schemas/user`, and `@/lib/services/user-service` — the right reason, since none of those files existed yet. The 2 pre-existing sanity-test suites still passed (14 passed / 3 failed suites).

**Green (confirmed)**: After implementing all three modules, `npm run test` passed 36/36 (later 34/34 once the Phase 1 throwaway sanity test was deleted per its own "delete once real tests exist" note — see Implementation note below).

**Deliverables**:
- `src/lib/crypto/password.ts` + `src/lib/crypto/password.test.ts` — done.
- `src/lib/schemas/user.ts` + `src/lib/schemas/user.test.ts` — done.
- `src/lib/services/user-service.ts` + `src/lib/services/user-service.test.ts` — done.
- `zod@^4.4.3` added as a regular dependency, after user approval.

**Implementation notes**:
- `createUser`/`updateUser` use a single `INSERT ... RETURNING` / `UPDATE ... RETURNING` statement and catch the D1 `UNIQUE constraint failed` error to throw a `DuplicateUserError`, rather than checking uniqueness with a separate `SELECT` first — this relies on the database-level unique index as the source of truth (matching the Acceptance Criterion that duplicates are rejected "independent of any application-level check") and avoids a check-then-insert race condition.
- `updateUser` builds its `SET` clause from a fixed, hardcoded column allowlist (`UPDATABLE_COLUMNS`) — only column *names* from that allowlist are interpolated into the SQL string; every bound *value* still goes through numbered placeholders (`?1`, `?2`, ...), so no user-supplied data is ever concatenated into SQL text.
- Deleted `src/lib/sanity.test.ts` (the Phase 1 throwaway smoke test) now that real tests exist across Phases 2–3, per its own comment that it should be removed once Phase 2's real tests exist — that cleanup had been missed at the end of Phase 2.
- `npx tsc --noEmit` surfaced two type-only issues fixed during this phase: (1) `crypto.subtle.deriveBits`'s `salt` option expects `BufferSource`, but a plain `Uint8Array` from `crypto.getRandomValues` type-checks as `Uint8Array<ArrayBufferLike>` under this project's TS/lib version combination, which isn't assignable — fixed with a local `as BufferSource` cast (safe: the runtime value is always a real `ArrayBuffer`-backed view); (2) mock functions built with `vi.fn(() => ...)` infer a zero-argument call signature, which broke tuple-indexed assertions like `mockBind.mock.calls[0][0]` — fixed by giving `vi.fn` an explicit generic type argument (e.g. `vi.fn<(sql: string) => ...>(() => ...)`) instead of inferring it from the no-arg implementation.
- `npm run lint` and `npx tsc --noEmit` are both clean (zero errors, zero warnings) as of this phase.

### Phase 4: Auth API Endpoints - COMPLETED

**Objective**: Expose the user service over HTTP so the browser can register, log in, and log out.

**Tasks**:
1. `src/app/api/auth/register/route.ts` — validate with Zod, call `userService.createUser`, return 201/400/409/500 per the contract above.
2. `src/app/api/auth/login/route.ts` — validate with Zod, look up user, verify password, return 200/400/401/500.
3. `src/app/api/auth/logout/route.ts` — stub returning `{ success: true }`.

**Test Plan (Red → Green)**:
- `src/app/api/auth/register/route.test.ts` (mock `@/lib/services/user-service` at the module boundary):
  - Valid body → `201` with a `user` object in the response, and `userService.createUser` called with the expected arguments.
  - Missing/invalid field (e.g., bad email) → `400`, `createUser` never called.
  - `createUser` mock rejects with a "duplicate" error → route returns `409`.
  - Unexpected thrown error → `500`, with no leaked stack trace/internal details in the body.
- `src/app/api/auth/login/route.test.ts`:
  - Valid credentials (mocked `getUserByIdentifier` + `verifyPassword` returning true) → `200` with `user`.
  - Unknown identifier or wrong password → `401` with the same generic message in both cases (assert the message text is identical for both paths).
  - Missing fields → `400`.
- `src/app/api/auth/logout/route.test.ts`:
  - `POST` → `200` with `{ success: true }`, no `DB`/`user-service` calls made.
- Red: fails on missing route files / import errors.
- Green: each handler implemented to satisfy every case above, including the negative/error paths — not just the happy path.

**Red (confirmed)**: `npm run test` failed all 3 new suites with "Failed to resolve import" errors for `@/app/api/auth/register/route`, `@/app/api/auth/login/route`, and `@/app/api/auth/logout/route` — the right reason, since none of those route files existed yet. The 4 pre-existing suites from Phases 1–3 still passed (34 passed / 3 failed suites).

**Green (confirmed)**: After implementing all three route handlers, `npm run test` passed 45/45 across 7 files.

**Deliverables**:
- Three route handlers under `src/app/api/auth/` (`register`, `login`, `logout`), each with a colocated `route.test.ts` — done.

**Implementation notes**:
- Each handler is tested by calling `POST(request)` directly with a real `Request` object, per the Testing Strategy's convention — no HTTP server is spun up. `user-service` and `password` are mocked at the module boundary (`vi.mock`) so no test touches D1 or real PBKDF2 hashing.
- `register`'s route returns the first Zod validation issue's message on `400` rather than the full issue list, keeping the error body small and consistent with the PRD's `{ "error": "message" }` contract.
- `login` returns the identical `"Invalid username/email or password"` string for both an unknown identifier and a correct identifier with a wrong password — verified by asserting the exact string in both test cases — and never calls `verifyPassword` when the identifier lookup already failed, avoiding unnecessary PBKDF2 work.
- `logout` has no dependencies at all (no D1, no user-service import) since there's no session to invalidate; its test mocks `user-service` anyway and asserts none of its functions were called, as an explicit guardrail against a future regression that accidentally wires in DB access.
- `npx tsc --noEmit` surfaced one type-only issue: this project's Cloudflare Workers global types (`cloudflare-env.d.ts` → `@cloudflare/workers-types`) type `Response.prototype.json()` as returning `Promise<unknown>` (not `Promise<any>` as in `lib.dom`), so property access on an untyped `response.json()` result failed to compile in the test files. Fixed with a small typed `readJson()` helper per test file instead of casting with `any` at every call site.
- `npm run lint` and `npx tsc --noEmit` are both clean (zero errors, zero warnings) as of this phase.

### Phase 5: Registration, Login, and MCQ Stub Pages - PLANNED

**Objective**: Give teachers a working end-to-end flow in the browser.

**Tasks**:
1. `src/lib/crypto/client-hash.ts` — browser-safe SHA-256 helper used by both forms.
2. `src/app/register/page.tsx` — form using `field`/`input`/`label`/`button` components, client-side validation, calls `/api/auth/register`, redirects to `/mcq` on success.
3. `src/app/login/page.tsx` — same pattern, calls `/api/auth/login`.
4. `src/app/mcq/page.tsx` — stub content plus a small client component for the logout button wired to `/api/auth/logout`.
5. Update `src/app/page.tsx` to redirect to `/login`.

**Test Plan (Red → Green)**:
- `src/lib/crypto/client-hash.test.ts`: hashing a known input (e.g., an empty string or a fixed test password) produces the exact expected SHA-256 hex digest (a known test vector), proving the digest is deterministic and correctly hex-encoded.
- `src/app/register/page.test.tsx` (Testing Library, mocked `fetch`):
  - Submitting with mismatched Confirm Password shows a validation error and never calls `fetch`.
  - Submitting a valid form calls `fetch("/api/auth/register", ...)` with a `passwordHash` field (not the plaintext password) in the body.
  - A mocked `409` response renders the "already taken" error inline; a mocked success response triggers redirect/navigation to `/mcq`.
- `src/app/login/page.test.tsx`: analogous cases for `/api/auth/login`, including the generic error message on a mocked `401`.
- `src/app/mcq/page.test.tsx` (testing the logout client component in isolation): clicking Logout calls `fetch("/api/auth/logout", ...)` and then navigates to `/login`.
- Red: fails because none of these components/pages exist yet.
- Green: pages implemented to satisfy each case, including verifying the raw password string never appears in the mocked `fetch` call's body.

**Deliverables**:
- `/register`, `/login`, `/mcq` pages, each with colocated tests.
- `src/lib/crypto/client-hash.ts` + test.
- Updated root page.

### Phase 6: Manual Verification - PLANNED

**Objective**: Confirm the full loop works end-to-end before calling this feature done — this is the one phase Vitest can't cover, since it spans real D1 and real HTTP over the Workers runtime.

**Tasks**:
1. Run `npm run test` and confirm the entire suite from Phases 1–5 is green.
2. Run `npm run preview` (Workers runtime, not `npm run dev`) since this feature touches a D1 binding.
3. Walk through: register a new teacher → redirected to `/mcq` → logout → redirected to `/login` → log back in with the same credentials → redirected to `/mcq`.
4. Verify duplicate username/email is rejected, and invalid login is rejected with the generic error.
5. Confirm the `users` table (`npx wrangler d1 execute quiz-maker-db --local --command "select id, username, email from users"`) never contains a plaintext password.

**Test Plan (Red → Green)**:
- No new automated tests — "green" for this phase means the full suite from every prior phase passes together (no regressions between phases) plus a clean manual walkthrough.

**Deliverables**:
- Confirmed working manual walkthrough, notes added to Troubleshooting Guide if issues are found.

---

## Technical Implementation Details

### Key Files

- `vitest.config.ts` - Vitest + jsdom + `@/` alias resolution for the whole project.
- `migrations/000X_create_users_table.sql` - Creates the `users` table and unique indexes.
- `migrations/create_users_table.test.ts` - Schema-contract check on the migration file's SQL text.
- `src/lib/crypto/password.ts` (+ `.test.ts`) - Server-side PBKDF2 hash/verify against the Web Crypto API.
- `src/lib/crypto/client-hash.ts` (+ `.test.ts`) - Browser SHA-256 helper, imported only from client components.
- `src/lib/schemas/user.ts` (+ `.test.ts`) - Zod schemas for register/login payloads.
- `src/lib/services/user-service.ts` (+ `.test.ts`) - All `DB` access for users lives here; nothing else should query the `users` table directly.
- `src/app/api/auth/register/route.ts`, `.../login/route.ts`, `.../logout/route.ts` (each + `route.test.ts`) - HTTP boundary.
- `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/app/mcq/page.tsx` (each + `.test.tsx`) - UI.

### Implementation Patterns

Server-side hashing (`src/lib/crypto/password.ts`):

```typescript
async function hashPassword(clientHash: string, salt?: Uint8Array) {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientHash),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(saltBytes) };
}
```

Client-side hashing (`src/lib/crypto/client-hash.ts`, browser only):

```typescript
export async function hashPasswordForTransit(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return toHex(digest);
}
```

D1 access follows `.cursor/rules/d1.mdc`: numbered placeholders, reading `results` rather than `first()`, and access via `getCloudflareContext()`:

```typescript
const { env } = await getCloudflareContext({ async: true });
const { results } = await env.DB.prepare(
  "SELECT * FROM users WHERE username = ?1 OR email = ?1"
).bind(identifier).all();
```

### Important Notes

- Password strength validation must happen client-side, before hashing — the server never sees the plaintext and cannot judge its strength.
- A client-side SHA-256 digest of the password is, on its own, a replayable credential (it's deterministic and unsalted). It protects against casual inspection of the request body but is **not** a substitute for TLS. Cloudflare Workers serve over HTTPS by default in production; local `--local` preview traffic is unencrypted, which is expected for development only.
- `password_hash` / `password_salt` stored in the database are the result of server-side PBKDF2 over the client's digest — never store the client's raw digest directly.
- `/mcq` has no auth guard in this phase. This is an intentional, documented cut (see Scope), not an oversight.

---

## Acceptance Criteria

- [ ] A new user can register with first name, last name, username, email, and password, and is redirected to `/mcq` on success.
- [ ] Registering with a username or email that already exists returns a clear 409 error instead of a generic failure.
- [ ] Registering with missing fields or a malformed email is rejected before the request reaches the database.
- [ ] The plaintext password is never present in any HTTP request body, in any log, or in the `users` table — only the client's SHA-256 digest travels over the wire, and only a server-derived salted hash is stored.
- [ ] A registered user can log in with either their username or their email, plus their password, and is redirected to `/mcq`.
- [ ] Logging in with a wrong password or an unknown identifier fails with the same generic "Invalid username/email or password" message in both cases.
- [ ] Clicking Logout on `/mcq` returns the user to `/login`.
- [ ] The `users` table rejects a second row with a duplicate `username` or `email` at the database level (unique index), independent of any application-level check.
- [ ] Every route handler validates its input with a Zod schema before touching the user service.
- [ ] No SQL in the user service is built by string concatenation; all queries use bound, numbered placeholders.
- [ ] `npm run test` passes with the full Vitest suite green (crypto, schemas, user service, all three route handlers, and all three pages) — no skipped, hollow, or tautological tests.
- [ ] For every phase, the tests written for that phase were observed to fail (red) before the corresponding implementation existed.

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| End-to-end register → redirect → logout → login loop | Works with zero manual workarounds | Manual walkthrough in Phase 6 |
| Duplicate username/email handling | 100% rejected with 409, no partial writes | Manual walkthrough + inspecting `users` table |
| Plaintext password exposure | Zero occurrences in request bodies, DB rows, or logs | Manual inspection of network requests and `users` table contents |

---

## Dependencies

### External Dependencies

- None. Password hashing uses the built-in Web Crypto API on both the browser and the Workers runtime — no third-party hashing library is needed.

### Internal Dependencies

- **Vitest** (+ `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `vite-tsconfig-paths`) - Not currently installed; Phase 1 installs and configures it. Approved directly by the user as the project's testing framework for this feature — no further confirmation needed before installing.
- **Cloudflare D1** - Not yet provisioned in this project; Phase 2 creates the database and binding.
- **Zod** (`^4.4.3`) - Installed in Phase 3, with the user's approval, to validate the register/login request bodies per `.cursor/rules/nextjs.mdc` and `.cursor/BUGBOT.md`. Used in `src/lib/schemas/user.ts`.
- **shadcn/ui components** - `field`, `input`, `label`, `button`, `card` are already installed under `src/components/ui/` and cover the form needs of this feature.
- **esbuild** (`^0.27.0`, devDependency) - Not related to this feature's logic, but needed to unblock `npm run build`/`preview`/`deploy` locally; see Troubleshooting Guide for why. Added with the user's approval.

---

## Risks and Mitigation

### Technical Risks

- **Risk**: bcrypt/argon2, the usual password-hashing choices, rely on native bindings unavailable in the Cloudflare Workers runtime.
  **Mitigation**: Use the Web Crypto API's PBKDF2 (`crypto.subtle`) with a per-user random salt and a high iteration count instead.

- **Risk**: Because there is no session or token, a client-side SHA-256 digest of the password is effectively a static, replayable credential if intercepted.
  **Mitigation**: Document this clearly as a known limitation of the "no sessions" scope decision; rely on Cloudflare's default HTTPS in production; revisit with real session-based auth before any sensitive MCQ data sits behind login.

- **Risk**: D1 is not yet configured; Phase 2 work could stall later phases if the database name or binding conventions are wrong.
  **Mitigation**: Confirm the database name with the user before creating it, and follow `.cursor/rules/d1.mdc` exactly (binding name `DB`, `cf-typegen` after any binding change).

### User Experience Risks

- **Risk**: With no password reset flow, a teacher who forgets their password has no way to recover their account in this phase.
  **Mitigation**: Explicitly out of scope; call it out to the user so it lands on the backlog rather than being silently missing.

- **Risk**: `/mcq` being reachable without logging in could confuse testers into thinking auth "isn't working."
  **Mitigation**: Documented prominently in Scope and in Technical Implementation Details as an intentional cut for this phase.

---

## Troubleshooting Guide

### `npm run deploy`/`preview`/`build` fails with `Cannot find package 'esbuild'`
**Problem**: Running `npm run deploy` failed immediately with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'esbuild' imported from .../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js`.
**Cause**: `@opennextjs/cloudflare` imports `esbuild` at runtime in its build/deploy CLI code, but lists `esbuild` under its own `devDependencies`, not `dependencies`. npm never installs a dependency's `devDependencies` when that package is installed as a dependency of another project, so `esbuild` never lands anywhere Node's module resolution can find it from inside `@opennextjs/cloudflare` — even though `wrangler` and `@opennextjs/aws` each carry their own nested `esbuild` copies for their own use. This is a known packaging gap in `@opennextjs/cloudflare` (confirmed via web search — the documented workaround is to add `esbuild` explicitly as a devDependency in the consuming project).
**Solution**: Added `esbuild@^0.27.0` (resolved to `0.27.7`) as a devDependency at the project root, matching `@opennextjs/cloudflare`'s own required range. This installs it at the top level of `node_modules`, where it's resolvable from any nested package. Verified with `node -e "console.log(require('esbuild').version)"` and confirmed `npm run test`/`npm run lint` still pass. Approved by the user before installing, per the "ask before adding a dependency" working agreement.
**Code Reference**: `package.json` (`esbuild` devDependency)

### `npm install` ERESOLVE conflict on `@vitejs/plugin-react`
**Problem**: `npm install -D vitest @vitejs/plugin-react ...` failed with an `ERESOLVE` error about conflicting `@babel/core` versions.
**Cause**: `@vitejs/plugin-react@6.x` (the latest major at install time) depends on `@rolldown/plugin-babel`, which peer-optionally wants `@babel/plugin-transform-runtime` requiring `@babel/core@^8.0.0`. This project already has `@babel/core@^7` pulled in transitively by `shadcn`, so npm couldn't resolve both.
**Solution**: Pin `@vitejs/plugin-react` to `5.2.0`, the last line that only peer-depends on `vite` (no `@rolldown/plugin-babel`). Installed cleanly with no `--legacy-peer-deps`/`--force` needed.
**Code Reference**: `package.json` (`@vitejs/plugin-react` devDependency)

Add further entries here as they come up during implementation, using the format:

```
### Issue Name
**Problem**: ...
**Cause**: ...
**Solution**: ...
**Code Reference**: `file.ts:line`
```

---

## Notes for AI Agents

1. Read Overview/Problem and Hypothesis first — this phase is deliberately narrow: accounts and the register/login/logout loop only, nothing about the MCQ feature itself beyond a stub page.
2. Respect Scope strictly. In particular, do **not** add cookies, sessions, tokens, or an auth guard on `/mcq` — these are deliberate cuts, not gaps to fill in.
3. Follow the TDD loop in [Testing Strategy](#testing-strategy) for every phase: write that phase's tests first, run `npm run test` and actually observe them fail for the right reason, then implement until they pass. Do not write the implementation first and backfill tests — that defeats the red/green signal this PRD relies on.
4. Never write a test that cannot fail (no `expect(true).toBe(true)`, no assertion-free tests). If a case is genuinely hard to assert on, say so instead of faking coverage.
5. D1 is not configured yet in this repo. Phase 2 must be completed (database created, binding added, `cf-typegen` run) before Phase 3 code can run against `env.DB`.
6. Vitest is approved by the user as the testing framework for this feature (Phase 1 installs it) — no further confirmation needed for that dependency. Zod, however, still needs the user's confirmation before `npm install zod`.
7. All password hashing must go through the Web Crypto API (`crypto.subtle`) — do not introduce `bcrypt`, `bcryptjs`, or `argon2` packages; they either need native bindings or add an unnecessary dependency for what PBKDF2-via-Web-Crypto already covers.
8. Keep all `users` table access inside `src/lib/services/user-service.ts`. No component or route handler should call `env.DB` directly.
9. Tests mock `getCloudflareContext`/`env.DB` and `fetch` — never let a test reach a real D1 database or a real network call. Verify runtime-sensitive work (anything touching real `DB`) with `npm run preview`, not `npm run dev`, per `AGENTS.md`.
10. Update phase status markers and the Current Status section as work progresses, including whether each phase's tests are currently red or green.

---

## Current Status

**Last Updated**: August 27, 2026
**Current Phase**: Phase 4 - Auth API Endpoints - COMPLETED. Awaiting review before starting Phase 5.
**Status**: Phases 1–4 COMPLETED; Phase 5 (Registration, Login, and MCQ Stub Pages) PLANNED
**D1 database**: `quiz-maker-db` (id `df973b4b-fd9b-4f30-a539-ec04f6abfe43`, region APAC), bound as `DB`. Migration `0001_create_users_table.sql` applied to the **local** instance only; remote is untouched (the user is handling the push to production separately, outside this session).
**Source control**: Repo initialized locally, remote `origin` set to `https://github.com/rohanr-lgtm/quiz_maker_aisprint.git`. All work happens on `feature/register-login-logout-auth`, branched from `main`, with one commit pushed per phase, only after user review. `main` has not been touched. The project directory was moved from a OneDrive-synced path to `C:\Users\VR99922\Projects\quiz_maker_aisprint` during Phase 3 review (see Troubleshooting Guide) — git history carried over intact.
**Session constraint (still in effect)**: per explicit user direction, no new migrations and no `--remote` D1 or deploy commands should be run this session — the user is handling migrations-to-production and deploys themselves.
**Next Steps**: Awaiting review of Phase 4, then proceed to Phase 5 (the `/register`, `/login`, `/mcq` pages and the browser-side SHA-256 helper, built on top of the Phase 4 API endpoints).
