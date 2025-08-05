import { z } from 'zod';

// Tool input/output schema

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

// Update Card Tool
export const UpdateCardInputSchema = z.object({
  cardId: z.string(),
  data: z.any().optional(),
  tags: z.array(z.string()).optional(),
  elo: z.number().optional(),
  sourceRef: z.string().optional(),
});

export type UpdateCardInput = z.infer<typeof UpdateCardInputSchema>;

export interface UpdateCardOutput {
  cardId: string;
  updated: boolean;
  changes: {
    data?: boolean;
    tags?: boolean;
    elo?: boolean;
    sourceRef?: boolean;
  };
}

// Tag Card Tool
export const TagCardInputSchema = z.object({
  cardId: z.string(),
  action: z.enum(['add', 'remove']),
  tags: z.array(z.string()),
  updateELO: z.boolean().optional().default(false),
});

export type TagCardInput = z.infer<typeof TagCardInputSchema>;

export interface TagCardOutput {
  cardId: string;
  action: string;
  tagsProcessed: string[];
  success: boolean;
  currentTags: string[];
}

// Delete Card Tool
export const DeleteCardInputSchema = z.object({
  cardId: z.string(),
  confirm: z.boolean().default(false),
  reason: z.string().optional(),
});

export type DeleteCardInput = z.infer<typeof DeleteCardInputSchema>;

export interface DeleteCardOutput {
  cardId: string;
  deleted: boolean;
  message: string;
}
