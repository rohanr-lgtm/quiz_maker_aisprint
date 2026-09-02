Date created: September 2, 2026
Date last modified: September 2, 2026

# Multiple-Choice Question CRUD - Technical PRD

## Overview/Problem

Teachers can register, log in, and log out (see `register-login-logout_prd.md`), but `/mcq` is still just a placeholder — "Question Bank — Coming Soon" and a Logout button. There is no way to create, view, edit, delete, or self-test a single multiple-choice question yet, so none of the shared-question-bank value promised by the previous phase's hypothesis actually exists. Teachers need a real question bank: a list of the questions that exist, a way to add a new one, a way to change or remove an existing one, and a way to preview/self-test a question to confirm it's set up correctly before relying on it.

---

## Hypothesis

We believe that giving teachers full create/read/update/delete control over multiple-choice questions — each with a name, a question prompt, two to six answer choices with exactly one marked correct, and a "Preview" self-test that records an attempt — will turn `/mcq` into the first real, usable building block of the shared question bank, and begin capturing real attempt data that future scoring/analytics phases can build on.

---

## Scope

### In Scope

- Three D1 tables: `mcqs`, `mcq_choices`, `mcq_attempts`, plus a migration.
- A minimal client-side "current user" persistence mechanism, since no session exists yet (see [Technical Requirements > Client Identity](#client-identity-no-server-session)): the logged-in user's id/name is saved to `localStorage` on successful login/register, and read back to attribute `created_by` on questions and `attempted_by` on attempts. No server-side verification of this value — it is trusted the same way the rest of this app currently trusts the client, and does not reintroduce sessions, cookies, or route guards.
- `src/lib/services/mcq-service.ts` — data access for `mcqs` + `mcq_choices`: `createMcq`, `listMcqs`, `getMcqById`, `updateMcq`, `deleteMcq`.
- `src/lib/services/attempt-service.ts` — data access for `mcq_attempts`: `createAttempt`.
- HTTP endpoints backed by those services:
  - `GET /api/mcqs`, `POST /api/mcqs`
  - `GET /api/mcqs/[id]`, `PUT /api/mcqs/[id]`, `DELETE /api/mcqs/[id]`
  - `POST /api/mcqs/[id]/attempts`
- New shadcn/ui components: `dropdown-menu`, `alert-dialog`, `textarea`, `radio-group` (added via `npx shadcn@latest add @shadcn/<name>`, per `.cursor/rules/shadcn.mdc`).
- `/mcq` rebuilt as a real list page: a shadcn `Table` of every question (Name, Question, Actions), and a "Create Question" button.
- An Actions column per row: a vertical-ellipsis (`MoreVertical`) icon button opening a `DropdownMenu` with **Edit**, **Preview**, and **Delete** (Delete confirms via `AlertDialog` before calling the delete endpoint).
- `/mcq/new` and `/mcq/[id]/edit` sharing one form component: Name, Question, and 2–6 Choices (two shown by default, "Add choice" up to six, "Remove" down to two), with a `RadioGroup` marking exactly one choice correct. **Save** and **Cancel** buttons.
- `/mcq/[id]/preview`: renders the question read-only, lets the previewer pick one choice and submit, records an attempt via the attempts endpoint, and shows whether the pick was correct (and what the correct choice was).
- Test-driven development with Vitest for every phase below, per `.cursor/skills/testing/SKILL.md` and the same red → green discipline used in `register-login-logout_prd.md`.

### Out of Scope

- Any student-facing role or quiz-taking experience distinct from the teacher's own "Preview" self-test.
- Scoring, grading, reporting, or any dashboard/analytics that reads `mcq_attempts` back — this phase only records attempts.
- Reordering choices via drag-and-drop (choices keep a fixed `position` set at save time).
- Rich text, images, or file attachments in questions or choices — plain text only.
- Bulk import/export of questions (e.g., CSV, spreadsheet paste).
- Real, server-verified sessions or auth tokens — carried over from `register-login-logout_prd.md`'s scope, still deliberately excluded.
- Route protection / auth guards on any `/mcq` route.
- Ownership permissions — any teacher can edit, preview, or delete any question in the shared bank; there is no "only the creator can edit" restriction in this phase.

### Cut

- **A choice-blind "preview" endpoint that hides `is_correct` until an attempt is submitted** — Cut because there is no untrusted student role in scope yet; the same teacher previewing a question already has full access to its answer key via the Edit page. The Preview *page* still withholds the correct answer visually until after submission, for UX fidelity, but the API payload it uses is the same as Edit's. Revisit if this feature is ever exposed to actual quiz-takers.
- **Preserving attempt history across choice edits** — Cut. `PUT /api/mcqs/[id]` replaces the full choice set for a question; `mcq_attempts.choice_id` cascades on delete, so attempts tied to a replaced choice are deleted along with it. Acceptable because attempts aren't yet read by any feature (see Out of Scope). A future phase could preserve history by never hard-deleting choices.
- **Cookie/session-based identity** — Cut in favor of `localStorage`-based client identity (see Scope > In Scope), a decision made explicitly with the user for this PRD, to avoid re-opening the previous phase's "no sessions" scope decision while still satisfying the new `created_by`/`attempted_by` requirement.
- **Multiple correct choices per question (multi-select)** — Cut in favor of exactly one correct choice per question, confirmed with the user; matches the "the choice the user selected" (singular) framing of the original request.

---

## Technical Requirements

### Client Identity (no server session)

There is still no session, cookie, or token layer (see `register-login-logout_prd.md`). To satisfy `created_by`/`attempted_by` without reopening that scope decision:

1. `src/lib/client-identity.ts` exposes `saveCurrentUser`, `getCurrentUser`, and `clearCurrentUser`, backed by `window.localStorage` under a single key (e.g. `quiz-maker:currentUser`), storing `{ id, firstName, lastName, username }`.
2. `RegisterForm` and `LoginForm` (`src/components/register-form.tsx`, `src/components/login-form.tsx`) call `saveCurrentUser(user)` with the response body's `user` object, immediately before redirecting to `/mcq`.
3. `LogoutButton` (`src/app/mcq/logout-button.tsx`) calls `clearCurrentUser()` alongside its existing `POST /api/auth/logout` call.
4. Every MCQ-writing client call (`create`, `update`, `attempt`) reads `getCurrentUser()` and sends the id along in the request body. If it's missing (e.g., someone reached `/mcq` without ever logging in, which remains possible per the previous PRD's cut), the create/edit/preview pages show an inline message asking the user to log in first, rather than sending a request with no attributable user.

**Known limitation, stated plainly**: this value is entirely client-asserted. Nothing on the server verifies that the `createdBy`/`attemptedBy` id sent actually belongs to whoever is at the keyboard — the same trust model the previous phase already accepted by leaving `/mcq` unguarded. This is not a security boundary; it's just enough to populate an attribution column. Revisit before any of this data is used for grading or access control.

### Database Schema

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs (id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs (id) ON DELETE CASCADE,
  choice_id TEXT NOT NULL REFERENCES mcq_choices (id) ON DELETE CASCADE,
  attempted_by TEXT NOT NULL REFERENCES users (id),
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_attempted_by ON mcq_attempts (attempted_by);
```

Notes:

- `is_correct` is stored as `INTEGER` (SQLite/D1 convention — `0`/`1`), same as any boolean column would be in this project.
- Exactly-one-correct-choice and 2–6-choices-per-question are **not** expressible as a plain SQL constraint across rows in SQLite without triggers; both are enforced in `mcq-service.ts`/the Zod schema, not the database. This mirrors the existing project convention of keeping validation in the service/schema layer (see `user-service.ts`'s uniqueness handling for the closest precedent, which *is* DB-enforced via a unique index — this case differs because it's a cross-row cardinality rule, not a per-row uniqueness rule).
- `position` (0-indexed) records display order; there is no reordering UI in this phase, but the column exists so choices don't silently reorder between saves.
- `ON DELETE CASCADE` requires `PRAGMA foreign_keys = ON`, which D1 enables by default — deleting an `mcqs` row removes its choices and attempts; deleting/replacing an `mcq_choices` row removes attempts referencing it (see Scope > Cut on attempt-history loss on edit).

### API Endpoints

#### GET /api/mcqs

**Response:**

- Success (200): `{ "mcqs": [{ "id", "name", "question", "createdBy", "createdAt", "updatedAt", "choiceCount" }] }` — list view only; no choice text/correctness, kept light for the table.
- Error (500): `{ "error": "message" }`

#### POST /api/mcqs

**Request Body:**

```json
{
  "name": "Photosynthesis basics",
  "question": "What gas do plants absorb during photosynthesis?",
  "createdBy": "3f9a...",
  "choices": [
    { "text": "Oxygen", "isCorrect": false },
    { "text": "Carbon dioxide", "isCorrect": true }
  ]
}
```

**Response:**

- Success (201): `{ "mcq": { "id", "name", "question", "createdBy", "createdAt", "updatedAt", "choices": [{ "id", "text", "isCorrect", "position" }] } }`
- Error (400): `{ "error": "message" }` — missing `name`/`question`/`createdBy`, fewer than 2 or more than 6 choices, zero or more than one choice marked correct, or any empty choice text
- Error (500): `{ "error": "Something went wrong. Please try again." }`

#### GET /api/mcqs/[id]

**Response:**

- Success (200): `{ "mcq": { "id", "name", "question", "createdBy", "createdAt", "updatedAt", "choices": [{ "id", "text", "isCorrect", "position" }] } }` — used by both the Edit form and the Preview page (see Scope > Cut on why there's no choice-blind variant)
- Error (404): `{ "error": "Question not found" }`
- Error (500): `{ "error": "message" }`

#### PUT /api/mcqs/[id]

**Request Body:** same shape as `POST /api/mcqs`, minus `createdBy` (immutable after creation).

**Response:**

- Success (200): same shape as `GET /api/mcqs/[id]`
- Error (400): same validation rules as create
- Error (404): `{ "error": "Question not found" }`
- Error (500): `{ "error": "message" }`

#### DELETE /api/mcqs/[id]

**Response:**

- Success (200): `{ "success": true }`
- Error (404): `{ "error": "Question not found" }`
- Error (500): `{ "error": "message" }`

#### POST /api/mcqs/[id]/attempts

**Request Body:**

```json
{
  "choiceId": "a1b2...",
  "attemptedBy": "3f9a..."
}
```

**Response:**

- Success (201): `{ "attempt": { "id", "mcqId", "choiceId", "attemptedBy", "isCorrect", "createdAt" } }`
- Error (400): `{ "error": "message" }` — missing fields, or `choiceId` does not belong to this `mcqId`
- Error (404): `{ "error": "Question not found" }`
- Error (500): `{ "error": "message" }`

### User Interface Requirements

#### MCQ List Page (/mcq)

- Server Component; fetches the list via `mcq-service.listMcqs()` directly (no self-call to its own API, per `.cursor/rules/nextjs.mdc`).
- shadcn `Table` with columns: **Name**, **Question**, **Actions**. `Question` text is truncated (`line-clamp` / `truncate`) so long prompts don't blow out row height.
- "Create Question" `Button` (top of page) linking to `/mcq/new`.
- Empty state ("No questions yet — create your first one.") when the list is empty.
- Actions column: an icon-only `Button` with the `MoreVertical` (lucide) icon opens a shadcn `DropdownMenu` with **Edit** (→ `/mcq/[id]/edit`), **Preview** (→ `/mcq/[id]/preview`), and **Delete**.
- Delete opens a shadcn `AlertDialog` ("Delete this question? This cannot be undone.") before calling `DELETE /api/mcqs/[id]`; on success, the list refreshes (`router.refresh()`).
- Logout button (existing, unchanged) stays on this page.

#### Create / Edit Page (/mcq/new, /mcq/[id]/edit)

- One shared client component (`McqForm`) rendered by two thin page wrappers — `/mcq/new` passes no initial data, `/mcq/[id]/edit` fetches the existing question server-side and passes it in.
- Fields: **Name** (`Input`), **Question** (`Textarea`), **Choices** (2 shown by default).
- Each choice row: a text `Input` for the choice text, and a `RadioGroup` (one shared group across all choice rows) to mark exactly one choice correct.
- "Add choice" button, disabled at 6 choices; a per-row "Remove" button, disabled when only 2 choices remain.
- Client-side validation before submit: `name` and `question` required, every visible choice's text required, exactly one choice marked correct.
- **Save**: reads `getCurrentUser()`; if missing, shows an inline "Please log in again" message instead of submitting. Otherwise `POST`s (create) or `PUT`s (edit) to `/api/mcqs`[`/[id]`], and on success redirects to `/mcq`. Server errors render inline via `FieldError`.
- **Cancel**: navigates back to `/mcq` without saving, no confirmation needed (no partial-save risk since nothing is submitted until Save).

#### Preview Page (/mcq/[id]/preview)

- Server Component fetches the question via `mcq-service.getMcqById()`, passes it to a client component (`McqPreview`).
- Renders the question text and all choices in a `RadioGroup`, with no indication of which is correct.
- "Submit Answer" button (disabled until a choice is picked): reads `getCurrentUser()` (same missing-user guard as the form), calls `POST /api/mcqs/[id]/attempts`, then reveals the result — "Correct!" or "Incorrect — the correct answer was: <choice text>" — using the response plus the already-fetched choice list.
- "Back to Questions" link to `/mcq`.

---

## Testing Strategy

Same TDD discipline as `register-login-logout_prd.md`, per `.cursor/skills/testing/SKILL.md`: for every phase, write the failing tests first, confirm they fail for the right reason, then implement until green.

- Colocate tests with their subject (`mcq-service.ts` → `mcq-service.test.ts`, etc.).
- Mock `getCloudflareContext`/`env.DB` at the module boundary in service tests — never touch real D1 in a unit test.
- Route handlers tested by calling `GET`/`POST`/`PUT`/`DELETE` directly with a constructed `Request`, mocking the service layer at the module boundary (same pattern as `.../auth/*/route.test.ts`).
- `client-identity.ts` tests exercise real `window.localStorage` (available under jsdom) rather than mocking it — it's a thin enough wrapper that mocking it would just test the mock.
- Client components (`McqForm`, `McqPreview`, the list's `DropdownMenu`/`AlertDialog` actions) render under `@testing-library/react` with mocked `fetch` and mocked `client-identity`, asserting on rendered DOM and on the request bodies sent — not on internal state.
- The migration gets a schema-contract test reading the raw `.sql` file, matching `migrations/create_users_table.test.ts`'s pattern.
- Server Components (`/mcq`, `/mcq/[id]/edit`, `/mcq/[id]/preview` page files) are not rendered directly; their data-fetching is covered by the service-layer tests, and the client components they render are tested in isolation, per the existing project convention (see `register-login-logout_prd.md`'s Testing Strategy).

---

## Implementation Phases

### Phase 1: Database Schema - COMPLETED

**Objective**: Add the three tables this feature is built on before any application code depends on them.

**Tasks**:

1. `npx wrangler d1 migrations create quiz-maker-db create_mcq_tables`.
2. Fill in the migration with `mcqs`, `mcq_choices`, `mcq_attempts` and their indexes (see Database Schema above).
3. Apply locally only: `npx wrangler d1 migrations apply quiz-maker-db --local`. Never `--remote`.

**Test Plan (Red → Green)**:

- `migrations/create_mcq_tables.test.ts`: reads every `.sql` file under `migrations/`, asserts the new file's text contains all three `CREATE TABLE` statements, every required column per table, the `ON DELETE CASCADE` foreign keys, and the four `CREATE INDEX` statements (29 assertions total).
- Red: written against the empty, freshly-generated migration stub.
- Green: passes once the migration SQL is filled in.

**Red (confirmed)**: `npm run test -- create_mcq_tables` failed 21 of 29 assertions against the empty `0002_create_mcq_tables.sql` stub (only the file-exists-and-is-readable path implicitly passed) — the right reason, since none of the three tables existed yet.

**Green (confirmed)**: After filling in the migration SQL, `npm run test -- create_mcq_tables` passed 29/29. Full suite (`npm run test`) passed 87/87 across 12 files, confirming no regression to Phases 1–5 of the previous PRD.

**Deliverables**:

- `migrations/0002_create_mcq_tables.sql` — done, and applied to the **local** D1 instance only (`npx wrangler d1 migrations apply quiz-maker-db --local`), verified afterward by querying `sqlite_master` directly — `mcqs`, `mcq_choices`, and `mcq_attempts` all present. Remote database untouched.
- `migrations/create_mcq_tables.test.ts` — done.
- `npm run lint` clean.

### Phase 2: Client Identity Persistence - COMPLETED

**Objective**: Give the app a (client-trusted) notion of "current user" to attribute `created_by`/`attempted_by`, without reopening the "no sessions" scope decision.

**Tasks**:

1. `src/lib/client-identity.ts` — `saveCurrentUser`, `getCurrentUser`, `clearCurrentUser` over `localStorage`.
2. Wire `saveCurrentUser` into `RegisterForm`/`LoginForm` right before their existing redirect to `/mcq`.
3. Wire `clearCurrentUser` into `LogoutButton` alongside its existing logout call.

**Test Plan (Red → Green)**:

- `src/lib/client-identity.test.ts`: `saveCurrentUser` then `getCurrentUser` round-trips the same object; `getCurrentUser` returns `null` when nothing is stored or the stored value is malformed JSON; `clearCurrentUser` makes a subsequent `getCurrentUser` return `null`; saving a second user overwrites rather than merges.
- Updated `register/page.test.tsx`/`login/page.test.tsx` assert `saveCurrentUser` is called with the response's `user` object on success, and **not** called on a failed request.
- Updated `mcq/page.test.tsx` (logout component) asserts `clearCurrentUser` is called on logout.
- Red: fails on missing `client-identity` module / unmet call assertions.
- Green: implemented and wired.

**Red (confirmed)**: `src/lib/client-identity.test.ts` failed to resolve `@/lib/client-identity` (module didn't exist). After implementing the module, the 3 new assertions added to `register/page.test.tsx`, `login/page.test.tsx`, and `mcq/page.test.tsx` failed for the right reason (`saveCurrentUser`/`clearCurrentUser` not yet called anywhere) while all pre-existing assertions in those same files still passed.

**Green (confirmed)**: After wiring `saveCurrentUser`/`clearCurrentUser` into the three components, `npm run test -- register/page login/page mcq/page` passed 14/14. Full suite (`npm run test`) passed 96/96 across 13 files. `npm run lint` and `npx tsc --noEmit` both clean.

**Deliverables**:

- `src/lib/client-identity.ts` + `.test.ts` — done.
- Updated `src/components/register-form.tsx`, `src/components/login-form.tsx`, `src/app/mcq/logout-button.tsx` — done, with their existing page-level tests (`register/page.test.tsx`, `login/page.test.tsx`, `mcq/page.test.tsx`) extended rather than replaced.
- `vitest.config.ts` — added `execArgv: ["--no-webstorage"]`, an unrelated environment fix required before any `localStorage`-based test could pass at all (see Troubleshooting Guide).

**Implementation notes**:

- `register-form.tsx` and `login-form.tsx` both now read the `user` object out of the success response body (previously discarded entirely) and pass it straight to `saveCurrentUser` before navigating — no new fetch call, just using data that was already being returned.
- Test mocks for `@/lib/client-identity` use `vi.hoisted()`, not a bare top-level `const mockFn = vi.fn()`. Vitest (unlike Jest) has no "name starts with `mock`" exemption from its hoisting rules — a factory that evaluates a mock reference immediately (e.g. `() => ({ saveCurrentUser: mockSaveCurrentUser })`) throws `ReferenceError: Cannot access '...' before initialization` unless that reference was itself declared via `vi.hoisted`. The pre-existing `pushMock` pattern in these same files only worked because it's read inside a deferred inner closure (`useRouter: () => ({ push: pushMock })`), not evaluated at factory-call time.

### Phase 3: MCQ and Attempt Service Layers - COMPLETED

**Objective**: Centralize all `mcqs`/`mcq_choices`/`mcq_attempts` data access, matching `user-service.ts`'s existing pattern.

**Tasks**:

1. `src/lib/schemas/mcq.ts` — Zod schema for the create/update payload: `name`, `question`, `choices` (array, length 2–6, each `{ text: string (non-empty), isCorrect: boolean }`, refined so exactly one `isCorrect` is `true`).
2. `src/lib/schemas/attempt.ts` — Zod schema for `{ choiceId, attemptedBy }`.
3. `src/lib/services/mcq-service.ts`:
   - `createMcq(input)` — inserts the `mcqs` row and its choices (in order, setting `position`), returns the full question with choices.
   - `listMcqs()` — returns summary rows with a `choiceCount` (via a join/count, not a second round trip per row).
   - `getMcqById(id)` — returns the full question with choices, or `undefined`.
   - `updateMcq(id, input)` — updates the `mcqs` row, deletes and re-inserts the choice set (see Scope > Cut on why this is a full replace, not a diff).
   - `deleteMcq(id)` — deletes the `mcqs` row (cascades to choices/attempts).
4. `src/lib/services/attempt-service.ts`:
   - `createAttempt(mcqId, input)` — validates `choiceId` belongs to `mcqId`, looks up that choice's `is_correct`, inserts the attempt row, returns it.

**Test Plan (Red → Green)**:

- `mcq.test.ts` / `attempt.test.ts`: schema accepts a valid payload; rejects 1 choice, 7 choices, zero correct choices, two correct choices, and an empty choice text.
- `mcq-service.test.ts` (mocked `env.DB`): `createMcq` inserts one `mcqs` row and N `mcq_choices` rows with the right `position`s; `listMcqs` returns every question with a correct `choiceCount`; `getMcqById` returns `undefined` for an unknown id; `updateMcq` removes prior choices and inserts the new set; `deleteMcq` calls `DB` with the question's id and never builds SQL by concatenation.
- `attempt-service.test.ts`: `createAttempt` returns `isCorrect: true`/`false` matching the chosen choice's stored `is_correct`; throws/returns an error when `choiceId` doesn't belong to the given `mcqId`.
- Red: fails on missing modules.
- Green: implemented to satisfy every case, including the negative/error paths.

**Red (confirmed)**: `npm run test -- schemas/mcq schemas/attempt` failed to resolve `@/lib/schemas/mcq` and `@/lib/schemas/attempt` (neither existed). After adding those, `npm run test -- services/mcq-service services/attempt-service` failed to resolve `@/lib/services/mcq-service` and `@/lib/services/attempt-service` — the right reason in both cases, since none of the four modules existed yet.

**Green (confirmed)**: Schemas: 16/16 passing. Services: 17/17 passing (after one self-correction — see Implementation notes below). Full suite (`npm run test`): 129/129 across 17 files. `npm run lint` and `npx tsc --noEmit` both clean.

**Deliverables**:

- `src/lib/schemas/mcq.ts` + `.test.ts`, `src/lib/schemas/attempt.ts` + `.test.ts` — done.
- `src/lib/services/mcq-service.ts` + `.test.ts`, `src/lib/services/attempt-service.ts` + `.test.ts` — done.

**Implementation notes**:

- `createMcq`/`updateMcq` insert/replace the question and its full choice set in a single `env.DB.batch([...])` call — one atomic round trip covering the `mcqs` row and every `mcq_choices` row, each using `INSERT ... RETURNING`/`UPDATE ... RETURNING` so the assembled response comes straight from what the database actually stored, with no second `SELECT` needed. `updateMcq`'s batch runs `UPDATE mcqs`, then `DELETE FROM mcq_choices WHERE mcq_id = ?1`, then one `INSERT ... RETURNING` per new choice, in that order — D1 batch statements execute sequentially within an implicit transaction, so the delete is guaranteed to complete before the inserts run.
- IDs for new `mcqs`/`mcq_choices`/`mcq_attempts` rows are generated in application code with `crypto.randomUUID()` rather than relying on each table's SQL `DEFAULT` — this is what makes the single-batch insert-with-`RETURNING` pattern possible (the choice rows' foreign key to the question is known before any statement runs), and `crypto.randomUUID()` is available in both the browser and the Workers runtime with no new dependency.
- `validateChoices()` in `mcq-service.ts` re-checks the 2–6-choices/exactly-one-correct/non-empty-text rules that `CreateMcqInputSchema`/`UpdateMcqInputSchema` already enforce, and throws before any `env.DB` call — defense-in-depth per the PRD's Important Notes, in case a future caller reaches the service without going through the Zod schema first.
- First test run of `listMcqs` failed with `env.DB.prepare(...).all is not a function` — the mock's `prepare()` only returned `{ bind }`, but `listMcqs`'s query has no placeholders and calls `.all()` directly on the prepared statement (a real D1 `PreparedStatement` supports both `.all()` and `.bind(...).all()`). Fixed by having the test's `mockPrepare` return both `bind` and `all`, matching the real API surface rather than narrowing the mock to only the shape earlier tests happened to use.
- `npm run lint` and `npx tsc --noEmit` are both clean (zero errors, zero warnings) as of this phase.

### Phase 4: API Endpoints - COMPLETED

**Objective**: Expose the service layer over HTTP for the client components built in later phases.

**Tasks**:

1. `src/app/api/mcqs/route.ts` — `GET` (list) and `POST` (create).
2. `src/app/api/mcqs/[id]/route.ts` — `GET`, `PUT`, `DELETE`.
3. `src/app/api/mcqs/[id]/attempts/route.ts` — `POST`.

**Test Plan (Red → Green)**:

- One `route.test.ts` per file, mocking `mcq-service`/`attempt-service` at the module boundary (same pattern as `api/auth/*/route.test.ts`): happy path returns the documented status/body; validation failure returns `400` without calling the service; unknown id returns `404`; unexpected thrown error returns `500` with no leaked internals.
- Red: fails on missing route files.
- Green: every documented status code in [API Endpoints](#api-endpoints) is covered and passes.

**Red (confirmed)**: `npm run test -- api/mcqs` failed to resolve `@/app/api/mcqs/[id]/route` and `@/app/api/mcqs/[id]/attempts/route` (neither file existed yet — the flat `src/app/api/mcqs/route.ts` had already been created together with its test, so that suite passed while the two dynamic-segment suites failed for the right reason: 0 tests collected, import resolution errors).

**Green (confirmed)**: After adding the two remaining route files, `npm run test -- api/mcqs` passed 23/23 across 3 files. Full suite (`npm run test`) passed 152/152 across 20 files. `npm run lint` clean. `npm run build` compiled successfully, passed `Running TypeScript` with no errors, and generated all three new routes as dynamic (`ƒ`) endpoints — `/api/mcqs`, `/api/mcqs/[id]`, `/api/mcqs/[id]/attempts` — alongside the existing `/api/auth/*` routes; the build process itself then crashed on exit with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c` (a Windows-specific Turbopack/libuv teardown bug, reproduced identically on two consecutive runs regardless of code changes — see Troubleshooting Guide).

**Deliverables**:

- `src/app/api/mcqs/route.ts` + `.test.ts`, `src/app/api/mcqs/[id]/route.ts` + `.test.ts`, `src/app/api/mcqs/[id]/attempts/route.ts` + `.test.ts` — done.

**Implementation notes**:

- All three route files follow the existing `api/auth/*/route.ts` shape exactly: `await request.json()` wrapped in try/catch → `400` on unparseable body; Zod `safeParse` → `400` with `issues[0]?.message` on validation failure; service call wrapped in try/catch mapping known error classes to their documented status codes, with a generic `500` message (never the raw `Error#message`) as the fallback.
- Next.js 16 route handlers receive dynamic segments as `{ params: Promise<{ id: string }> }`, not a plain object — every handler in `[id]/route.ts` and `[id]/attempts/route.ts` starts with `const { id } = await params;`.
- `POST /api/mcqs/[id]/attempts` calls `mcq-service.getMcqById(id)` before `attempt-service.createAttempt(id, ...)` specifically to produce the documented `404 Question not found` case. Without this check, an attempt against a nonexistent `mcqId` would instead surface as a `400` from `attempt-service`'s `ChoiceNotFoundError` (since `WHERE id = ?1 AND mcq_id = ?2` also fails to match when `?2` doesn't exist), which doesn't match the API contract's distinct 400 vs. 404 cases.

### Phase 5: shadcn Components - COMPLETED

**Objective**: Add the UI primitives this feature needs that aren't installed yet.

**Tasks**:

1. `npx shadcn@latest add @shadcn/dropdown-menu @shadcn/alert-dialog @shadcn/textarea @shadcn/radio-group`.
2. Confirm each renders under the existing `base-nova` style (spot-check, no behavior to unit-test in the generated primitives themselves).

**Test Plan (Red → Green)**: N/A — generated UI primitives, exercised indirectly through the component tests in Phases 6–7.

**Deliverables**:

- `src/components/ui/dropdown-menu.tsx`, `alert-dialog.tsx`, `textarea.tsx`, `radio-group.tsx` — done, all built on `@base-ui/react` (Menu/AlertDialog primitives) consistent with the project's existing Base UI components (`dialog.tsx`, `button.tsx`, etc.), no new npm dependency added (`@base-ui/react` was already a transitive install from the initial `base-nova` setup).

**Implementation notes**:

- The CLI reported `Skipped 1 file: button.tsx` — expected and harmless; `alert-dialog.tsx`'s generator re-emits a copy of the current `button.tsx` template to guarantee its `AlertDialogAction`/`AlertDialogCancel` composition works, and shadcn skips the write when the content is already identical to what's on disk.
- Running `npx tsc --noEmit` directly (not just relying on `npm run build`'s bundled TypeScript pass) surfaced a real, pre-existing type error in `src/app/api/mcqs/[id]/route.test.ts` from Phase 4: `{ ...existingMcq, ...validUpdateBody }` produced a `choices: { text, isCorrect }[]` that doesn't satisfy `Choice[]` (missing `id`/`position`). `npm run build`'s incremental TypeScript check (via `.next/cache/.tsbuildinfo`) did not catch this the first time Phase 4 was verified — worth remembering that `npm run build`'s typecheck is not a substitute for an occasional clean `npx tsc --noEmit` when verifying a phase. Fixed by mapping `validUpdateBody.choices` into full `Choice` shapes (`id`, `position`) before merging, matching the same pattern already used for `createdMcq` in `mcqs/route.test.ts`. No behavioral change — this only affected the mock's static type, not any assertion — confirmed via `npm run test` (152/152 still green) after the fix.

### Phase 6: MCQ List Page - COMPLETED

**Objective**: Replace the `/mcq` placeholder with a real, working question list.

**Tasks**:

1. `src/app/mcq/page.tsx` — Server Component: fetch via `mcq-service.listMcqs()`, render the `Table` + "Create Question" button + existing `LogoutButton`.
2. `src/app/mcq/mcq-row-actions.tsx` — client component: `DropdownMenu` (Edit/Preview/Delete) + `AlertDialog` delete confirmation + `DELETE` call + `router.refresh()`.

**Test Plan (Red → Green)**:

- `mcq-row-actions.test.tsx` (mocked `fetch`, mocked `router`): opening the menu shows all three actions; Edit/Preview navigate to the right href; clicking Delete opens the confirm dialog and does **not** call `fetch` until confirmed; confirming calls `DELETE /api/mcqs/[id]` and then refreshes.
- Red: fails on missing component.
- Green: implemented to satisfy each interaction.

**Red (confirmed)**: `npm run test -- mcq-row-actions` failed to resolve `@/app/mcq/mcq-row-actions` (module didn't exist) — the right reason, before any implementation existed.

**Green (confirmed, after two infra fixes — see Implementation notes and Troubleshooting Guide)**: `npm run test -- mcq-row-actions` passed 6/6. Full suite (`npm run test`) passed 157/157 across 21 files. `npm run lint` and `npx tsc --noEmit` both clean. `npm run build` compiled successfully with no crash this run (see Phase 4's Troubleshooting entry — the earlier libuv exit crash is intermittent, not deterministic); the route table shows `/mcq` as a static (`○`) route despite calling `listMcqs()` at build time, meaning it was successfully prerendered against the local D1 binding during `next build`.

**Deliverables**:

- `src/app/mcq/page.tsx` (rewritten as an async Server Component) — done.
- `src/app/mcq/mcq-row-actions.tsx` + `.test.tsx` — done.
- `src/app/mcq/logout-button.test.tsx` — done (see Implementation notes: relocated, not new, coverage).
- `src/app/mcq/page.test.tsx` — deleted (see Implementation notes).
- `vitest.setup.ts` (new) + `vitest.config.ts` (`test.setupFiles`) — done (see Troubleshooting Guide).

**Implementation notes**:

- `page.tsx` is now `export default async function McqPage()`, calling `await listMcqs()` directly (Server Component data fetching, per `.cursor/rules/nextjs.mdc` — no self-call to its own `/api/mcqs`). Per this PRD's Testing Strategy ("Server Components ... are not rendered directly"), it has no `page.test.tsx` of its own — an async Server Component can't be passed to RTL's `render()` without awaiting it manually and bypassing Next's actual rendering pipeline, which this project's convention avoids. Its behavior is covered by `mcq-service.test.ts` (data) and `mcq-row-actions.test.tsx`/`logout-button.test.tsx` (the two client islands it renders).
- The pre-existing `src/app/mcq/page.test.tsx` tested the old synchronous stub `McqPage` directly, including its Logout button interaction. Since `McqPage` is now async, that direct-render approach no longer applies. The Logout test case was **relocated** (not newly written) to a new `logout-button.test.tsx` that renders `<LogoutButton />` in isolation — same assertions, same mocks, just a new home now that the component it tests is no longer wrapped by a directly-testable page.
- `McqRowActions` controls its `AlertDialog`'s `open` state externally (`useState` + `open`/`onOpenChange`) rather than nesting an `AlertDialogTrigger` inside the `DropdownMenuItem`. This sidesteps a portal/unmount race: the dropdown menu closes (and unmounts its content) as soon as an item is clicked, which would tear down a nested trigger before it could hand off to the alert dialog. An external boolean survives that unmount cleanly.
- Composing shadcn's Base UI primitives with `next/link`'s `Link` uses the `render` prop (Base UI's polymorphic composition mechanism, not Radix's `asChild`): `<DropdownMenuItem render={<Link href={...} />}>Edit</DropdownMenuItem>` and `<Button render={<Link href="/mcq/new" />}>Create Question</Button>`. Confirmed via `BaseUIComponentProps` in `node_modules/@base-ui/react/internals/types.d.ts` that every Base UI primitive in this project (`Button`, `MenuItem`, `MenuTrigger`, etc.) supports `render` uniformly.

**Code Reference**: `src/app/mcq/mcq-row-actions.tsx`, `src/app/mcq/page.tsx`

### Phase 7: Create / Edit Page - COMPLETED

**Objective**: Let a teacher actually author a question.

**Tasks**:

1. `src/components/mcq-form.tsx` — shared client component per [User Interface Requirements](#create--edit-page-mcqnew-mcqidedit).
2. `src/app/mcq/new/page.tsx` — thin wrapper, `mode="create"`.
3. `src/app/mcq/[id]/edit/page.tsx` — Server Component fetching the question, `mode="edit"`.

**Test Plan (Red → Green)**:

- `mcq-form.test.tsx` (mocked `fetch`, mocked `client-identity`): starts with 2 choice rows; "Add choice" stops adding at 6; "Remove" stops removing at 2; submitting with no correct choice marked (or two marked) shows a validation error and never calls `fetch`; a valid submit calls `POST`/`PUT` with the expected body shape (including `createdBy` from the mocked identity); Cancel navigates to `/mcq` without calling `fetch`; a missing current user shows the "please log in again" message instead of submitting.
- Red: fails on missing component/pages.
- Green: every case above passes.

**Red (confirmed)**: `npm run test -- mcq-form` failed to resolve `@/components/mcq-form` (module didn't exist) — 0 tests collected, the right reason.

**Green (confirmed, after one test-only fix — see Implementation notes)**: `npm run test -- mcq-form` passed 8/8 (one more case than originally planned — added a dedicated edit-mode PUT assertion). Full suite (`npm run test`) passed 165/165 across 22 files. `npm run lint` and `npx tsc --noEmit` both clean. `npm run build` compiled successfully (exit 0); the route table shows `/mcq/new` as static and `/mcq/[id]/edit` as dynamic, as expected for a Server Component that fetches by `id`.

**Deliverables**:

- `src/components/mcq-form.tsx` + `.test.tsx` — done.
- `src/app/mcq/new/page.tsx` — done.
- `src/app/mcq/[id]/edit/page.tsx` — done.

**Implementation notes**:

- `McqForm` is a single client component handling both modes via a `mode: "create" | "edit"` prop plus an optional `mcqId`/`initialValues`. Create mode seeds two empty choices and sends `createdBy` (from `getCurrentUser()`) in the `POST /api/mcqs` body; edit mode is pre-seeded from the fetched `Mcq` and sends `PUT /api/mcqs/[id]` with no `createdBy` (immutable after creation, per the API contract).
- The radio group's value is the *array index* of the currently-correct choice (`String(index)`), not a stable id — choices in create mode have no id yet, and even in edit mode the PRD's Cut section already establishes that `PUT` replaces the whole choice set by position rather than diffing by id, so index-based selection is consistent with that model.
- First test run failed 2 of 8 on `toBeDisabled()` with `Invalid Chai property: toBeDisabled` — this project has no `@testing-library/jest-dom` installed (confirmed via a repo-wide search: zero matches for `jest-dom` or `toBeDisabled` outside this new test file), and per `AGENTS.md` ("ask before adding a dependency") this wasn't added silently. Fixed by asserting the native `HTMLButtonElement.disabled` property directly (`expect((button as HTMLButtonElement).disabled).toBe(true)`) instead, which needs no extra matcher library.
- `/mcq/[id]/edit/page.tsx` calls `notFound()` (from `next/navigation`) when `getMcqById` returns `undefined`, rather than rendering an inline error — consistent with Next.js App Router convention for a missing resource behind a dynamic segment.
- Per this PRD's Testing Strategy, neither `new/page.tsx` nor `[id]/edit/page.tsx` has its own test file: the former is a one-line wrapper with no logic, and the latter is a data-fetching Server Component whose only logic (`getMcqById` + the not-found branch) is already covered by `mcq-service.test.ts`; the `McqForm` it renders is tested in isolation.

**Code Reference**: `src/components/mcq-form.tsx`

### Phase 8: Preview / Self-Test Page - PLANNED

**Objective**: Let a teacher confirm a question behaves as intended and start generating real attempt data.

**Tasks**:

1. `src/components/mcq-preview.tsx` — client component per [User Interface Requirements](#preview-page-mcqidpreview).
2. `src/app/mcq/[id]/preview/page.tsx` — Server Component fetching the question.

**Test Plan (Red → Green)**:

- `mcq-preview.test.tsx` (mocked `fetch`, mocked `client-identity`): "Submit Answer" is disabled until a choice is picked; submitting calls `POST /api/mcqs/[id]/attempts` with the picked `choiceId` and the mocked current user's id; a mocked correct response shows "Correct!"; a mocked incorrect response names the correct choice; a missing current user shows the login message instead of submitting.
- Red: fails on missing component/page.
- Green: every case above passes.

**Deliverables**:

- `src/components/mcq-preview.tsx` + `.test.tsx`, `src/app/mcq/[id]/preview/page.tsx`.

### Phase 9: Manual Verification - PLANNED

**Objective**: Confirm the full loop works end-to-end against real local D1, the one thing Vitest's mocks can't prove.

**Tasks**:

1. `npm run test` green across every phase, no regressions.
2. `npm run preview` (real Workers runtime, since this touches D1 — see `AGENTS.md`).
3. Walkthrough: create a question with 3 choices → see it in the list → edit it to 4 choices, change the correct one → preview it, answer wrong, see "Incorrect", preview again, answer right, see "Correct" → delete it, confirm the dialog, confirm it's gone from the list and from `mcqs`/`mcq_choices`/`mcq_attempts` (cascade).
4. Verify validation: fewer than 2 choices, more than 6, zero/two correct choices are all rejected before hitting the database.

**Test Plan (Red → Green)**: No new automated tests — "green" means the full suite from every prior phase passes together plus a clean manual walkthrough.

**Deliverables**: Confirmed walkthrough notes added to Current Status below.

---

## Technical Implementation Details

### Key Files

- `migrations/000X_create_mcq_tables.sql` (+ `.test.ts`) - `mcqs`, `mcq_choices`, `mcq_attempts` and their indexes.
- `src/lib/client-identity.ts` (+ `.test.ts`) - client-trusted "current user" over `localStorage`; the only place `created_by`/`attempted_by` values come from.
- `src/lib/schemas/mcq.ts`, `src/lib/schemas/attempt.ts` (+ `.test.ts`) - Zod validation, including the 2–6/exactly-one-correct rules.
- `src/lib/services/mcq-service.ts`, `src/lib/services/attempt-service.ts` (+ `.test.ts`) - all `DB` access for these three tables; nothing else should query them directly.
- `src/app/api/mcqs/route.ts`, `.../[id]/route.ts`, `.../[id]/attempts/route.ts` (+ `route.test.ts`) - HTTP boundary.
- `src/app/mcq/page.tsx`, `src/app/mcq/mcq-row-actions.tsx` (+ `.test.tsx`) - list + actions dropdown.
- `src/components/mcq-form.tsx` (+ `.test.tsx`), `src/app/mcq/new/page.tsx`, `src/app/mcq/[id]/edit/page.tsx` - create/edit.
- `src/components/mcq-preview.tsx` (+ `.test.tsx`), `src/app/mcq/[id]/preview/page.tsx` - preview/self-test.

### Implementation Patterns

D1 access continues to follow `.cursor/rules/d1.mdc` — numbered placeholders, reading `results` rather than `first()`, access via `getCloudflareContext()`:

```typescript
const { env } = await getCloudflareContext({ async: true });
const { results } = await env.DB.prepare(
  "SELECT * FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position"
).bind(mcqId).all();
```

Client identity (`src/lib/client-identity.ts`):

```typescript
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
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function clearCurrentUser(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
```

### Important Notes

- Exactly-one-correct-choice and 2–6-choices are validated in the Zod schema and re-checked in the service layer — never trust the client-side form validation alone, since the API can be called directly.
- `updateMcq` replaces the entire choice set rather than diffing by id; this is a deliberate simplification (see Scope > Cut), not an oversight — do not "fix" it into a diff without checking whether attempt-history preservation has become a requirement.
- `created_by`/`attempted_by` are client-asserted, not server-verified — see [Client Identity](#client-identity-no-server-session). Do not build any permission/grading feature on top of these values without first adding real sessions.
- Keep all `mcqs`/`mcq_choices`/`mcq_attempts` access inside `mcq-service.ts`/`attempt-service.ts`. No component or route handler should call `env.DB` directly for these tables.

---

## Acceptance Criteria

- [ ] A teacher can create a question with a name, a question prompt, and 2–6 choices with exactly one marked correct, and it appears in the `/mcq` list.
- [ ] Creating a question with fewer than 2 choices, more than 6, zero correct choices, or more than one correct choice is rejected with a clear error before it reaches the database.
- [ ] A teacher can edit an existing question's name, question text, and choice set (including changing which choice is correct), and the changes are reflected in the list and on reload.
- [ ] A teacher can delete a question (after confirming), and it disappears from the list along with its choices and any attempts (cascade).
- [ ] The Actions dropdown on each row offers exactly Edit, Preview, and Delete, opened via a vertical-ellipsis icon button.
- [ ] Preview renders the question and choices without indicating which is correct, lets the previewer pick one and submit, and then clearly shows whether the pick was correct.
- [ ] Submitting a preview answer creates a row in `mcq_attempts` with the correct `mcq_id`, `choice_id`, `attempted_by`, and `is_correct`.
- [ ] `created_by` on a newly created question matches the id of whoever is currently logged in (per `client-identity`), and is empty/blocked with a clear message if no one is logged in.
- [ ] Every route handler validates its input with a Zod schema before touching a service.
- [ ] No SQL in either new service is built by string concatenation; all queries use bound, numbered placeholders.
- [ ] `npm run test` passes with the full Vitest suite green (schemas, both services, all four route files, and every new/updated component), no skipped or hollow tests.
- [ ] For every phase, the tests written for that phase were observed to fail (red) before the corresponding implementation existed.

---

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Create → list → edit → preview → delete loop | Works with zero manual workarounds | Manual walkthrough in Phase 9 |
| Invalid choice configurations (count, correctness) | 100% rejected before a DB write | Manual walkthrough + service-layer tests |
| Attempt accuracy | `is_correct` on every recorded attempt matches the chosen choice's stored `is_correct` | `attempt-service.test.ts` + manual spot-check against `mcq_attempts` |

---

## Dependencies

### External Dependencies

- None new. Continues to rely on Cloudflare D1 (already provisioned) and the Web Crypto/Zod stack already in place.

### Internal Dependencies

- **Cloudflare D1** (`quiz-maker-db`, already provisioned) - Phase 1 adds three tables to the existing binding; no new database or binding change.
- **Zod** (already installed) - schemas for MCQ/attempt payloads.
- **shadcn/ui** - `dropdown-menu`, `alert-dialog`, `textarea`, `radio-group` added in Phase 5, on top of the already-installed `table`, `button`, `card`, `field`, `input`, `label`, `badge`, `separator`, `dialog`.
- **`src/lib/client-identity.ts`** (new, this PRD) - depended on by the MCQ form, preview page, and the existing register/login/logout components.

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Client-asserted `created_by`/`attempted_by` can be spoofed by editing `localStorage`.
**Mitigation**: Documented explicitly as a known limitation (see Client Identity); no feature in this phase relies on it for anything security-sensitive — it's attribution only. Revisit before grading/permissions land.
- **Risk**: Full choice-set replacement on edit silently deletes attempt history tied to removed choices.
**Mitigation**: Documented as a deliberate Cut; cascade delete makes the behavior consistent (no orphaned rows) rather than leaving dangling references.
- **Risk**: SQLite/D1 can't enforce "exactly one correct choice" or "2–6 choices" at the schema level.
**Mitigation**: Enforced in both the Zod schema (client + route boundary) and re-checked in the service layer, so a direct API call can't bypass it via client-side validation alone.

### User Experience Risks

- **Risk**: A teacher who never logged in (per the previous phase's unguarded `/mcq`) can reach the create/preview pages with no current user to attribute.
**Mitigation**: Both pages check `getCurrentUser()` before submitting and show an explicit "please log in again" message rather than silently failing or sending a request with a missing/undefined id.
- **Risk**: Losing in-progress edits by clicking Cancel could frustrate a teacher mid-edit.
**Mitigation**: Explicitly out of scope for a "confirm before discard" dialog on Cancel in this phase — nothing is persisted until Save, so the risk is limited to re-typing, not data loss in the database.

---

## Troubleshooting Guide

### `window.localStorage` is `undefined` under jsdom (Node 24+)

**Problem**: The very first `client-identity.test.ts` run failed all 5 tests with `TypeError: Cannot read properties of undefined (reading 'clear')` on `window.localStorage.clear()` in `beforeEach` — `window.localStorage` itself was `undefined`, not just missing a method.
**Cause**: Node 24+ (this project runs on Node 26) ships its own native, global `localStorage` accessor (an experimental Web Storage API implementation) that is inert unless the process is started with `--localstorage-file <path>`; without that flag, reading `globalThis.localStorage` logs `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided` and evaluates to `undefined`. Vitest's jsdom environment normally copies jsdom's own working `Storage` implementation onto the test global (`populateGlobal`), but it skips any key that already exists on `globalThis` — and Node's native (if inert) `localStorage` accessor already occupies that key, so jsdom's real implementation never gets copied over. This is a known upstream Node/jsdom interaction (confirmed via web search — tracked as a Vitest/happy-dom/jsdom compatibility gap for Node ≥24), not specific to this project's code.
**Solution**: Added `execArgv: ["--no-webstorage"]` to the `test` block in `vitest.config.ts`. In Vitest 4, `execArgv` is a top-level `test` option (not nested under a removed `poolOptions`) and is passed to each worker's underlying Node process. `--no-webstorage` removes Node's native `localStorage` key from `globalThis` entirely (verified with `node --no-webstorage -e "console.log('localStorage' in globalThis)"` → `false`), which lets Vitest's jsdom `populateGlobal` step install the real, working `Storage` implementation instead. Config-only change; no new dependency, no test code affected. Verified via `node -e` probes on both Node 26 (`in globalThis` → `true`, broken) and with the flag (`in globalThis` → `false`, jsdom's own kicks in), then confirmed all 5 `client-identity.test.ts` cases pass and the full 96-test suite has no regressions.
**Code Reference**: `vitest.config.ts` (`test.execArgv`)

### `vi.mock` factory throws "Cannot access '...' before initialization"

**Problem**: After adding `vi.mock("@/lib/client-identity", () => ({ saveCurrentUser: mockSaveCurrentUser }))` (and the equivalent for `clearCurrentUser`) to three page test files, all three suites failed to even load, with `ReferenceError: Cannot access 'mockSaveCurrentUser' before initialization` — even after renaming the variable to start with `mock`, which is a Jest convention that doesn't apply here.
**Cause**: `vi.mock` calls are hoisted above all imports, and their factory function runs as soon as the mocked module is first imported anywhere in the dependency graph — which, because static imports are themselves hoisted, happens before any top-level `const` in the test file has executed. A factory that evaluates the mock reference immediately (`() => ({ saveCurrentUser: mockSaveCurrentUser })`) reads `mockSaveCurrentUser` while it's still in its temporal dead zone. The pre-existing `pushMock` pattern already in these files (for `next/navigation`) never hit this because `pushMock` is read inside a **nested, deferred** arrow function (`useRouter: () => ({ push: pushMock })`) that isn't actually called until component render time, by which point the module's top-level code has finished running.
**Solution**: Declared the mock functions with `vi.hoisted()` instead of a bare top-level `const`, e.g. `const { mockSaveCurrentUser } = vi.hoisted(() => ({ mockSaveCurrentUser: vi.fn() }));`, so the declaration itself is hoisted alongside the `vi.mock` call and is already initialized by the time the factory runs.
**Code Reference**: `src/app/register/page.test.tsx`, `src/app/login/page.test.tsx`, `src/app/mcq/page.test.tsx`

### Base UI popups (`DropdownMenu`, `AlertDialog`, `Dialog`) never open under jsdom

**Problem**: The first `mcq-row-actions.test.tsx` run failed all 6 tests — clicking the trigger button never flipped `aria-expanded` to `"true"` and no menu content ever appeared in the DOM, with no thrown error printed anywhere.
**Cause**: Two independent issues, both environment-level, not component bugs:
  1. jsdom does not implement `ResizeObserver` at all (`typeof window.ResizeObserver === "undefined"`, confirmed via a standalone `node -e` probe), which Base UI's floating-element positioning depends on.
  2. Base UI's `useClick` interaction (`floating-ui-react/hooks/useClick.js`) opens the menu from `onMouseDown`, but wraps the actual `store.setOpen(...)` call in `frame.request(() => ...)` — a `requestAnimationFrame` callback — "to avoid `:focus-visible` from appearing when using a pointer" (per its own comment). That callback fires on jsdom's real (timer-based) rAF polyfill, but strictly *after* `userEvent.click()`'s returned promise has already resolved. A test that asserts immediately after `await user.click(...)` runs one tick too early.
**Solution**:
  1. Added `vitest.setup.ts` with a minimal `ResizeObserver` stub (`observe`/`unobserve`/`disconnect` as no-ops), registered via `vitest.config.ts`'s new `test.setupFiles`. This is a project-wide fix — every future test that opens any Base UI popup (`Dialog`, `AlertDialog`, `DropdownMenu`, etc.) needs this and now gets it automatically.
  2. Changed every "is the menu/dialog open yet" assertion to use `findByRole`/`findByText` (which poll via `waitFor` under the hood) instead of `getByRole`/`getByText` immediately after a click. This isn't a workaround for a test-only quirk — it reflects the component's real, one-frame-delayed opening behavior, so `findBy*` is the *correct* way to assert it, in tests and not just as a jsdom accommodation.
**Code Reference**: `vitest.setup.ts`, `vitest.config.ts` (`test.setupFiles`), `src/app/mcq/mcq-row-actions.test.tsx` (`openMenu()` helper)

### `npm run build` crashes on exit with a libuv assertion (Windows)

**Problem**: `npm run build` compiles successfully, passes `Running TypeScript` with zero errors, and prints the full route manifest (including all three new `/api/mcqs*` routes as dynamic) — but the process then exits with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94` and a non-zero exit code, after all meaningful build output has already been printed.
**Cause**: A Windows-specific libuv/Turbopack process-teardown bug — reproduced identically across two consecutive `npm run build` runs during Phase 4 with no code changes in between, occurring strictly after "Finalizing page optimization" completes and the route table is printed. **Update (Phase 6)**: a later `npm run build` run (also on Windows, no code path related to the crash changed) exited `0` with no crash at all, confirming this is intermittent rather than deterministic — likely a timing-dependent teardown race, not something tied to any particular code change. Not related to this phase's code; the build artifact itself (route manifest, TypeScript check) is correct before the crash whenever it does occur.
**Solution**: None applied — documenting rather than working around, since the build output before the crash is complete and correct, and this project's working agreement is to run `npm run preview` (the real Workers runtime) for anything runtime-sensitive rather than relying on `next build`'s exit code alone. Treat a non-zero exit here as inconclusive on its own — check whether the route manifest and "Finished TypeScript" both printed successfully before treating the build as failed. If this crash blocks a real deploy pipeline in the future, revisit with an updated Next.js/Turbopack version.
**Code Reference**: N/A — environment/tooling issue, not a code change.

---

## Notes for AI Agents

1. Read Overview/Problem and Hypothesis first — this phase is full MCQ CRUD plus a self-test/attempt-recording flow; it does **not** include grading, analytics, or any student-facing role.
2. Respect Scope strictly. In particular, do **not** add real sessions/cookies, route guards, multi-select correctness, or attempt-history preservation across edits — these are deliberate cuts, not gaps to fill in silently. If any of them turn out to be necessary, raise it with the user rather than quietly expanding scope.
3. Follow the TDD loop in [Testing Strategy](#testing-strategy) for every phase: write that phase's tests first, run `npm run test` and observe them fail for the right reason, then implement until green. Do not backfill tests after the fact.
4. Never write a test that cannot fail. If a case is genuinely hard to assert on, say so instead of faking coverage.
5. Keep all `mcqs`/`mcq_choices`/`mcq_attempts` access inside `mcq-service.ts`/`attempt-service.ts` — no component or route handler should call `env.DB` directly.
6. `created_by`/`attempted_by` come from `src/lib/client-identity.ts` only. Do not invent a second way to determine "the current user."
7. This PRD assumes `zod`, D1, and Vitest are already installed/configured from the previous phase — no new external dependency is expected; if one turns out to be needed, ask before installing, per `AGENTS.md`.
8. Update phase status markers and the Current Status section as work progresses, including whether each phase's tests are currently red or green.
9. Never run `npm run deploy` or any `--remote` D1/wrangler command without being explicitly asked, per `AGENTS.md` and the incident logged in `register-login-logout_prd.md`'s Troubleshooting Guide.

---

## Current Status

**Last Updated**: September 2, 2026
**Current Phase**: Phases 1–7 - COMPLETED. Phases 8–9 - PLANNED.
**Status**: IN PROGRESS.
**D1 database**: `quiz-maker-db` (existing binding `DB`). Migration `0002_create_mcq_tables.sql` applied to the **local** instance only; remote is untouched.
**Test suite**: 165/165 passing across 22 files. `npm run lint` and `npx tsc --noEmit` both clean. `npm run build` compiles and typechecks cleanly.
**Next Steps**: Phase 8 — the `McqPreview` client component and its `/mcq/[id]/preview` page, wiring up the self-test/attempt-recording flow.
