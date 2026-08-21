import { z } from 'zod';

const nullableText = (maximum: number) => z.union([z.string().trim().max(maximum), z.null()])
  .transform((value) => value || null);

export const clientProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: nullableText(200),
  taxId: nullableText(32),
  contactName: nullableText(160),
  email: z.union([z.email().max(320), z.literal(''), z.null()]).transform((value) => value || null),
  phone: nullableText(32),
  address: z.object({
    street: z.string().trim().max(160),
    number: z.string().trim().max(32).optional(),
    complement: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120),
    state: z.string().trim().max(32),
    postalCode: z.string().trim().max(24),
    country: z.string().trim().max(80),
  }).nullable(),
  observations: nullableText(4000),
}).strict();
