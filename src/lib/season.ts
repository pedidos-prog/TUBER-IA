import { startOfWeek, getISOWeek, getISOWeekYear, format, addWeeks, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const SEASONS = [
  { label: '2021/22', start: new Date('2021-10-01'), end: new Date('2022-06-01') },
  { label: '2022/23', start: new Date('2022-10-01'), end: new Date('2023-06-01') },
  { label: '2023/24', start: new Date('2023-10-01'), end: new Date('2024-06-01') },
  { label: '2024/25', start: new Date('2024-10-01'), end: new Date('2025-06-01') },
  { label: '2025/26', start: new Date('2025-10-01'), end: new Date('2026-06-01') },
  { label: '2026/27', start: new Date('2026-10-01'), end: new Date('2027-06-01') },
];

export interface SeasonWeek {
  key: string;        // "2026-W05" — identificador único
  weekNumber: number; // Número semana ISO (1-53)
  isoYear: number;
  monday: Date;
  nextMonday: Date;   // Usamos < nextMonday en vez de <= sunday para evitar problemas de timezone
  dateRange: string;
}

export function getSeasonWeeks(seasonLabel: string): SeasonWeek[] {
  const season = SEASONS.find(s => s.label === seasonLabel);
  if (!season) return [];

  const weeks: SeasonWeek[] = [];
  let current = startOfWeek(season.start, { weekStartsOn: 1 });

  while (current < season.end) {
    const weekNumber = getISOWeek(current);
    const isoYear = getISOWeekYear(current);
    const nextMonday = addWeeks(current, 1);
    const sunday = addDays(nextMonday, -1);

    weeks.push({
      key: `${isoYear}-W${String(weekNumber).padStart(2, '0')}`,
      weekNumber,
      isoYear,
      monday: new Date(current),
      nextMonday: new Date(nextMonday),
      dateRange: `${format(current, 'd MMM', { locale: es })} – ${format(sunday, 'd MMM', { locale: es })}`,
    });

    current = nextMonday;
  }

  return weeks;
}

export function getCurrentSeason(): string {
  const now = new Date();
  for (const s of [...SEASONS].reverse()) {
    if (now >= s.start && now <= s.end) return s.label;
  }
  return SEASONS[SEASONS.length - 1].label;
}

export function getCurrentWeekKey(): string {
  const now = new Date();
  const wn = getISOWeek(now);
  const wy = getISOWeekYear(now);
  return `${wy}-W${String(wn).padStart(2, '0')}`;
}
