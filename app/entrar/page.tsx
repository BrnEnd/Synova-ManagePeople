import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function LoginPage() {
  const identity = await getCurrentIdentity();
  if (identity) redirect(identity.mustChangePassword ? '/alterar-senha' : identity.role === 'manager' ? '/gestao' : '/portal');

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
      <section className="hidden border-r border-white/10 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-2xl pb-[12vh]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Portal de funcionários</p>
          <h1 className="mt-5 text-5xl font-black leading-[1.04] tracking-[-0.04em] text-white xl:text-6xl">
            Da competência ao pagamento, tudo em um só lugar.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            Gestão operacional, documentos e histórico financeiro com segurança desde o primeiro acesso.
          </p>
        </div>
        <p className="text-sm text-zinc-600">Uso interno Synova</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="text-xl font-black tracking-[-0.03em] text-white">
      Synova <span className="text-orange-400">Pessoas</span>
    </div>
  );
}
