import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fromLocalInput, localCandidates, toLocalInput, toSystemTime, formatDuration, formatSchedule } from './time';

describe('UTC instants and local input', () => {
  test('round trips winter and summer without applying the timezone twice', () => {
    for (const [utc, local] of [['2026-01-15T12:30:00Z', '2026-01-15T13:30'], ['2026-07-15T12:30:00Z', '2026-07-15T14:30']]) {
      const time = toSystemTime(new Date(utc));
      expect(toLocalInput(time)).toBe(local);
      expect(fromLocalInput(local)).toEqual(time);
    }
  });

  test('rejects nonexistent spring times and malformed dates', () => {
    expect(localCandidates('2026-03-29T02:30')).toEqual([]);
    expect(() => fromLocalInput('2026-03-29T02:30')).toThrow();
    expect(localCandidates('2026-02-30T10:00')).toEqual([]);
    expect(localCandidates('invalid')).toEqual([]);
    expect(() => toSystemTime(new Date('invalid'))).toThrow();
  });

  test('distinguishes both occurrences when clocks roll back', () => {
    const times = localCandidates('2026-10-25T02:30');
    expect(times).toHaveLength(2);
    expect(times[1].secs_since_epoch - times[0].secs_since_epoch).toBe(3600);
    expect(fromLocalInput('2026-10-25T02:30', 1)).toEqual(times[1]);
    for (const time of times) expect(toLocalInput(time)).toBe('2026-10-25T02:30');
    const precise = { secs_since_epoch: times[1].secs_since_epoch + 27, nanos_since_epoch: 123 };
    expect(fromLocalInput('2026-10-25T02:30', 1, precise)).toEqual(precise);
    expect(fromLocalInput('2026-10-25T02:30', 0, precise)).toEqual(times[0]);
  });

  test('round trips in other browser timezones, including fractional offsets', () => {
    for (const zone of ['UTC', 'America/New_York', 'Asia/Kathmandu', 'Australia/Lord_Howe']) {
      const result = spawnSync(process.execPath, ['-e', `
        import { toLocalInput, localCandidates, toSystemTime } from './src/utils/time.ts';
        const time = toSystemTime(new Date('2026-07-15T12:30:00Z'));
        if (!localCandidates(toLocalInput(time)).some(t => t.secs_since_epoch === time.secs_since_epoch)) process.exit(1);
      `], { env: { ...process.env, TZ: zone } });
      expect(result.status).toBe(0);
    }
  });

  test('remaining time disappears at the end', () => {
    expect(formatDuration({ secs: 1800, nanos: 0 }, { secs_since_epoch: 1000, nanos_since_epoch: 0 }, 1900)).toBe('30 min · 15 min left');
    expect(formatDuration({ secs: 1800, nanos: 0 }, { secs_since_epoch: 1000, nanos_since_epoch: 0 }, 2800)).toBe('30 min');
  });

  test('future countdowns include distant talks, round up, and switch at the start', () => {
    const duration = { secs: 1800, nanos: 0 };
    const start = { secs_since_epoch: 200000, nanos_since_epoch: 0 };
    expect(formatDuration(duration, start, 200000 - 83 * 60)).toBe('30 min · starts in 83 min');
    expect(formatDuration(duration, start, 199999)).toBe('30 min · starts in 1 min');
    expect(formatDuration(duration, start, 200000)).toBe('30 min · 30 min left');
    expect(formatDuration(duration, start, 0)).toContain('starts in 3334 min');
  });

  test('date formatting is English while the timezone remains local', () => {
    const time = toSystemTime(new Date('2026-01-15T12:30:00Z'));
    expect(formatSchedule(time, { secs: 1800, nanos: 0 }, 0)).toBe('15 Jan 2026, 13:30');
  });
});
