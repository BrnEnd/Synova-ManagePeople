import Link from 'next/link';
import { LogoutButton } from '@/components/auth/logout-button';

type ManagementHeaderProps = {
  displayName: string;
  tenantSlug: string;
  active: 'dashboard' | 'employees' | 'clients';
};

const navigation = [
  { id: 'dashboard', href: '/gestao', label: 'Visão geral' },
  { id: 'employees', href: '/gestao/funcionarios', label: 'Funcionários' },
  { id: 'clients', href: '/gestao/clientes', label: 'Clientes' },
] as const;

export function ManagementHeader({ displayName, tenantSlug, active }: ManagementHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-zinc-950/85 px-5 backdrop-blur md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
        <div>
          <p className="font-black tracking-[-0.03em] text-white">Synova <span className="text-orange-400">Pessoas</span></p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">{tenantSlug}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-bold text-zinc-300 sm:block">{displayName}</span>
          <LogoutButton />
        </div>
        <nav aria-label="Gestão" className="order-3 flex w-full gap-1 border-t border-white/8 pt-3">
          {navigation.map((item) => (
            <Link
              aria-current={active === item.id ? 'page' : undefined}
              className={`pressable rounded-full px-4 py-2 text-sm font-bold ${
                active === item.id ? 'bg-white text-zinc-950' : 'text-zinc-400'
              }`}
              href={item.href}
              key={item.id}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
