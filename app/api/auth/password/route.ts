import { z } from 'zod';
import { InvalidCurrentPasswordError } from '@/lib/identity/module';
import { strongPasswordMessage, strongPasswordSchema } from '@/lib/identity/password-policy';
import { getCurrentIdentity, getIdentityModule } from '@/lib/identity/server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
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
      error: strongPasswordMessage,
    }, { status: 422 });
  }

  try {
    await getIdentityModule().changePassword({ identity, ...parsed.data });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidCurrentPasswordError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Falha ao alterar senha:', error);
    return Response.json({ error: 'Não foi possível alterar a senha.' }, { status: 500 });
  }
}
