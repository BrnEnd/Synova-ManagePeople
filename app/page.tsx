import { redirect } from 'next/navigation';
import { identityDestination } from '@/lib/identity/destination';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function HomePage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  redirect(identityDestination(identity));
}
