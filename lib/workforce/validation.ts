import { z } from 'zod';

const optionalText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform((value) => value || null);
export const contractSchema = z.object({
  contractType: z.string().trim().min(2).max(80), startDate: z.iso.date(),
  endDate: z.union([z.iso.date(), z.literal(''), z.null()]).optional().transform((value) => value || null),
  documentId: z.union([z.uuid(), z.literal(''), z.null()]).optional().transform((value) => value || null),
  observations: optionalText(2000),
}).strict();
export const allocationSchema = z.object({
  clientId: z.uuid(), managerUserId: z.uuid(), roleTitle: optionalText(160), startDate: z.iso.date(),
  endDate: z.union([z.iso.date(), z.literal(''), z.null()]).optional().transform((value) => value || null),
  observations: optionalText(2000),
}).strict();
export const rateConditionSchema = z.object({
  hourlyRateCents: z.number().int().positive().max(100_000_000), effectiveFrom: z.iso.date(), observations: optionalText(2000),
}).strict();
export const endPeriodSchema = z.object({ endDate: z.iso.date() }).strict();
