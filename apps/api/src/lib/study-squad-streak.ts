const SINGAPORE_TIME_ZONE = 'Asia/Singapore';
export const SQUAD_MONTHLY_RESTORE_LIMIT = 5;

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type SquadStreakRestore = {
  restoredDate: string;
  restoredAt: Date;
};

export type SquadStreakState = {
  currentDays: number;
  activeToday: boolean;
  restoresUsedThisMonth: number;
  restoresLimit: number;
  canRestore: boolean;
  restoreDate: string | null;
};

export function toSingaporeDateKey(date: Date): string {
  return dateKey(date);
}

export function calculateStudySquadStreak(input: {
  activityDates: Iterable<string>;
  restores: SquadStreakRestore[];
  squadCreatedAt: Date;
  now?: Date;
}): SquadStreakState {
  const now = input.now ?? new Date();
  const today = dateKey(now);
  const createdDate = dateKey(input.squadCreatedAt);
  const currentMonth = today.slice(0, 7);
  const activity = new Set(input.activityDates);
  const restoredDates = new Set(input.restores.map((restore) => restore.restoredDate));
  const qualifyingDates = new Set([...activity, ...restoredDates]);
  const activeToday = qualifyingDates.has(today);
  const restoresUsedThisMonth = input.restores.filter(
    (restore) => dateKey(restore.restoredAt).slice(0, 7) === currentMonth,
  ).length;

  let cursor = activeToday ? today : addDays(today, -1);
  let currentDays = 0;
  while (cursor >= createdDate && qualifyingDates.has(cursor)) {
    currentDays += 1;
    cursor = addDays(cursor, -1);
  }

  const hasEarlierActivity = [...qualifyingDates].some((candidate) => candidate < cursor);
  const restoreDate = cursor >= createdDate && hasEarlierActivity ? cursor : null;
  return {
    currentDays,
    activeToday,
    restoresUsedThisMonth,
    restoresLimit: SQUAD_MONTHLY_RESTORE_LIMIT,
    canRestore: restoreDate !== null && restoresUsedThisMonth < SQUAD_MONTHLY_RESTORE_LIMIT,
    restoreDate,
  };
}

export function calculateMemberStreak(input: {
  activityDates: Iterable<string>;
  joinedAt: Date;
  now?: Date;
}): number {
  return calculateStudySquadStreak({
    activityDates: input.activityDates,
    restores: [],
    squadCreatedAt: input.joinedAt,
    ...(input.now ? { now: input.now } : {}),
  }).currentDays;
}
