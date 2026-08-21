import Holidays from 'date-holidays';

const brazilHolidays = new Holidays('BR');

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function lastNationalBusinessDay(year: number, month: number) {
  const publicHolidays = new Set(brazilHolidays.getHolidays(year)
    .filter((holiday) => holiday.type === 'public')
    .map((holiday) => holiday.date.slice(0, 10)));
  const date = new Date(Date.UTC(year, month, 0));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || publicHolidays.has(isoDate(year, month, date.getUTCDate()))) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return isoDate(year, month, date.getUTCDate());
}

export function saoPauloDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function isLastNationalBusinessDay(now: Date) {
  const localDate = saoPauloDate(now);
  const [year, month] = localDate.split('-').map(Number);
  return localDate === lastNationalBusinessDay(year, month);
}
