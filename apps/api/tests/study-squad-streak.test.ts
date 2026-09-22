import { describe, expect, it } from 'vitest';

import {
  calculateMemberStreak,
  calculateStudySquadStreak,
  toSingaporeDateKey,
} from '../src/lib/study-squad-streak.js';

describe('Study Squad streaks', () => {
  it('uses Singapore calendar dates around the UTC boundary', () => {
    expect(toSingaporeDateKey(new Date('2026-09-02T15:59:59.000Z'))).toBe('2026-09-02');
    expect(toSingaporeDateKey(new Date('2026-09-02T16:00:00.000Z'))).toBe('2026-09-03');
  });

  it('keeps yesterday as the active streak while today is still open', () => {
    const streak = calculateStudySquadStreak({
      activityDates: ['2026-09-01', '2026-09-02'],
      restores: [],
      squadCreatedAt: new Date('2026-09-01T02:00:00.000Z'),
      now: new Date('2026-09-03T10:00:00.000Z'),
    });

    expect(streak.currentDays).toBe(2);
    expect(streak.activeToday).toBe(false);
    expect(streak.canRestore).toBe(false);
  });

  it('offers the most recent gap and extends the streak after restoration', () => {
    const base = {
      activityDates: ['2026-09-01', '2026-09-03'],
      squadCreatedAt: new Date('2026-09-01T02:00:00.000Z'),
      now: new Date('2026-09-03T10:00:00.000Z'),
    };
    const broken = calculateStudySquadStreak({ ...base, restores: [] });
    expect(broken).toMatchObject({ currentDays: 1, canRestore: true, restoreDate: '2026-09-02' });

    const repaired = calculateStudySquadStreak({
      ...base,
      restores: [{ restoredDate: '2026-09-02', restoredAt: new Date('2026-09-03T10:05:00.000Z') }],
    });
    expect(repaired).toMatchObject({ currentDays: 3, restoresUsedThisMonth: 1 });
  });

  it('enforces the shared monthly limit', () => {
    const restores = Array.from({ length: 5 }, (_, index) => ({
      restoredDate: `2026-08-${20 + index}`,
      restoredAt: new Date(`2026-09-0${index + 1}T10:00:00.000Z`),
    }));
    const streak = calculateStudySquadStreak({
      activityDates: ['2026-09-01', '2026-09-03'],
      restores,
      squadCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
      now: new Date('2026-09-03T10:00:00.000Z'),
    });

    expect(streak.restoresUsedThisMonth).toBe(5);
    expect(streak.restoreDate).toBe('2026-09-02');
    expect(streak.canRestore).toBe(false);
  });

  it('calculates a member streak only from their join date', () => {
    expect(calculateMemberStreak({
      activityDates: ['2026-09-01', '2026-09-02', '2026-09-03'],
      joinedAt: new Date('2026-09-02T01:00:00.000Z'),
      now: new Date('2026-09-03T10:00:00.000Z'),
    })).toBe(2);
  });
});
