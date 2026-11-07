import type { AuthenticationCommand } from './generated/AuthenticationCommand';
import type { Command } from './generated/Command';
import type { Role } from './generated/Role';
import type { Location } from './generated/Location';
import type { EventConfig } from './generated/EventConfig';
import type { Talk } from './generated/Talk';
import { applyUpdate, parseConfig, parseLocations, parseMessage, parseTeams, type Data } from './protocol';

export const app = $state({
  data: { users: {}, talks: {} } as Data,
  teams: [] as string[],
  locations: {} as Record<number, Location>,
  config: null as EventConfig | null,
  scheduler: null as { original: Record<number, Talk>; draft: Record<number, Talk> } | null,
  userId: null as number | null,
  roles: [] as Role[],
  connection: 'disconnected' as 'connecting' | 'connected' | 'disconnected',
  authenticating: false,
  restoring: false,
  error: '',
  now: Math.floor(Date.now() / 1000),
});

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let stopped = true;
let nextCommandId = 0;
const pending = new Map<number, (saved: boolean) => void>();

function failPending() {
  if (pending.size) app.error = 'Connection lost before confirmation. Check the current data before retrying; your draft was kept.';
  for (const resolve of pending.values()) resolve(false);
  pending.clear();
}

function disconnect() {
  failPending();
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function connect(command?: AuthenticationCommand) {
  disconnect();
  app.connection = 'connecting';
  app.authenticating = !!command || !!localStorage.getItem('reloginToken');
  app.restoring = !command && app.authenticating;
  if (command) {
    app.userId = null;
    app.roles = [];
    app.data = { users: {}, talks: {} };
  }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api`);
  socket = ws;
  ws.onopen = () => {
    if (socket !== ws) return;
    app.connection = 'connected';
    const token = localStorage.getItem('reloginToken');
    const auth = command ?? (token ? { Relogin: { token } } : null);
    if (auth) ws.send(JSON.stringify(auth));
  };
  ws.onmessage = event => {
    if (socket !== ws) return;
    try {
      const message = parseMessage(event.data);
      if ('AuthenticationSuccess' in message) {
        const { user_id, roles, token } = message.AuthenticationSuccess;
        localStorage.setItem('reloginToken', token);
        app.userId = user_id;
        app.roles = roles;
        app.authenticating = false;
      } else if ('AuthenticationError' in message) {
        localStorage.removeItem('reloginToken');
        app.error = message.AuthenticationError.reason;
        app.authenticating = false;
        app.scheduler = null;
        app.userId = null;
        app.roles = [];
        app.data = { users: {}, talks: {} };
        failPending();
        ws.onclose = null;
        ws.close();
        app.connection = 'disconnected';
      } else if ('CommandResult' in message) {
        const { id, error } = message.CommandResult;
        if (error) app.error = error;
        pending.get(id)?.(error === null);
        pending.delete(id);
      } else {
        applyUpdate(app.data, message);
        if ('State' in message) {
          app.teams = message.State.teams;
          app.locations = message.State.locations;
        }
        if (app.userId !== null) app.roles = app.data.users[app.userId]?.roles ?? [];
      }
    } catch (error) {
      app.error = error instanceof Error ? error.message : 'Could not read server update';
      ws.close();
    }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    const reconnect = !stopped && !!localStorage.getItem('reloginToken');
    failPending();
    app.connection = 'disconnected';
    app.authenticating = reconnect;
    app.restoring = reconnect;
    if (reconnect) reconnectTimer = setTimeout(() => void start(), 2000);
    else if (command) app.error = 'Connection lost. Please try again.';
  };
}

export async function start() {
  stopped = false;
  clearTimeout(reconnectTimer);
  try {
    const responses = await Promise.all(['/config.json', '/teams.json', '/locations.json'].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
      return response.json() as Promise<unknown>;
    }));
    if (stopped) return;
    const config = parseConfig(responses[0]);
    const teams = parseTeams(responses[1]);
    const locations = parseLocations(responses[2]);
    app.config = config;
    app.teams = teams;
    app.locations = locations;
    connect();
  } catch (error) {
    if (stopped) return;
    app.error = error instanceof Error ? error.message : 'Could not load application';
    if (localStorage.getItem('reloginToken')) reconnectTimer = setTimeout(() => void start(), 2000);
  }
}

export function stop() { stopped = true; disconnect(); }

export function authenticate(command: AuthenticationCommand) {
  localStorage.removeItem('reloginToken');
  app.error = '';
  app.scheduler = null;
  connect(command);
}

export async function sendCommand(command: Command): Promise<boolean> {
  if (!socket || socket.readyState !== WebSocket.OPEN || app.userId === null || app.authenticating) {
    app.error = 'Not connected. Your change was not sent.';
    return false;
  }
  const id = ++nextCommandId;
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      app.error = 'No save confirmation received. Check the current data before retrying.';
      socket?.close();
      failPending();
    }, 15000);
    pending.set(id, saved => { clearTimeout(timeout); resolve(saved); });
    try { socket!.send(JSON.stringify({ id, command })); }
    catch { failPending(); }
  });
}

export async function logout() {
  if (!await sendCommand({ Logout: {} })) return;
  disconnect();
  localStorage.removeItem('reloginToken');
  app.userId = null;
  app.roles = [];
  app.scheduler = null;
  app.data = { users: {}, talks: {} };
  app.error = '';
  connect();
}
