import { z } from 'zod';

// Tool input/output schema

// Plain object schemas for MCP SDK compatibility
export const CreateCardInputMCPSchema = {
  datashape: z.string(),
  data: z.any(),
  tags: z.array(z.string()).optional(),
  elo: z.number().optional(),
  sourceRef: z.string().optional(),
};

// Zod schemas for runtime validation
export const CreateCardInputSchema = z.object(CreateCardInputMCPSchema);

export type CreateCardInput = z.infer<typeof CreateCardInputSchema>;

export interface CreateCardOutput {
  cardId: string;
  initialElo: number;
  created: boolean;
}

export const UpdateCardInputMCPSchema = {
  cardId: z.string(),
  data: z.any().optional(),
  tags: z.array(z.string()).optional(),
  elo: z.number().optional(),
  sourceRef: z.string().optional(),
};
// Update Card Tool
export const UpdateCardInputSchema = z.object(UpdateCardInputMCPSchema);

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

export const TagCardInputMCPSchema = {
  cardId: z.string(),
  action: z.enum(['add', 'remove']),
  tags: z.array(z.string()),
  updateELO: z.boolean().optional().default(false),
};

// Tag Card Tool
export const TagCardInputSchema = z.object(TagCardInputMCPSchema);

export type TagCardInput = z.infer<typeof TagCardInputSchema>;

export interface TagCardOutput {
  cardId: string;
  action: string;
  tagsProcessed: string[];
  success: boolean;
  currentTags: string[];
}

export const DeleteCardInputMCPSchema = {
  cardId: z.string(),
  confirm: z.boolean().default(false),
  reason: z.string().optional(),
};

// Delete Card Tool
export const DeleteCardInputSchema = z.object(DeleteCardInputMCPSchema);

export type DeleteCardInput = z.infer<typeof DeleteCardInputSchema>;

export interface DeleteCardOutput {
  cardId: string;
  deleted: boolean;
  message: string;
}
