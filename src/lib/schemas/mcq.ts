import { z } from "zod";

/**
 * A question has 2-6 choices with exactly one marked correct (single-select,
 * radio-button style) - see mcq-crud_prd.md's "Cut" section for why multi-select
 * is out of scope. This is re-checked defensively in `mcq-service.ts` as well,
 * since the API can be called directly without going through this schema.
 */
const ChoiceInputSchema = z.object({
  text: z.string().trim().min(1, "Choice text is required"),
  isCorrect: z.boolean(),
});

const ChoicesSchema = z
  .array(ChoiceInputSchema)
  .min(2, "A question needs at least 2 choices")
  .max(6, "A question can have at most 6 choices")
  .refine(
    (choices) => choices.filter((choice) => choice.isCorrect).length === 1,
    "Exactly one choice must be marked correct"
  );

export const UpdateMcqInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  question: z.string().trim().min(1, "Question is required"),
  choices: ChoicesSchema,
});

export type UpdateMcqInput = z.infer<typeof UpdateMcqInputSchema>;

export const CreateMcqInputSchema = UpdateMcqInputSchema.extend({
  createdBy: z.string().trim().min(1, "createdBy is required"),
});

export type CreateMcqInput = z.infer<typeof CreateMcqInputSchema>;
