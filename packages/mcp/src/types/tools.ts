import { z } from 'zod';

// Tool input/output schemas - will be expanded in Phase 2
export const CreateCardInputSchema = z.object({
  datashape: z.string(),
  // individual datashapes define their own schema
  data: z.any(),
  tags: z.array(z.string()).optional(),
  elo: z.number().optional(),
  sourceRef: z.string().optional(),
});

export type CreateCardInput = z.infer<typeof CreateCardInputSchema>;

export interface CreateCardOutput {
  cardId: string;
  initialElo: number;
  created: boolean;
}
