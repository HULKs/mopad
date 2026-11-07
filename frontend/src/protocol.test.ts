import { expect, test } from 'bun:test';
import { applyUpdate, parseMessage, parseConfig, parseLocations, type Data } from './protocol';
import type { Talk } from './generated/Talk';

const talk: Talk = { id: 1, creator: 0, title: 'Hello', description: '', highlight: false, duration: { secs: 1800, nanos: 0 }, creator_duration: { secs: 1800, nanos: 0 }, scheduled_at: null, location: null, nerds: [0], noobs: [] };

test('parses authentication and rejects malformed wire messages', () => {
  expect(parseMessage(JSON.stringify({ AddTalk: { talk: { ...talk, highlight: true } } }))).toHaveProperty('AddTalk.talk.highlight', true);
  expect(() => parseMessage(JSON.stringify({ AddTalk: { talk: { ...talk, highlight: 'yes' } } }))).toThrow();
  expect(parseMessage('{"AuthenticationSuccess":{"user_id":0,"token":"token","roles":["Scheduler"]}}')).toHaveProperty('AuthenticationSuccess');
  for (const text of ['null', '{}', '{"Surprise":{}}', '{"AddTalk":{"talk":{}}}', '{"Users":{"users":{"1":{"id":2,"name":"A","team":"T","attendance_mode":"Remote"}}}}', '{"UpdateDuration":{"talk_id":1,"duration":{"secs":-1,"nanos":0}}}']) expect(() => parseMessage(text)).toThrow();
});

test('applies live updates without duplicate participants or stale deleted talks', () => {
  const data: Data = { users: {}, talks: {} };
  applyUpdate(data, parseMessage(JSON.stringify({ AddTalk: { talk: structuredClone(talk) } })) as { AddTalk: { talk: Talk } });
  applyUpdate(data, { AddNoob: { talk_id: 1, user_id: 2 } });
  applyUpdate(data, { AddNoob: { talk_id: 1, user_id: 2 } });
  expect(data.talks[1].noobs).toEqual([2]);
  applyUpdate(data, { RemoveNoob: { talk_id: 1, user_id: 2 } });
  applyUpdate(data, { UpdateTitle: { talk_id: 1, title: 'Updated' } });
  applyUpdate(data, { UpdateDescription: { talk_id: 1, description: 'Details' } });
  applyUpdate(data, { UpdateLocation: { talk_id: 1, location: 3 } });
  applyUpdate(data, { UpdateDuration: { talk_id: 1, duration: { secs: 900, nanos: 0 }, creator_duration: { secs: 1800, nanos: 0 } } });
  expect(data.talks[1].creator_duration?.secs).toBe(1800);
  applyUpdate(data, { UpdateScheduledAt: { talk_id: 1, scheduled_at: { secs_since_epoch: 123, nanos_since_epoch: 0 } } });
  expect(data.talks[1]).toMatchObject({ title: 'Updated', description: 'Details', location: 3, noobs: [], duration: { secs: 900 }, scheduled_at: { secs_since_epoch: 123 } });
  applyUpdate(data, { Users: { users: { 0: { id: 0, name: 'Alice', team: 'Alpha', attendance_mode: 'OnSite', roles: [] } } } });
  applyUpdate(data, { UpdateAttendanceMode: { user_id: 0, attendance_mode: 'Remote' } });
  expect(data.users[0].attendance_mode).toBe('Remote');
  applyUpdate(data, { RemoveTalk: { talk_id: 1 } });
  applyUpdate(data, { UpdateTitle: { talk_id: 1, title: 'Deleted' } });
  expect(data.talks).toEqual({});
});

test('snapshot replaces deleted records and carries rooms, teams, and roles', () => {
  const data: Data = { users: {}, talks: { 1: structuredClone(talk) } };
  const message = parseMessage(JSON.stringify({ State: {
    users: { 0: { id: 0, name: 'Alice', team: 'Alpha', attendance_mode: 'OnSite', roles: ['Scheduler'] } },
    talks: {}, teams: ['Alpha'], locations: { 2: { id: 2, name: 'New room', live_stream: null } },
  } }));
  if (!('State' in message)) throw new Error('Expected snapshot');
  applyUpdate(data, message);
  expect(data.talks).toEqual({});
  expect(data.users[0].roles).toEqual(['Scheduler']);
  expect(message.State.locations[2].name).toBe('New room');
  expect(parseMessage('{"CommandResult":{"id":1,"error":null}}')).toHaveProperty('CommandResult.error', null);
  expect(() => parseMessage('{"CommandResult":{"id":1,"error":false}}')).toThrow();
});

test('validates public configuration and locations', () => {
  const config = { start: '2026-11-20T08:00:00Z', end: '2026-11-22T18:00:00Z', opening_hours: [], breaks: [] };
  expect(parseConfig(config)).toEqual(config);
  expect(() => parseConfig({ ...config, end: config.start })).toThrow();
  expect(() => parseConfig({ ...config, start: '2026-11-20T08:00:00' })).toThrow();
  expect(() => parseConfig({ ...config, breaks: [{ label: 'Bad break', start: config.end, end: '2026-11-23T18:00:00Z' }] })).toThrow();
  expect(parseLocations({ 1: { id: 1, name: 'Hall', live_stream: null } })).toHaveProperty('1');
  expect(() => parseLocations({ 1: { id: 2, name: 'Hall', live_stream: null } })).toThrow();
});
