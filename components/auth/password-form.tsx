'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function PasswordForm({ destination, displayName }: { destination: string; displayName: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível alterar a senha.');
      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900/85 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Primeiro acesso</p>
      <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white">Crie sua nova senha</h1>
      <p className="mt-2 text-zinc-400">Olá, {displayName}. Troque a senha temporária para liberar o portal.</p>
      <form className="mt-8 space-y-5" onSubmit={submit}>
        <label className="block text-sm font-bold text-zinc-200">Senha temporária<input className="field mt-2" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoFocus autoComplete="current-password" required /></label>
        <label className="block text-sm font-bold text-zinc-200">Nova senha<input className="field mt-2" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
        <label className="block text-sm font-bold text-zinc-200">Confirme a nova senha<input className="field mt-2" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
        <p className="text-sm leading-6 text-zinc-500">Use ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.</p>
        <button className="pressable synova-gradient w-full rounded-full px-6 py-3.5 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      </form>
    </section>
  );
}
