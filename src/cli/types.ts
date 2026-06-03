import { z } from 'zod';

export const TaskInputSchema = z.object({
  goal: z.string(),
  url: z.string().url(),
  parameters: z.record(z.string(), z.unknown()).optional()
});

export type TaskInput = z.infer<typeof TaskInputSchema>;
