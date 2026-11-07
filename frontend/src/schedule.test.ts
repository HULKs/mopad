import { expect, test } from 'bun:test';
import { audienceLabel, draftChanges, eventDays, fitsEvent, layoutTalks, openingPeriods, timelineBands, zoomTimeline } from './schedule';
import type { Talk } from './generated/Talk';
import type { UserReference } from './generated/UserReference';

const talk: Talk = { id: 1, creator: 0, title: 'Talk', description: '', highlight: false, scheduled_at: null, duration: { secs: 1800, nanos: 0 }, creator_duration: { secs: 1800, nanos: 0 }, location: null, nerds: [0], noobs: [] };

test('audience counts include remote participants once across both roles and ignore nonparticipants', () => {
  const users: Record<number, UserReference> = {
    0: { id: 0, name: 'A', team: '', attendance_mode: 'OnSite', roles: [] },
    1: { id: 1, name: 'B', team: '', attendance_mode: 'Remote', roles: [] },
    2: { id: 2, name: 'C', team: '', attendance_mode: 'Remote', roles: [] },
    3: { id: 3, name: 'D', team: '', attendance_mode: 'Remote', roles: [] },
  };
  const entry = { ...talk, noobs: [0, 1, 99], nerds: [1, 2] };
  expect(audienceLabel(entry, users)).toBe('3 noobs · 2 nerds · 2 remote');
  users[1].attendance_mode = 'OnSite';
  expect(audienceLabel(entry, users)).toBe('3 noobs · 2 nerds · 1 remote');
  entry.noobs = [0];
  entry.nerds = [];
  expect(audienceLabel(entry, users)).toBe('1 noobs · 0 nerds · 0 remote');
  expect(audienceLabel({ ...talk, noobs: [], nerds: [] }, users)).toBe('0 noobs · 0 nerds · 0 remote');
});

test('opening or cancelling a scheduler draft does not mutate live talks', () => {
  const original = { 1: talk };
  const draft = structuredClone(original);
  expect(draftChanges(original, draft)).toEqual([]);
  draft[1].location = 2;
  draft[1].scheduled_at = { secs_since_epoch: 123, nanos_since_epoch: 0 };
  draft[1].duration.secs = 3600;
  expect(original[1].location).toBeNull();
  expect(original[1].duration.secs).toBe(1800);
  expect(draftChanges(original, draft)).toEqual([{ ScheduleTalk: {
    talk_id: 1,
    before: { location: null, scheduled_at: null, duration: { secs: 1800, nanos: 0 } },
    after: { location: 2, scheduled_at: draft[1].scheduled_at, duration: { secs: 3600, nanos: 0 } },
  } }]);
  expect(draftChanges(draft, original)[0]).toHaveProperty('ScheduleTalk.after.scheduled_at', null);
});

test('local days cover exact event boundaries and daylight-saving transitions', () => {
  const spring = eventDays({ start: '2026-03-27T23:00:00Z', end: '2026-03-29T22:00:00Z' });
  expect(spring).toHaveLength(2);
  expect(spring.map(d => (d.end - d.start) / 3600)).toEqual([24, 23]);
  const fall = eventDays({ start: '2026-10-24T22:00:00Z', end: '2026-10-25T23:00:00Z' });
  expect(fall).toHaveLength(1);
  expect((fall[0].end - fall[0].start) / 3600).toBe(25);
  const partial = eventDays({ start: '2026-11-20T08:30:00Z', end: '2026-11-20T10:00:00Z' });
  expect(partial).toHaveLength(1);
  expect(partial[0].end - partial[0].start).toBe(5400);
});

test('the entire scheduled talk must fit the event', () => {
  const config = { start: '2026-11-20T08:00:00Z', end: '2026-11-20T09:00:00Z' };
  const start = Date.parse(config.start) / 1000;
  expect(fitsEvent(talk, config)).toBe(true);
  expect(fitsEvent({ ...talk, scheduled_at: { secs_since_epoch: start, nanos_since_epoch: 0 } }, config)).toBe(true);
  expect(fitsEvent({ ...talk, scheduled_at: { secs_since_epoch: start + 2700, nanos_since_epoch: 0 } }, config)).toBe(false);
});

