import { z } from "zod";

export const AttemptInputSchema = z.object({
  choiceId: z.string().trim().min(1, "choiceId is required"),
  attemptedBy: z.string().trim().min(1, "attemptedBy is required"),
});

export type AttemptInput = z.infer<typeof AttemptInputSchema>;
