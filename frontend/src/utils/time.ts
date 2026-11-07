import type { SystemTime } from '../generated/SystemTime';
import type { Duration } from '../generated/Duration';

export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalInput(time: SystemTime): string {
  const d = new Date(time.secs_since_epoch * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toSystemTime(date: Date): SystemTime {
  if (!Number.isFinite(date.getTime()) || date.getTime() < 0) throw new Error('Invalid date');
  return { secs_since_epoch: Math.floor(date.getTime() / 1000), nanos_since_epoch: 0 };
}

// Return both occurrences during a clock rollback, and none for skipped local times.
export function localCandidates(value: string): SystemTime[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const local = new Date(value);
  if (!Number.isFinite(local.getTime())) return [];
  const wallTime = Date.parse(`${value}Z`);
  const offsets = new Set([-36, 0, 36].map(h => new Date(local.getTime() + h * 3600000).getTimezoneOffset()));
  return [...offsets].map(offset => new Date(wallTime + offset * 60000))
    .filter(d => d.getTime() >= 0 && toLocalInput(toSystemTime(d)) === value)
    .sort((a, b) => a.getTime() - b.getTime()).map(toSystemTime);
}

export function fromLocalInput(value: string, occurrence = 0, original: SystemTime | null = null): SystemTime {
  const candidate = localCandidates(value)[occurrence];
  if (!candidate) throw new Error('This local time does not exist. Check the date and daylight-saving change.');
  // An unchanged minute must not truncate stored seconds or switch a repeated-time occurrence.
  if (original && original.secs_since_epoch >= candidate.secs_since_epoch && original.secs_since_epoch - candidate.secs_since_epoch < 60) return original;
  return candidate;
}

export function formatSchedule(time: SystemTime, duration: Duration, now: number): string {
  const date = new Date(time.secs_since_epoch * 1000);
  let suffix = '';
  if (time.secs_since_epoch <= now && now < time.secs_since_epoch + duration.secs) suffix = ' · now';
  return `${date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}${suffix}`;
}

export function formatDuration(duration: Duration, start: SystemTime | null, now: number): string {
  const end = start ? start.secs_since_epoch + duration.secs : 0;
  let remaining = '';
  if (start && now < start.secs_since_epoch) remaining = ` · starts in ${Math.ceil((start.secs_since_epoch - now) / 60)} min`;
  else if (start && now < end) remaining = ` · ${Math.ceil((end - now) / 60)} min left`;
  return `${Math.floor(duration.secs / 60)} min${remaining}`;
}

export function utcOffset(time: SystemTime): string {
  const offset = -new Date(time.secs_since_epoch * 1000).getTimezoneOffset();
  return `UTC${offset >= 0 ? '+' : '−'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
