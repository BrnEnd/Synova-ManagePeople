import Link from 'next/link';
import type { ManagementScope } from '@/lib/management/scope';

export function ScopeToggle({ scope, basePath, suffix = '', label = 'Escopo das horas' }: { scope: ManagementScope; basePath: string; suffix?: string; label?: string }) {
  return <nav aria-label={label} className="flex w-fit rounded-full border border-white/10 bg-zinc-900/70 p-1">
    <Link className={`rounded-full px-4 py-2 text-sm font-bold ${scope === 'mine' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`} href={`${basePath}?scope=mine${suffix}`}>Sob minha gestão</Link>
    <Link className={`rounded-full px-4 py-2 text-sm font-bold ${scope === 'all' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`} href={`${basePath}?scope=all${suffix}`}>Todos</Link>
  </nav>;
}
