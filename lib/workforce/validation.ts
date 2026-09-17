import { z } from 'zod';

const optionalText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform((value) => value || null);
const optionalUpdateText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform((value) => value === '' ? null : value);
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
export const allocationUpdateSchema = z.object({
  employeeId: z.uuid(), mode: z.enum(['replace', 'stage', 'end']), effectiveDate: z.iso.date(),
  currentEndDate: z.union([z.iso.date(), z.literal(''), z.null()]).optional().transform((value) => value || undefined),
  clientId: z.union([z.uuid(), z.literal(''), z.null()]).optional().transform((value) => value || undefined),
  managerUserId: z.union([z.uuid(), z.literal(''), z.null()]).optional().transform((value) => value || undefined),
  roleTitle: optionalUpdateText(160), endDate: z.union([z.iso.date(), z.literal(''), z.null()]).optional().transform((value) => value === '' ? null : value),
  contractType: z.string().trim().max(80).optional(), financialRateCents: z.number().int().positive().max(100_000_000).optional(),
  commercialRateCents: z.number().int().positive().max(100_000_000).optional(), observations: optionalUpdateText(2000),
}).strict();
