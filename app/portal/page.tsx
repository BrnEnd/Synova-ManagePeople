import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function EmployeePortalPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'employee') redirect('/gestao');

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Portal do Funcionário</p><h1 className="mt-3 text-3xl font-black text-white">Olá, {identity.displayName}</h1></div><LogoutButton /></div>
        <p className="mt-4 text-zinc-400">Sua identidade está vinculada ao tenant <strong className="text-zinc-200">{identity.tenantSlug}</strong>. Perfil e competências entram na próxima fatia.</p>
      </section>
    </main>
  );
}
