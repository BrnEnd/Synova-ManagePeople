import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/auth/password-form';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function ChangePasswordPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  const destination = identity.role === 'manager' ? '/gestao' : '/portal';
  if (!identity.mustChangePassword) redirect(destination);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <PasswordForm destination={destination} displayName={identity.displayName} />
    </main>
  );
}
