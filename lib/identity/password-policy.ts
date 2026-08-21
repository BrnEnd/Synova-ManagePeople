import { z } from 'zod';

export const strongPasswordSchema = z.string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^a-zA-Z0-9]/);

export const strongPasswordMessage = 'A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.';
