import { signal, effect } from "@preact/signals";
import type {
  Talk,
  User,
  AuthCommand,
  Command,
  ServerMessage,
  Location,
} from "./types";

export const currentUser = signal<User | null>(null);
export const users = signal<Record<number, User>>({});
export const talks = signal<Record<number, Talk>>({});
export const teams = signal<string[]>([]);
export const locations = signal<Record<number, Location>>([]);
export const connectionStatus = signal<
  "connecting" | "connected" | "disconnected"
>("connecting");
export const authError = signal<string | null>(null);

export const currentTimeSecs = signal(Math.floor(Date.now() / 1000));
setInterval(() => {
  currentTimeSecs.value = Math.floor(Date.now() / 1000);
}, 60000);

let socket: WebSocket | null = null;
let pendingAuthCommand: AuthCommand | null = null;
let reconnectTimeout: number | undefined;
const RECONNECT_DELAY = 5000;

export function connect() {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }

  clearTimeout(reconnectTimeout);

  connectionStatus.value = "connecting";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/api`);

  socket.onopen = () => {
    connectionStatus.value = "connected";

    if (pendingAuthCommand) {
      sendAuth(pendingAuthCommand);
      pendingAuthCommand = null;
      return;
    }

    const token = localStorage.getItem("reloginToken");
    if (token) {
      sendAuth({ Relogin: { token } });
    }
  };

  socket.onclose = () => {
    connectionStatus.value = "disconnected";
    currentUser.value = null;

    reconnectTimeout = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
}

export function loginOrRegister(cmd: AuthCommand) {
  localStorage.removeItem("reloginToken");
  pendingAuthCommand = cmd;
  authError.value = null;
  connect();
}

function handleMessage(msg: ServerMessage) {
  if ("AuthenticationSuccess" in msg) {
    const { user_id, roles, token } = msg.AuthenticationSuccess;
    localStorage.setItem("reloginToken", token);
    effect(() => {
      if (users.value[user_id]) {
        currentUser.value = { ...users.value[user_id], roles };
      }
    });
    return;
  }

  if ("AuthenticationError" in msg) {
    authError.value = msg.AuthenticationError.reason;
    localStorage.removeItem("reloginToken");
    return;
  }

  if ("Users" in msg) {
    const newUsers: Record<number, User> = {};
    Object.values(msg.Users.users).forEach((u) => {
      newUsers[u.id] = { ...u, roles: [] }; // Reset roles as they are session-specific
    });
    users.value = newUsers;
    return;
  }

  if ("AddTalk" in msg) {
    const t = msg.AddTalk.talk;
    talks.value = { ...talks.value, [t.id]: t };
    return;
  }

  if ("RemoveTalk" in msg) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [msg.RemoveTalk.talk_id]: _, ...rest } = talks.value;
    talks.value = rest;
    return;
  }

  // Handle distinct updates via a helper to keep this function clean
  if ("UpdateTitle" in msg) {
    patchTalk(msg.UpdateTitle.talk_id, { title: msg.UpdateTitle.title });
  } else if ("UpdateDescription" in msg) {
    patchTalk(msg.UpdateDescription.talk_id, {
      description: msg.UpdateDescription.description,
    });
  } else if ("UpdateScheduledAt" in msg) {
    patchTalk(msg.UpdateScheduledAt.talk_id, {
      scheduled_at: msg.UpdateScheduledAt.scheduled_at,
    });
  } else if ("UpdateDuration" in msg) {
    patchTalk(msg.UpdateDuration.talk_id, {
      duration: msg.UpdateDuration.duration,
    });
  } else if ("UpdateLocation" in msg) {
    patchTalk(msg.UpdateLocation.talk_id, {
      location: msg.UpdateLocation.location,
    });
  } else if ("AddNoob" in msg) {
    const t = talks.value[msg.AddNoob.talk_id];
    if (t) patchTalk(t.id, { noobs: [...t.noobs, msg.AddNoob.user_id] });
  } else if ("RemoveNoob" in msg) {
    const t = talks.value[msg.RemoveNoob.talk_id];
    if (t)
      patchTalk(t.id, {
        noobs: t.noobs.filter((id) => id !== msg.RemoveNoob.user_id),
      });
  } else if ("AddNerd" in msg) {
    const t = talks.value[msg.AddNerd.talk_id];
    if (t) patchTalk(t.id, { nerds: [...t.nerds, msg.AddNerd.user_id] });
  } else if ("RemoveNerd" in msg) {
    const t = talks.value[msg.RemoveNerd.talk_id];
    if (t)
      patchTalk(t.id, {
        nerds: t.nerds.filter((id) => id !== msg.RemoveNerd.user_id),
      });
  } else if ("UpdateAttendanceMode" in msg) {
    const { user_id, attendance_mode } = msg.UpdateAttendanceMode;
    if (users.value[user_id]) {
      users.value = {
        ...users.value,
        [user_id]: { ...users.value[user_id], attendance_mode },
      };
    }
  }
}

function patchTalk(id: number, changes: Partial<Talk>) {
  if (talks.value[id]) {
    talks.value = { ...talks.value, [id]: { ...talks.value[id], ...changes } };
  }
}

export function sendAuth(cmd: AuthCommand) {
  socket?.send(JSON.stringify(cmd));
}

export function sendCommand(cmd: Command) {
  socket?.send(JSON.stringify(cmd));
}

export async function fetchTeams() {
  const res = await fetch("/teams.json");
  teams.value = await res.json();
}

export async function fetchLocations() {
  const res = await fetch("/locations.json");
  locations.value = await res.json();
}
