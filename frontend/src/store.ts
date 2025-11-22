import { signal, effect } from "@preact/signals";
import type { Talk, User, AuthCommand, Command, AttendanceMode } from "./types";

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

export function connect() {
  // 1. Clean up existing connection to prevent phantom "disconnected" events
  if (socket) {
    socket.onclose = null; // Remove listener so we don't trigger state change
    socket.close();
    socket = null;
  }

  connectionStatus.value = "connecting";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/api`);

  socket.onopen = () => {
    connectionStatus.value = "connected";

    // Priority 1: Manual Login/Register
    if (pendingAuthCommand) {
      sendAuth(pendingAuthCommand);
      pendingAuthCommand = null;
      return;
    }

    // Priority 2: Auto-Relogin
    const token = localStorage.getItem("reloginToken");
    if (token) {
      sendAuth({ Relogin: { token } });
    }
  };

  socket.onclose = () => {
    connectionStatus.value = "disconnected";
    currentUser.value = null;
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
}

export function loginOrRegister(cmd: AuthCommand) {
  // Queue the command and force a fresh connection
  localStorage.removeItem("reloginToken");
  pendingAuthCommand = cmd;
  authError.value = null;
  connect();
}

function handleMessage(msg: any) {
  if (msg.AuthenticationSuccess) {
    const { user_id, roles, token } = msg.AuthenticationSuccess;
    localStorage.setItem("reloginToken", token);
    effect(() => {
      if (users.value[user_id]) {
        currentUser.value = { ...users.value[user_id], roles };
      }
    });
  } else if (msg.AuthenticationError) {
    authError.value = msg.AuthenticationError.reason;
    localStorage.removeItem("reloginToken");
  } else if (msg.Users) {
    const newUsers: Record<number, User> = {};
    Object.values(msg.Users.users).forEach((u: any) => {
      newUsers[u.id] = { ...u, roles: [] };
    });
    users.value = newUsers;
  } else if (msg.AddTalk) {
    const t = msg.AddTalk.talk;
    talks.value = { ...talks.value, [t.id]: t };
  } else if (msg.RemoveTalk) {
    const { [msg.RemoveTalk.talk_id]: _, ...rest } = talks.value;
    talks.value = rest;
  } else if (msg.UpdateTitle) {
    patchTalk(msg.UpdateTitle.talk_id, { title: msg.UpdateTitle.title });
  } else if (msg.UpdateDescription) {
    patchTalk(msg.UpdateDescription.talk_id, {
      description: msg.UpdateDescription.description,
    });
  } else if (msg.UpdateScheduledAt) {
    patchTalk(msg.UpdateScheduledAt.talk_id, {
      scheduled_at: msg.UpdateScheduledAt.scheduled_at,
    });
  } else if (msg.UpdateDuration) {
    patchTalk(msg.UpdateDuration.talk_id, {
      duration: msg.UpdateDuration.duration,
    });
  } else if (msg.UpdateLocation) {
    patchTalk(msg.UpdateLocation.talk_id, {
      location: msg.UpdateLocation.location,
    });
  } else if (msg.AddNoob) {
    const t = talks.value[msg.AddNoob.talk_id];
    if (t) patchTalk(t.id, { noobs: [...t.noobs, msg.AddNoob.user_id] });
  } else if (msg.RemoveNoob) {
    const t = talks.value[msg.RemoveNoob.talk_id];
    if (t)
      patchTalk(t.id, {
        noobs: t.noobs.filter((id) => id !== msg.RemoveNoob.user_id),
      });
  } else if (msg.AddNerd) {
    const t = talks.value[msg.AddNerd.talk_id];
    if (t) patchTalk(t.id, { nerds: [...t.nerds, msg.AddNerd.user_id] });
  } else if (msg.RemoveNerd) {
    const t = talks.value[msg.RemoveNerd.talk_id];
    if (t)
      patchTalk(t.id, {
        nerds: t.nerds.filter((id) => id !== msg.RemoveNerd.user_id),
      });
  } else if (msg.UpdateAttendanceMode) {
    const user_id = msg.UpdateAttendanceMode.user_id;
    const mode: AttendanceMode = msg.UpdateAttendanceMode.attendance_mode;
    users.value = {
      ...users.value,
      [user_id]: {
        ...users.value[user_id],
        attendance_mode: mode,
      },
    };
  } else {
    console.log("Unknown message", msg);
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
