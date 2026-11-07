import type { EventConfig } from './generated/EventConfig';
import type { Talk } from './generated/Talk';
import type { Command } from './generated/Command';
import type { UserReference } from './generated/UserReference';
import { toLocalInput } from './utils/time';

export const SLOT_MINUTES = 15;

export function audienceLabel(talk: Talk, users: Record<number, UserReference>) {
  const remote = [...new Set([...talk.noobs, ...talk.nerds])].filter(id => users[id]?.attendance_mode === 'Remote').length;
  return `${talk.noobs.length} noobs · ${talk.nerds.length} nerds · ${remote} remote`;
}

export function zoomTimeline(currentMinutes: number, requestedMinutes: number, dayMinutes: number, viewportHeight: number, scrollTop: number, anchorY: number) {
  const clamp = (minutes: number) => Math.min(dayMinutes, Math.max(Math.min(60, dayMinutes), minutes));
  const minutes = clamp(requestedMinutes);
  const timeAtAnchor = (scrollTop + anchorY) * clamp(currentMinutes) / viewportHeight;
  return {
    minutes,
    scrollTop: Math.max(0, Math.min(timeAtAnchor * viewportHeight / minutes - anchorY, (dayMinutes / minutes - 1) * viewportHeight)),
  };
}

export function eventDays(config: Pick<EventConfig, 'start' | 'end'>): { value: string; label: string; start: number; end: number }[] {
  const eventStart = Date.parse(config.start);
  const eventEnd = Date.parse(config.end);
  if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventStart >= eventEnd) throw new Error('Invalid event range');
  const day = new Date(eventStart);
  day.setHours(0, 0, 0, 0);
  const days = [];
  while (day.getTime() < eventEnd) {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    days.push({
      value: toLocalInput({ secs_since_epoch: day.getTime() / 1000, nanos_since_epoch: 0 }).slice(0, 10),
      label: day.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      start: Math.max(day.getTime(), eventStart) / 1000,
      end: Math.min(next.getTime(), eventEnd) / 1000,
    });
    day.setTime(next.getTime());
  }
  return days;
}

export function draftChanges(original: Record<number, Talk>, draft: Record<number, Talk>): Command[] {
  const changes: Command[] = [];
  for (const talk of Object.values(draft)) {
    const before = original[talk.id];
    if (!before) continue;
    if (talk.location !== before.location || talk.scheduled_at?.secs_since_epoch !== before.scheduled_at?.secs_since_epoch || talk.scheduled_at?.nanos_since_epoch !== before.scheduled_at?.nanos_since_epoch || talk.duration.secs !== before.duration.secs || talk.duration.nanos !== before.duration.nanos) {
      const schedule = (t: Talk) => ({ location: t.location, scheduled_at: t.scheduled_at, duration: t.duration });
      changes.push({ ScheduleTalk: { talk_id: talk.id, before: schedule(before), after: schedule(talk) } });
    }
  }
  return changes;
}

export function fitsEvent(talk: Talk, config: Pick<EventConfig, 'start' | 'end'>): boolean {
  return !talk.scheduled_at || (talk.scheduled_at.secs_since_epoch >= Date.parse(config.start) / 1000 && talk.scheduled_at.secs_since_epoch + talk.duration.secs <= Date.parse(config.end) / 1000);
}

export type EventLayout = { talk: Talk; start: number; end: number; column: number; columns: number };

// Connected overlap groups share columns; touching endpoints are not conflicts.
export function layoutTalks(talks: Talk[], start: number, end: number): EventLayout[] {
  const events = talks.flatMap(talk => {
    if (!talk.scheduled_at) return [];
    const from = Math.max(start, talk.scheduled_at.secs_since_epoch);
    const to = Math.min(end, talk.scheduled_at.secs_since_epoch + talk.duration.secs);
    return from < to ? [{ talk, start: from, end: to, column: 0, columns: 1 }] : [];
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.talk.id - b.talk.id);
  let group: EventLayout[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const finish = () => { for (const event of group) event.columns = columnEnds.length; };
  for (const event of events) {
    if (event.start >= groupEnd) {
      finish();
      group = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex(to => to <= event.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = event.end;
    event.column = column;
    group.push(event);
    groupEnd = Math.max(groupEnd, event.end);
  }
  finish();
  return events;
}

export function openingPeriods(config: Pick<EventConfig, 'opening_hours'>) {
  const periods: { start: number; end: number }[] = [];
  const sorted = config.opening_hours.map(r => ({ start: Date.parse(r.start) / 1000, end: Date.parse(r.end) / 1000 }))
    .sort((a, b) => a.start - b.start);
  for (const period of sorted) {
    const last = periods.at(-1);
    if (last && period.start <= last.end) last.end = Math.max(last.end, period.end);
    else periods.push(period);
  }
  return periods;
}

export function timelineBands(config: EventConfig, start: number, end: number) {
  const bands: { start: number; end: number; kind: 'closed' | 'break'; label: string }[] = [];
  if (config.opening_hours.length) {
    const open = openingPeriods(config).map(r => ({ start: Math.max(start, r.start), end: Math.min(end, r.end) }))
      .filter(r => r.start < r.end);
    let cursor = start;
    for (const interval of open) {
      if (interval.start > cursor) bands.push({ start: cursor, end: interval.start, kind: 'closed', label: 'Closed' });
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor < end) bands.push({ start: cursor, end, kind: 'closed', label: 'Closed' });
  }
  for (const pause of config.breaks) {
    const from = Math.max(start, Date.parse(pause.start) / 1000);
    const to = Math.min(end, Date.parse(pause.end) / 1000);
    if (from < to) bands.push({ start: from, end: to, kind: 'break', label: pause.label });
  }
  return bands;
}
