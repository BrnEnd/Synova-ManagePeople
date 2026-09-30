'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { portalPath } from '@/lib/routing/base-path';

type Notification = { id: string; title: string; message: string; employeeId: string | null; competenceId: string | null; readAt: string | null; createdAt: string };

export function ManagementNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(portalPath('/api/notifications'), { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((body: { notifications?: Notification[] } | null) => setNotifications(body?.notifications ?? [])).catch(() => undefined);
  }, []);

  const unread = notifications.filter((notification) => !notification.readAt).length;
  async function read(notification: Notification) {
    if (!notification.readAt) {
      await fetch(portalPath(`/api/notifications/${notification.id}/read`), { method: 'POST' });
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    }
    setOpen(false);
  }

  return <div className="relative">
    <button aria-expanded={open} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`} className="relative flex size-10 items-center justify-center rounded-full border border-white/10 text-lg text-zinc-300 hover:bg-white/5" type="button" onClick={() => setOpen((value) => !value)}>🔔{unread > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-white">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="absolute right-0 z-50 mt-3 w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"><div className="border-b border-white/10 px-4 py-3"><h2 className="font-black text-white">Notificações</h2><p className="text-xs text-zinc-500">{unread} não lida(s)</p></div><div className="max-h-96 overflow-y-auto">{notifications.length === 0 ? <p className="p-5 text-sm text-zinc-500">Nenhuma notificação.</p> : notifications.map((notification) => {
      const href = notification.employeeId ? `/gestao/funcionarios/${notification.employeeId}` : notification.competenceId ? `/gestao/competencias/${notification.competenceId}` : '/gestao';
      return <Link className={`block border-b border-white/8 px-4 py-3 hover:bg-white/5 ${notification.readAt ? 'opacity-60' : 'bg-orange-400/5'}`} href={href} key={notification.id} onClick={() => read(notification)}><p className="text-sm font-black text-white">{notification.title}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{notification.message}</p><p className="mt-1.5 text-[11px] text-zinc-600">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(notification.createdAt))}</p></Link>;
    })}</div></div>}
  </div>;
}
