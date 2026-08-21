import { redirect } from 'next/navigation';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function HomePage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  redirect(identity.role === 'manager' ? '/gestao' : '/portal');
}
