import type { SystemTime, Duration } from "../types";

export function toDate(st: SystemTime): Date {
  return new Date(st.secs_since_epoch * 1000);
}

export function toSystemTime(date: Date): SystemTime {
  return {
    secs_since_epoch: Math.floor(date.getTime() / 1000),
    nanos_since_epoch: 0,
  };
}

export function formatDuration(d: Duration): string {
  return Math.floor(d.secs / 60).toString();
}

// Matches the existing "at YYYY-MM-DD HH:mm (in X minutes)" format
export function formatScheduleString(
  start: SystemTime,
  duration: Duration,
  nowSecs: number,
): string {
  const startDate = toDate(start);
  const startMins = Math.floor(start.secs_since_epoch / 60);
  const nowMins = Math.floor(nowSecs / 60);
  const durationMins = Math.floor(duration.secs / 60);

  // Date formatting YYYY-MM-DD HH:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr =
    `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())} ` +
    `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;

  let suffix = "";
  if (nowMins < startMins && startMins - nowMins <= durationMins) {
    const diff = startMins - nowMins;
    suffix = ` (in ${diff} minute${diff === 1 ? "" : "s"})`;
  } else if (startMins === nowMins) {
    suffix = ` (now)`;
  } else if (startMins < nowMins && nowMins - startMins < durationMins) {
    const diff = nowMins - startMins;
    suffix = ` (${diff} minute${diff === 1 ? "" : "s"} ago)`;
  }

  return `at ${dateStr}${suffix}`;
}

export function getDurationString(
  start: SystemTime | null,
  duration: Duration,
  nowSecs: number,
): string {
  const durationMins = Math.floor(duration.secs / 60);
  let suffix = "";

  if (start) {
    const startMins = Math.floor(start.secs_since_epoch / 60);
    const nowMins = Math.floor(nowSecs / 60);
    if (startMins <= nowMins && nowMins - startMins < durationMins) {
      const left = durationMins - (nowMins - startMins);
      suffix = ` (${left} minute${left === 1 ? "" : "s"} left)`;
    }
  }
  return `for ${durationMins} minute${durationMins === 1 ? "" : "s"}${suffix}`;
}
