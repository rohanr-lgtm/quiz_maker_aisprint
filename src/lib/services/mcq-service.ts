import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * All access to `mcqs`/`mcq_choices` lives in this module — no component or
 * route handler should call `env.DB` directly for these tables (see
 * `.cursor/rules/d1.mdc`).
 */

export type ChoiceInput = {
  text: string;
  isCorrect: boolean;
};

export type CreateMcqInput = {
  name: string;
  question: string;
  createdBy: string;
  choices: ChoiceInput[];
};

export type UpdateMcqInput = {
  name: string;
  question: string;
  choices: ChoiceInput[];
};

export type Choice = {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
};

export type Mcq = {
  id: string;
  name: string;
  question: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  choices: Choice[];
};

export type McqSummary = {
  id: string;
  name: string;
  question: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  choiceCount: number;
};

type McqRow = {
  id: string;
  name: string;
  question: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type ChoiceRow = {
  id: string;
  mcq_id: string;
  choice_text: string;
  is_correct: number;
  position: number;
};

type McqSummaryRow = McqRow & { choice_count: number };

export class InvalidChoicesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChoicesError";
  }
}

export class McqNotFoundError extends Error {
  constructor(message = "Question not found") {
    super(message);
    this.name = "McqNotFoundError";
  }
}

/**
 * Defense-in-depth: the same 2-6/exactly-one-correct rule already enforced by
 * `CreateMcqInputSchema`/`UpdateMcqInputSchema`, re-checked here since this
 * service is the last line of defense before a write reaches the database.
 */
function validateChoices(choices: ChoiceInput[]): void {
  if (choices.length < 2 || choices.length > 6) {
    throw new InvalidChoicesError("A question must have between 2 and 6 choices");
  }
  const correctCount = choices.filter((choice) => choice.isCorrect).length;
  if (correctCount !== 1) {
    throw new InvalidChoicesError("Exactly one choice must be marked correct");
  }
  if (choices.some((choice) => choice.text.trim().length === 0)) {
    throw new InvalidChoicesError("Every choice must have text");
  }
}

function toChoice(row: ChoiceRow): Choice {
  return {
    id: row.id,
    text: row.choice_text,
    isCorrect: Boolean(row.is_correct),
    position: row.position,
  };
}

function toMcq(mcqRow: McqRow, choiceRows: ChoiceRow[]): Mcq {
  return {
    id: mcqRow.id,
    name: mcqRow.name,
    question: mcqRow.question,
    createdBy: mcqRow.created_by,
    createdAt: mcqRow.created_at,
    updatedAt: mcqRow.updated_at,
    choices: choiceRows.map(toChoice),
  };
}

function toMcqSummary(row: McqSummaryRow): McqSummary {
  return {
    id: row.id,
    name: row.name,
    question: row.question,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    choiceCount: row.choice_count,
  };
}

const MCQ_COLUMNS = "id, name, question, created_by, created_at, updated_at";
const CHOICE_COLUMNS = "id, mcq_id, choice_text, is_correct, position";

export async function createMcq(input: CreateMcqInput): Promise<Mcq> {
  validateChoices(input.choices);

  const { env } = await getCloudflareContext({ async: true });
  const mcqId = crypto.randomUUID();

  const mcqStatement = env.DB.prepare(
    `INSERT INTO mcqs (id, name, question, created_by)
     VALUES (?1, ?2, ?3, ?4)
     RETURNING ${MCQ_COLUMNS}`
  ).bind(mcqId, input.name, input.question, input.createdBy);

  const choiceStatements = input.choices.map((choice, index) =>
    env.DB.prepare(
      `INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position)
       VALUES (?1, ?2, ?3, ?4, ?5)
       RETURNING ${CHOICE_COLUMNS}`
    ).bind(crypto.randomUUID(), mcqId, choice.text, choice.isCorrect ? 1 : 0, index)
  );

  const [mcqResult, ...choiceResults] = (await env.DB.batch([
    mcqStatement,
    ...choiceStatements,
  ])) as { results: (McqRow | ChoiceRow)[] }[];

  const mcqRow = mcqResult.results[0] as McqRow | undefined;
  if (!mcqRow) {
    throw new Error("Insert did not return the created question");
  }
  const choiceRows = choiceResults.map((result) => result.results[0] as ChoiceRow);

  return toMcq(mcqRow, choiceRows);
}

export async function listMcqs(): Promise<McqSummary[]> {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.name, m.question, m.created_by, m.created_at, m.updated_at,
            COUNT(c.id) AS choice_count
     FROM mcqs m
     LEFT JOIN mcq_choices c ON c.mcq_id = m.id
     GROUP BY m.id
     ORDER BY m.created_at DESC`
  ).all<McqSummaryRow>();

  return results.map(toMcqSummary);
}

export async function getMcqById(id: string): Promise<Mcq | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const { results: mcqResults } = await env.DB.prepare("SELECT * FROM mcqs WHERE id = ?1")
    .bind(id)
    .all<McqRow>();

  const mcqRow = mcqResults[0];
  if (!mcqRow) {
    return undefined;
  }

  const { results: choiceRows } = await env.DB.prepare(
    "SELECT * FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position"
  )
    .bind(id)
    .all<ChoiceRow>();

  return toMcq(mcqRow, choiceRows);
}

export async function updateMcq(id: string, input: UpdateMcqInput): Promise<Mcq> {
  validateChoices(input.choices);

  const { env } = await getCloudflareContext({ async: true });

  const mcqStatement = env.DB.prepare(
    `UPDATE mcqs SET name = ?1, question = ?2, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?3
     RETURNING ${MCQ_COLUMNS}`
  ).bind(input.name, input.question, id);

  const deleteChoicesStatement = env.DB.prepare(
    "DELETE FROM mcq_choices WHERE mcq_id = ?1"
  ).bind(id);

  const choiceStatements = input.choices.map((choice, index) =>
    env.DB.prepare(
      `INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position)
       VALUES (?1, ?2, ?3, ?4, ?5)
       RETURNING ${CHOICE_COLUMNS}`
    ).bind(crypto.randomUUID(), id, choice.text, choice.isCorrect ? 1 : 0, index)
  );

  const [mcqResult, , ...choiceResults] = (await env.DB.batch([
    mcqStatement,
    deleteChoicesStatement,
    ...choiceStatements,
  ])) as { results: (McqRow | ChoiceRow)[] }[];

  const mcqRow = mcqResult.results[0] as McqRow | undefined;
  if (!mcqRow) {
    throw new McqNotFoundError();
  }
  const choiceRows = choiceResults.map((result) => result.results[0] as ChoiceRow);

  return toMcq(mcqRow, choiceRows);
}

export async function deleteMcq(id: string): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare("DELETE FROM mcqs WHERE id = ?1 RETURNING id")
    .bind(id)
    .all<{ id: string }>();

  if (!results[0]) {
    throw new McqNotFoundError();
  }
}