function scheduled(id: number, start: number, end: number): Talk {
  return { ...talk, id, location: 1, scheduled_at: { secs_since_epoch: start, nanos_since_epoch: 0 }, duration: { secs: end - start, nanos: 0 } };
}

test('overlaps use separate columns and reuse columns for back-to-back talks', () => {
  const entries = [scheduled(1, 0, 100), scheduled(2, 10, 30), scheduled(3, 20, 40), scheduled(4, 40, 60), scheduled(5, 100, 120)];
  const layout = layoutTalks(entries, 0, 200);
  expect(layout.slice(0, 4).map(e => e.columns)).toEqual([3, 3, 3, 3]);
  expect(layout.find(e => e.talk.id === 5)?.columns).toBe(1);
  for (const a of layout) for (const b of layout) {
    if (a.talk.id !== b.talk.id && a.start < b.end && b.start < a.end) expect(a.column).not.toBe(b.column);
  }
  const adjacent = layoutTalks([scheduled(1, 0, 30), scheduled(2, 30, 60)], 0, 60);
  expect(adjacent.map(e => e.columns)).toEqual([1, 1]);
  expect(entries[0].scheduled_at?.secs_since_epoch).toBe(0);
});

test('preview layout shares width and clips overnight talks without moving them', () => {
  const existing = scheduled(1, 0, 100);
  const preview = scheduled(2, 30, 120);
  expect(layoutTalks([existing], 20, 80)[0]).toMatchObject({ start: 20, end: 80, columns: 1 });
  const layout = layoutTalks([existing, preview], 20, 80);
  expect(layout.map(e => e.columns)).toEqual([2, 2]);
  expect(layout[1].end).toBe(80);
  expect(existing.duration.secs).toBe(100);
  expect(layoutTalks([scheduled(3, 100, 120)], 20, 80)).toEqual([]);
});

test('closed periods are the complement of merged opening hours; breaks stay advisory', () => {
  const date = (seconds: number) => new Date(seconds * 1000).toISOString();
  const config = {
    start: date(0), end: date(1000),
    opening_hours: [{ start: date(100), end: date(400) }, { start: date(300), end: date(800) }],
    breaks: [{ label: 'Lunch', start: date(500), end: date(600) }],
  };
  expect(openingPeriods(config)).toEqual([{ start: 100, end: 800 }]);
  expect(timelineBands(config, 0, 1000)).toEqual([
    { start: 0, end: 100, kind: 'closed', label: 'Closed' },
    { start: 800, end: 1000, kind: 'closed', label: 'Closed' },
    { start: 500, end: 600, kind: 'break', label: 'Lunch' },
  ]);
  expect(fitsEvent(scheduled(1, 20, 80), config)).toBe(true);
  expect(fitsEvent(scheduled(2, 510, 580), config)).toBe(true);
  expect(timelineBands({ ...config, opening_hours: [], breaks: [] }, 0, 1000)).toEqual([]);
  expect(timelineBands(config, 450, 550)).toEqual([{ start: 500, end: 550, kind: 'break', label: 'Lunch' }]);
});

test('time zoom preserves the time beneath the pointer', () => {
  const before = { minutes: 360, scrollTop: 600 };
  const anchor = 200;
  const height = 600;
  const after = zoomTimeline(before.minutes, 180, 1440, height, before.scrollTop, anchor);
  expect(after.minutes).toBe(180);
  expect((after.scrollTop + anchor) * after.minutes / height)
    .toBeCloseTo((before.scrollTop + anchor) * before.minutes / height);
  const restored = zoomTimeline(after.minutes, before.minutes, 1440, height, after.scrollTop, anchor);
  expect(restored.scrollTop).toBeCloseTo(before.scrollTop);
});

test('zoom is bounded between one hour and the actual selected day', () => {
  for (const hours of [23, 24, 25]) {
    const day = hours * 60;
    expect(zoomTimeline(360, 1, day, 600, 0, 0).minutes).toBe(60);
    expect(zoomTimeline(360, Infinity, day, 600, 600, 300)).toEqual({ minutes: day, scrollTop: 0 });
    const last = zoomTimeline(360, 60, day, 600, 100000, 300);
    expect(last.scrollTop).toBe((hours - 1) * 600);
  }
  expect(zoomTimeline(60, 1, 30, 600, 0, 0)).toEqual({ minutes: 30, scrollTop: 0 });
});
