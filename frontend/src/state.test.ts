import { afterAll, expect, test } from 'bun:test';
import { plugin } from 'bun';
import { compileModule } from 'svelte/compiler';

// Bun does not transform Svelte's module runes itself.
plugin({ name: 'svelte-state-test', setup(build) {
  build.onLoad({ filter: /state\.svelte\.ts$/ }, async ({ path }) => ({
    contents: compileModule(new Bun.Transpiler({ loader: 'ts' }).transformSync(await Bun.file(path).text()), { filename: path, generate: 'client' }).js.code,
    loader: 'js',
  }));
} });

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  sent: { id: number; command: unknown }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() { Socket.latest = this; }
  send(text: string) { this.sent.push(JSON.parse(text)); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

const originals = Object.fromEntries(['WebSocket', 'localStorage', 'location', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const tokens = new Map<string, string>();
const config = { start: '2026-11-20T08:00:00Z', end: '2026-11-22T18:00:00Z', opening_hours: [], breaks: [] };
Object.defineProperties(globalThis, {
  WebSocket: { configurable: true, value: Socket },
  localStorage: { configurable: true, value: { getItem: (key: string) => tokens.get(key) ?? null, setItem: (key: string, value: string) => tokens.set(key, value), removeItem: (key: string) => tokens.delete(key) } },
  location: { configurable: true, value: { protocol: 'http:', host: 'localhost' } },
  fetch: { configurable: true, value: async (path: string) => ({ ok: true, json: async () => path === '/config.json' ? config : path === '/teams.json' ? ['Team'] : {} }) },
});

const { app, start, stop, sendCommand } = await import('./state.svelte');
afterAll(() => {
  stop();
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('saves wait for confirmation; rejection and reconnect preserve the editor state', async () => {
  await start();
  const socket = Socket.latest;
  socket.receive({ AuthenticationSuccess: { user_id: 0, roles: ['Scheduler'], token: 'token' } });
  socket.receive({ State: { users: { 0: { id: 0, name: 'Alice', team: 'Team', attendance_mode: 'OnSite', roles: ['Scheduler'] } }, talks: {}, locations: {}, teams: ['Team'] } });
  let finished = false;
  const save = sendCommand({ UpdateTitle: { talk_id: 1, title: 'Draft' } }).then(saved => { finished = true; return saved; });
  await Promise.resolve();
  expect(finished).toBe(false);
  socket.receive({ CommandResult: { id: socket.sent.at(-1)!.id, error: 'Talk was deleted' } });
  expect(await save).toBe(false);
  expect(app.error).toBe('Talk was deleted');
  expect(app.userId).toBe(0);
  const accepted = sendCommand({ SetAttendanceMode: { attendance_mode: 'Remote' } });
  socket.receive({ CommandResult: { id: socket.sent.at(-1)!.id, error: null } });
  expect(await accepted).toBe(true);
  app.scheduler = { original: {}, draft: {} };
  const interrupted = sendCommand({ UpdateTitle: { talk_id: 1, title: 'Keep me' } });
  socket.close();
  expect(await interrupted).toBe(false);
  expect(app.userId).toBe(0);
  expect(app.scheduler).not.toBeNull();
  expect(app.data.users[0].name).toBe('Alice');
  await start();
  expect(app.scheduler).not.toBeNull();
  expect(await sendCommand({ Logout: {} })).toBe(false);
  stop();
});
