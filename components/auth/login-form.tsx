'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantSlug, email, password }),
      });
      const body = await response.json() as {
        error?: string;
        identity?: { role: 'manager' | 'employee'; mustChangePassword: boolean };
      };
      if (!response.ok || !body.identity) throw new Error(body.error || 'Não foi possível entrar.');
      const destination = body.identity.mustChangePassword
        ? '/alterar-senha'
        : body.identity.role === 'manager' ? '/gestao' : '/portal';
      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Área restrita</p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white">Boas-vindas</h2>
      <p className="mt-2 text-zinc-400">Entre com os dados provisionados para sua organização.</p>

      <form className="mt-8 space-y-5" onSubmit={submit}>
        <label className="block text-sm font-bold text-zinc-200">
          Organização
          <input className="field mt-2" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} autoFocus autoComplete="organization" placeholder="synova" required />
        </label>
        <label className="block text-sm font-bold text-zinc-200">
          E-mail
          <input className="field mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="voce@synova.com" required />
        </label>
        <label className="block text-sm font-bold text-zinc-200">
          Senha
          <input className="field mt-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <button className="pressable synova-gradient w-full rounded-full px-6 py-3.5 font-black text-white shadow-lg shadow-orange-950/30 disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      </form>
    </div>
  );
}
