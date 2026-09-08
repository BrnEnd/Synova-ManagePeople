'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalPath } from '@/lib/routing/base-path';
import type { CompetenceStatus } from '@/lib/timekeeping/module';

type Entry = { id: string; workDate: string; minutes: number; observation: string | null };
type Competence = { id: string; referenceMonth: string; status: CompetenceStatus; totalMinutes: number };
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type DetailResponse = { competence: Competence; entries: Entry[] };

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const editableStatuses = new Set(['filling', 'adjustments_requested']);

export function isCompetenceEditable(status: CompetenceStatus) {
  return editableStatuses.has(status);
}

function formatDuration(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function parseDuration(value: string) {
  const normalized = value.trim();
  const clock = normalized.match(/^(\d{1,2})(?::([0-5]\d))?$/);
  let minutes: number;
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2] ?? 0);
  else {
    const decimal = normalized.match(/^\d+(?:[.,]\d+)$/);
    if (!decimal) return null;
    const duration = Number(normalized.replace(',', '.')) * 60;
    if (!Number.isInteger(duration)) return null;
    minutes = duration;
  }
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
}

function calendarDates(referenceMonth: string) {
  const [year, month] = referenceMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function MonthlyTimesheetGrid({ competence, initialEntries, onTotalChange, onBlockedChange }: {
  competence: Competence;
  initialEntries: Entry[];
  onTotalChange: (totalMinutes: number) => void;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const router = useRouter();
  const editable = isCompetenceEditable(competence.status);
  const dates = useMemo(() => calendarDates(competence.referenceMonth), [competence.referenceMonth]);
  const actualDates = useMemo(() => dates.filter((date): date is string => Boolean(date)), [dates]);
  const initialEntryMap = useMemo(() => Object.fromEntries(initialEntries.map((entry) => [entry.workDate, entry])), [initialEntries]);
  const initialValues = useMemo(() => Object.fromEntries(initialEntries.map((entry) => [entry.workDate, formatDuration(entry.minutes)])), [initialEntries]);
  const initialObservations = useMemo(() => Object.fromEntries(initialEntries.map((entry) => [entry.workDate, entry.observation ?? ''])), [initialEntries]);
  const [entries, setEntries] = useState<Record<string, Entry>>(initialEntryMap);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [observations, setObservations] = useState<Record<string, string>>(initialObservations);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(initialEntries[0]?.workDate ?? actualDates[0]);
  const savedValues = useRef<Record<string, string>>(initialValues);
  const pendingDates = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const observationEditor = useRef<HTMLTextAreaElement>(null);
  const currentDate = todayInSaoPaulo();
  const blocked = Object.values(states).some((state) => state === 'dirty' || state === 'saving' || state === 'error');

  useEffect(() => onBlockedChange(blocked), [blocked, onBlockedChange]);

  function mark(date: string, state: SaveState, error = '') {
    setStates((current) => ({ ...current, [date]: state }));
    setErrors((current) => ({ ...current, [date]: error }));
  }

  function reconcile(date: string, detail: DetailResponse) {
    const savedEntry = detail.entries.find((entry) => entry.workDate === date);
    setEntries((current) => {
      const next = { ...current };
      if (savedEntry) next[date] = savedEntry;
      else delete next[date];
      return next;
    });
    const canonical = savedEntry ? formatDuration(savedEntry.minutes) : '';
    savedValues.current[date] = canonical;
    setValues((current) => ({ ...current, [date]: canonical }));
    setObservations((current) => ({ ...current, [date]: savedEntry?.observation ?? '' }));
    onTotalChange(detail.competence.totalMinutes);
    mark(date, 'saved');
    router.refresh();
  }

  function enqueue<T>(operation: () => Promise<T>) {
    const run = queue.current.then(operation, operation);
    queue.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function commitDay(date: string, force = false) {
    const value = values[date] ?? '';
    if (!force && value === savedValues.current[date]) {
      mark(date, 'idle');
      return true;
    }
    if (pendingDates.current.has(date)) return false;
    if (!value.trim()) {
      if (entries[date]) {
        setValues((current) => ({ ...current, [date]: savedValues.current[date] }));
        mark(date, 'error', 'Para remover um lançamento, use Excluir no detalhe do dia.');
        return false;
      }
      mark(date, 'idle');
      return true;
    }
    const minutes = parseDuration(value);
    if (minutes == null) {
      mark(date, 'error', 'Informe uma duração entre 00:01 e 24:00, por exemplo 8 ou 07:30.');
      return false;
    }

    pendingDates.current.add(date);
    mark(date, 'saving');
    try {
      await enqueue(async () => {
        const response = await fetch(portalPath(`/api/portal/competencies/${competence.id}/entries`), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workDate: date, minutes, observation: observations[date]?.trim() || null }),
        });
        const body = await response.json() as DetailResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Não foi possível salvar.');
        reconcile(date, body);
      });
      return true;
    } catch (error) {
      mark(date, 'error', error instanceof Error ? error.message : 'Não foi possível salvar.');
      return false;
    } finally {
      pendingDates.current.delete(date);
    }
  }

  async function removeSelected() {
    const entry = entries[selectedDate];
    if (!entry || pendingDates.current.has(selectedDate)) return;
    pendingDates.current.add(selectedDate);
    mark(selectedDate, 'saving');
    try {
      await enqueue(async () => {
        const response = await fetch(portalPath(`/api/portal/competencies/${competence.id}/entries/${entry.id}`), { method: 'DELETE' });
        const body = await response.json() as DetailResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Não foi possível excluir.');
        reconcile(selectedDate, body);
      });
    } catch (error) {
      mark(selectedDate, 'error', error instanceof Error ? error.message : 'Não foi possível excluir.');
    } finally {
      pendingDates.current.delete(selectedDate);
    }
  }

  async function saveSelectedObservation() {
    if (!values[selectedDate]?.trim()) {
      mark(selectedDate, 'error', 'Informe as horas antes de salvar a observação.');
      return;
    }
    mark(selectedDate, 'dirty');
    await commitDay(selectedDate, true);
  }

  function focusNext(date: string) {
    const next = actualDates[actualDates.indexOf(date) + 1];
    if (next) document.querySelector<HTMLInputElement>(`[data-hours-date="${next}"]`)?.focus();
  }

  return <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0">
      <div className="overflow-x-auto pb-2">
        <div aria-label="Calendário mensal de apontamentos" className="grid min-w-[49rem] grid-cols-7 gap-2" role="grid">
          <div className="contents" role="row">
            {weekdays.map((weekday) => <div className="px-2 pb-1 text-center text-xs font-black uppercase tracking-wider text-zinc-500" key={weekday} role="columnheader">{weekday}</div>)}
          </div>
          {Array.from({ length: dates.length / 7 }, (_, weekIndex) => <div className="contents" key={`week-${weekIndex}`} role="row">
            {dates.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, dayIndex) => {
              const index = weekIndex * 7 + dayIndex;
              return date ? <div
            aria-selected={selectedDate === date}
            className={`min-h-32 rounded-2xl border p-2.5 ${selectedDate === date ? 'border-orange-400 bg-orange-400/10' : entries[date] ? 'border-white/15 bg-white/5' : 'border-white/8 bg-black/20'} ${(index % 7) >= 5 ? 'border-dashed' : ''}`}
            key={date}
            role="gridcell"
          >
            <div className="flex items-start justify-between gap-2">
              <button className="pressable flex min-h-8 min-w-8 items-center justify-center rounded-full text-sm font-black text-zinc-200" onClick={() => setSelectedDate(date)} tabIndex={editable ? -1 : 0} type="button" aria-label={`${editable ? 'Editar' : 'Ver'} ${fullDate(date)}`}>{Number(date.slice(-2))}</button>
              {currentDate === date && <span className="rounded-full bg-orange-400 px-2 py-1 text-[10px] font-black text-black">Hoje</span>}
            </div>
            {editable ? <label className="mt-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <span className="sr-only">Horas de {fullDate(date)}</span>
              <input
                aria-label={`Horas de ${fullDate(date)}`}
                aria-describedby={`status-${date}`}
                className="field h-10 px-2 text-center font-black tabular-nums"
                data-hours-date={date}
                disabled={states[date] === 'saving'}
                inputMode="decimal"
                onBlur={() => void commitDay(date)}
                onChange={(event) => { setSelectedDate(date); setValues((current) => ({ ...current, [date]: event.target.value })); mark(date, 'dirty'); }}
                onFocus={() => setSelectedDate(date)}
                onKeyDown={(event) => {
                  if (event.key === 'F2') {
                    event.preventDefault();
                    setSelectedDate(date);
                    requestAnimationFrame(() => observationEditor.current?.focus());
                    return;
                  }
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void commitDay(date).then((saved) => { if (saved) focusNext(date); });
                }}
                placeholder="00:00"
                type="text"
                value={values[date] ?? ''}
              />
            </label> : <p aria-label={`Horas de ${fullDate(date)}: ${values[date] || 'não informadas'}`} className="mt-3 text-center font-black tabular-nums text-zinc-200">{values[date] || '—'}</p>}
            <div aria-live="polite" className="mt-2 min-h-8 text-[11px] font-bold" id={`status-${date}`}>
              {observations[date] && <button className="text-left text-zinc-400" onClick={() => setSelectedDate(date)} tabIndex={-1} type="button">● Observação</button>}
              {states[date] === 'saving' && <p className="text-amber-300">Salvando…</p>}
              {states[date] === 'saved' && <p className="text-emerald-300">✓ Salvo</p>}
              {states[date] === 'dirty' && <p className="text-zinc-400">Alterado</p>}
              {states[date] === 'error' && <p className="text-red-300">! Corrigir</p>}
            </div>
          </div> : <div aria-hidden="true" className="min-h-32 rounded-2xl border border-white/5 bg-black/10" key={`empty-${index}`} role="gridcell" />;
            })}
          </div>)}
        </div>
      </div>
      {editable && <p className="mt-2 text-xs text-zinc-500">Tab percorre os dias, Enter salva e avança, F2 abre a observação do dia em foco.</p>}
    </div>

    <aside className="self-start rounded-2xl border border-white/10 bg-black/20 p-5" aria-label="Detalhe do dia selecionado">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Detalhe do dia</p>
      <h3 className="mt-2 font-black capitalize text-white">{fullDate(selectedDate)}</h3>
      <p className="mt-2 text-sm text-zinc-400">Duração: <strong className="text-zinc-200">{values[selectedDate] || 'Não informada'}</strong></p>
      <label className="mt-5 block text-sm font-bold text-zinc-300">Observação
        <textarea
          className="field mt-2 min-h-28 resize-y"
          disabled={!editable || states[selectedDate] === 'saving'}
          maxLength={1000}
          onChange={(event) => { setObservations((current) => ({ ...current, [selectedDate]: event.target.value })); mark(selectedDate, 'dirty'); }}
          placeholder="Atividades realizadas"
          ref={observationEditor}
          value={observations[selectedDate] ?? ''}
        />
      </label>
      {editable && <div className="mt-4 flex flex-wrap gap-2">
        <button className="button-secondary" disabled={states[selectedDate] === 'saving'} onClick={() => void saveSelectedObservation()} type="button">Salvar observação</button>
        {entries[selectedDate] && <button className="pressable rounded-full px-3 py-2 text-sm font-bold text-red-300" disabled={states[selectedDate] === 'saving'} onClick={() => void removeSelected()} type="button">Excluir lançamento</button>}
      </div>}
      <div aria-live="polite" className="mt-3 min-h-5 text-sm">
        {errors[selectedDate] && <p className="text-red-300" role="alert">{errors[selectedDate]}</p>}
      </div>
    </aside>
  </div>;
}
