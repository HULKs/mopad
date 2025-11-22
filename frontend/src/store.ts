import { signal, effect } from "@preact/signals";
import type { Talk, User, AuthCommand, Command } from "./types";

export const currentUser = signal<User | null>(null);
export const users = signal<Record<number, User>>({});
export const talks = signal<Record<number, Talk>>({});
export const teams = signal<string[]>([]);
export const connectionStatus = signal<
  "connecting" | "connected" | "disconnected"
>("connecting");
export const authError = signal<string | null>(null);

export const currentTimeSecs = signal(Math.floor(Date.now() / 1000));
setInterval(() => {
  currentTimeSecs.value = Math.floor(Date.now() / 1000);
}, 60000);

let socket: WebSocket | null = null;

export function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/api`);

  socket.onopen = () => {
    connectionStatus.value = "connected";
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

function handleMessage(msg: any) {
  if (msg.AuthenticationSuccess) {
    const { user_id, roles, token } = msg.AuthenticationSuccess;
    localStorage.setItem("reloginToken", token);
    // We need to wait for the Users update to fully hydrate the current user object
    // But we can store the ID for now or handle it when users arrive
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
    // Rust BTreeMap serializes to a JSON Object, not an Array.
    // We use Object.values() to iterate over the users.
    Object.values(msg.Users.users).forEach((u: any) => {
      // u is the User object { id: 1, name: "...", team: "..." }
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
  }
}

function patchTalk(id: number, changes: Partial<Talk>) {
  if (talks.value[id]) {
    talks.value = { ...talks.value, [id]: { ...talks.value[id], ...changes } };
  }
}

export function sendAuth(cmd: AuthCommand) {
  console.log(cmd);
  socket?.send(JSON.stringify(cmd));
}

export function sendCommand(cmd: Command) {
  socket?.send(JSON.stringify(cmd));
}

export async function fetchTeams() {
  const res = await fetch("/teams.json");
  teams.value = await res.json();
}
