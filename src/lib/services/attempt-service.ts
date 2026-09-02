import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * All access to `mcq_attempts` lives in this module — no component or route
 * handler should call `env.DB` directly (see `.cursor/rules/d1.mdc`).
 */

export type CreateAttemptInput = {
  choiceId: string;
  attemptedBy: string;
};

export type Attempt = {
  id: string;
  mcqId: string;
  choiceId: string;
  attemptedBy: string;
  isCorrect: boolean;
  createdAt: string;
};

type AttemptRow = {
  id: string;
  mcq_id: string;
  choice_id: string;
  attempted_by: string;
  is_correct: number;
  created_at: string;
};

export class ChoiceNotFoundError extends Error {
  constructor(message = "Choice does not belong to this question") {
    super(message);
    this.name = "ChoiceNotFoundError";
  }
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    choiceId: row.choice_id,
    attemptedBy: row.attempted_by,
    isCorrect: Boolean(row.is_correct),
    createdAt: row.created_at,
  };
}

export async function createAttempt(
  mcqId: string,
  input: CreateAttemptInput
): Promise<Attempt> {
  const { env } = await getCloudflareContext({ async: true });

  const { results: choiceResults } = await env.DB.prepare(
    "SELECT is_correct FROM mcq_choices WHERE id = ?1 AND mcq_id = ?2"
  )
    .bind(input.choiceId, mcqId)
    .all<{ is_correct: number }>();

  const choice = choiceResults[0];
  if (!choice) {
    throw new ChoiceNotFoundError();
  }

  const isCorrect = Boolean(choice.is_correct);
  const attemptId = crypto.randomUUID();

  const { results } = await env.DB.prepare(
    `INSERT INTO mcq_attempts (id, mcq_id, choice_id, attempted_by, is_correct)
     VALUES (?1, ?2, ?3, ?4, ?5)
     RETURNING id, mcq_id, choice_id, attempted_by, is_correct, created_at`
  )
    .bind(attemptId, mcqId, input.choiceId, input.attemptedBy, isCorrect ? 1 : 0)
    .all<AttemptRow>();

  const row = results[0];
  if (!row) {
    throw new Error("Insert did not return the created attempt");
  }

  return toAttempt(row);
}
