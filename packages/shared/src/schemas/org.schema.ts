import { z } from 'zod';

export const updateOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
