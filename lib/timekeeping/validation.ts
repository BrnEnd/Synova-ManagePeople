import { z } from 'zod';
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const timeEntrySchema = z.object({
  workDate: z.iso.date(), minutes: z.number().int().min(1).max(1440),
  observation: z.union([z.string().trim().max(1000), z.null()]).optional().transform((value) => value || null),
}).strict();
