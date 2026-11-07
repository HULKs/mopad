import type { AuthenticationResponse } from './generated/AuthenticationResponse';
import type { Update } from './generated/Update';
import type { Talk } from './generated/Talk';
import type { UserReference } from './generated/UserReference';
import type { EventConfig } from './generated/EventConfig';
import type { Location } from './generated/Location';

export type ServerMessage = AuthenticationResponse | Update;
export type Data = { users: Record<number, UserReference>; talks: Record<number, Talk> };

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const ids = (v: unknown) => Array.isArray(v) && v.every(integer);
const attendance = (v: unknown) => v === 'OnSite' || v === 'Remote';
const duration = (v: unknown) => record(v) && integer(v.secs) && integer(v.nanos) && (v.nanos as number) < 1e9;
const timestamp = (v: unknown) => v === null || (record(v) && integer(v.secs_since_epoch) && integer(v.nanos_since_epoch) && (v.nanos_since_epoch as number) < 1e9);
const locationId = (v: unknown) => v === null || integer(v);
const roles = (v: unknown) => Array.isArray(v) && v.every(r => r === 'Editor' || r === 'Scheduler');
const user = (v: unknown) => record(v) && integer(v.id) && typeof v.name === 'string' && typeof v.team === 'string' && attendance(v.attendance_mode) && roles(v.roles);
const users = (v: unknown) => record(v) && Object.entries(v).every(([id, u]) => user(u) && record(u) && String(u.id) === id);
const talk = (v: unknown) => record(v) && integer(v.id) && integer(v.creator) && typeof v.title === 'string' && typeof v.description === 'string' && typeof v.highlight === 'boolean' && timestamp(v.scheduled_at) && duration(v.duration) && (v.creator_duration === null || duration(v.creator_duration)) && locationId(v.location) && ids(v.nerds) && ids(v.noobs);

export function parseMessage(text: string): ServerMessage {
  const message: unknown = JSON.parse(text);
  if (!record(message) || Object.keys(message).length !== 1) throw new Error('Invalid server message');
  const [kind, payload] = Object.entries(message)[0];
  if (!record(payload)) throw new Error('Invalid server payload');
  let valid = false;
  switch (kind) {
    case 'CommandResult': valid = integer(payload.id) && (payload.error === null || typeof payload.error === 'string'); break;
    case 'State':
      valid = users(payload.users) && record(payload.talks) && Object.entries(payload.talks).every(([id, t]) => talk(t) && record(t) && String(t.id) === id);
      parseTeams(payload.teams);
      parseLocations(payload.locations);
      break;
    case 'AuthenticationSuccess': valid = integer(payload.user_id) && typeof payload.token === 'string' && Array.isArray(payload.roles) && payload.roles.every(r => r === 'Editor' || r === 'Scheduler'); break;
    case 'AuthenticationError': valid = typeof payload.reason === 'string'; break;
    case 'Users': valid = users(payload.users); break;
    case 'AddTalk': valid = talk(payload.talk); break;
    case 'RemoveTalk': valid = integer(payload.talk_id); break;
    case 'UpdateTitle': valid = integer(payload.talk_id) && typeof payload.title === 'string'; break;
    case 'UpdateDescription': valid = integer(payload.talk_id) && typeof payload.description === 'string'; break;
    case 'UpdateScheduledAt': valid = integer(payload.talk_id) && timestamp(payload.scheduled_at); break;
    case 'UpdateDuration': valid = integer(payload.talk_id) && duration(payload.duration) && duration(payload.creator_duration); break;
    case 'UpdateLocation': valid = integer(payload.talk_id) && locationId(payload.location); break;
    case 'AddNoob': case 'RemoveNoob': case 'AddNerd': case 'RemoveNerd': valid = integer(payload.talk_id) && integer(payload.user_id); break;
    case 'UpdateAttendanceMode': valid = integer(payload.user_id) && attendance(payload.attendance_mode); break;
  }
  if (!valid) throw new Error(`Invalid ${kind} message`);
  return message as ServerMessage;
}

export function parseConfig(value: unknown): EventConfig {
  const range = (r: unknown) => record(r) && typeof r.start === 'string' && typeof r.end === 'string' && r.start.endsWith('Z') && r.end.endsWith('Z') && Date.parse(r.start) >= 0 && Date.parse(r.start) < Date.parse(r.end);
  if (!record(value) || !range(value) || !Array.isArray(value.opening_hours) || !Array.isArray(value.breaks)) throw new Error('Invalid event configuration');
  for (const interval of [...value.opening_hours, ...value.breaks]) {
    if (!range(interval) || Date.parse(interval.start) < Date.parse(value.start as string) || Date.parse(interval.end) > Date.parse(value.end as string)) throw new Error('Invalid event interval');
  }
  if (!value.breaks.every(b => typeof b.label === 'string' && b.label.trim())) throw new Error('Invalid break label');
  return value as EventConfig;
}

export function parseTeams(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(t => typeof t === 'string')) throw new Error('Invalid teams');
  return value;
}

export function parseLocations(value: unknown): Record<number, Location> {
  if (!record(value) || !Object.entries(value).every(([id, l]) => record(l) && integer(l.id) && String(l.id) === id && typeof l.name === 'string' && (l.live_stream === null || typeof l.live_stream === 'string'))) throw new Error('Invalid locations');
  return value as Record<number, Location>;
}

export function applyUpdate(data: Data, message: Update) {
  if ('State' in message) { data.users = message.State.users; data.talks = message.State.talks; return; }
  if ('CommandResult' in message) return;
  if ('Users' in message) { data.users = message.Users.users; return; }
  if ('AddTalk' in message) { data.talks[message.AddTalk.talk.id] = message.AddTalk.talk; return; }
  if ('RemoveTalk' in message) { delete data.talks[message.RemoveTalk.talk_id]; return; }
  if ('UpdateAttendanceMode' in message) {
    const { user_id, attendance_mode } = message.UpdateAttendanceMode;
    if (data.users[user_id]) data.users[user_id].attendance_mode = attendance_mode;
    return;
  }
  if ('UpdateTitle' in message) { const p = message.UpdateTitle; if (data.talks[p.talk_id]) data.talks[p.talk_id].title = p.title; }
  else if ('UpdateDescription' in message) { const p = message.UpdateDescription; if (data.talks[p.talk_id]) data.talks[p.talk_id].description = p.description; }
  else if ('UpdateScheduledAt' in message) { const p = message.UpdateScheduledAt; if (data.talks[p.talk_id]) data.talks[p.talk_id].scheduled_at = p.scheduled_at; }
  else if ('UpdateDuration' in message) { const p = message.UpdateDuration; if (data.talks[p.talk_id]) { data.talks[p.talk_id].duration = p.duration; data.talks[p.talk_id].creator_duration = p.creator_duration; } }
  else if ('UpdateLocation' in message) { const p = message.UpdateLocation; if (data.talks[p.talk_id]) data.talks[p.talk_id].location = p.location; }
  else {
    const [kind, p] = Object.entries(message)[0] as [string, { talk_id: number; user_id: number }];
    const t = data.talks[p.talk_id];
    if (!t) return;
    const key = kind.endsWith('Noob') ? 'noobs' : 'nerds';
    if (kind.startsWith('Add')) t[key] = [...new Set([...t[key], p.user_id])];
    else t[key] = t[key].filter(id => id !== p.user_id);
  }
}
