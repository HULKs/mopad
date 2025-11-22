// src/types.ts

export interface Duration {
  secs: number;
  nanos: number;
}

export interface SystemTime {
  secs_since_epoch: number;
  nanos_since_epoch: number;
}

export enum Role {
  Editor = "Editor",
  Scheduler = "Scheduler",
}

export interface User {
  id: number;
  name: string;
  team: string;
  roles: Role[];
}

export interface Talk {
  id: number;
  creator: number;
  title: string;
  description: string;
  scheduled_at: SystemTime | null;
  duration: Duration;
  location: string | null;
  nerds: number[];
  noobs: number[];
}

// WebSocket Messages
export type Command =
  | { AddTalk: { title: string; description: string; duration: Duration } }
  | { RemoveTalk: { talk_id: number } }
  | { UpdateTitle: { talk_id: number; title: string } }
  | { UpdateDescription: { talk_id: number; description: string } }
  | { UpdateScheduledAt: { talk_id: number; scheduled_at: SystemTime | null } }
  | { UpdateDuration: { talk_id: number; duration: Duration } }
  | { UpdateLocation: { talk_id: number; location: string | null } }
  | { AddNoob: { talk_id: number; user_id: number } }
  | { RemoveNoob: { talk_id: number; user_id: number } }
  | { AddNerd: { talk_id: number; user_id: number } }
  | { RemoveNerd: { talk_id: number; user_id: number } };

export type AuthCommand =
  | {
      Register: {
        name: string;
        team: string;
        password: string;
        attendance_mode: null | AttendanceMode;
      };
    }
  | { Login: { name: string; team: string; password: string } }
  | { Relogin: { token: string } };

export enum AttendanceMode {
  OnSite = "OnSite",
  Remote = "Remote",
}
