'use client';

import { useRouter } from 'next/navigation';
import { portalPath } from '@/lib/routing/base-path';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch(portalPath('/api/auth/session'), { method: 'DELETE' });
    router.replace('/entrar');
    router.refresh();
  }

  return <button className="pressable rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:border-white/20 hover:text-white disabled:opacity-50" disabled={busy} onClick={logout} type="button">{busy ? 'Saindo…' : 'Sair'}</button>;
}
