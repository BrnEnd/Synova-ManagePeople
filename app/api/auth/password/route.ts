import { z } from 'zod';
import { getCurrentIdentity, getIdentityModule } from '@/lib/identity/server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: 'A nova senha deve ser diferente da atual.',
  path: ['newPassword'],
});

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: 'Não autorizado.' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = passwordSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: 'A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
    }, { status: 422 });
  }

  try {
    await getIdentityModule().changePassword({ identity, ...parsed.data });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Senha atual inválida.' }, { status: 400 });
  }
}
