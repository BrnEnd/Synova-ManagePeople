import { describe, expect, it } from 'vitest';
import { isLastNationalBusinessDay, lastNationalBusinessDay, saoPauloDate } from '@/lib/calendar/business-days';

describe('calendário empresarial nacional', () => {
  it('recua fins de semana no fechamento mensal', () => {
    expect(lastNationalBusinessDay(2026, 5)).toBe('2026-05-29');
    expect(lastNationalBusinessDay(2026, 8)).toBe('2026-08-31');
  });

  it('considera somente o dia local em São Paulo', () => {
    expect(saoPauloDate(new Date('2026-09-01T01:30:00Z'))).toBe('2026-08-31');
    expect(isLastNationalBusinessDay(new Date('2026-09-01T01:30:00Z'))).toBe(true);
    expect(isLastNationalBusinessDay(new Date('2026-08-30T15:00:00Z'))).toBe(false);
  });
});
