export interface Duration {
  secs: number;
  nanos: number;
}

export interface SystemTime {
  secs_since_epoch: number;
  nanos_since_epoch: number;
}

export enum ParticipationKind {
  Noob = "Noob",
  Nerd = "Nerd",
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
  attendance_mode: AttendanceMode;
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
export interface AddTalkPayload {
  title: string;
  description: string;
  duration: Duration;
}

export interface RemoveTalkPayload {
  talk_id: number;
}

export interface UpdateTitlePayload {
  talk_id: number;
  title: string;
}

export interface UpdateDescriptionPayload {
  talk_id: number;
  description: string;
}

export interface UpdateScheduledAtPayload {
  talk_id: number;
  scheduled_at: SystemTime | null;
}

export interface UpdateDurationPayload {
  talk_id: number;
  duration: Duration;
}

export interface UpdateLocationPayload {
  talk_id: number;
  location: string | null;
}

export interface TalkUserPayload {
  talk_id: number;
}

export type AddTalkCommand = { AddTalk: AddTalkPayload };
export type RemoveTalkCommand = { RemoveTalk: RemoveTalkPayload };
export type UpdateTitleCommand = { UpdateTitle: UpdateTitlePayload };
export type UpdateDescriptionCommand = {
  UpdateDescription: UpdateDescriptionPayload;
};
export type UpdateScheduledAtCommand = {
  UpdateScheduledAt: UpdateScheduledAtPayload;
};
export type UpdateDurationCommand = { UpdateDuration: UpdateDurationPayload };
export type UpdateLocationCommand = { UpdateLocation: UpdateLocationPayload };
export type AddNoobCommand = { AddNoob: TalkUserPayload };
export type RemoveNoobCommand = { RemoveNoob: TalkUserPayload };
export type AddNerdCommand = { AddNerd: TalkUserPayload };
export type RemoveNerdCommand = { RemoveNerd: TalkUserPayload };

export type Command =
  | AddTalkCommand
  | RemoveTalkCommand
  | UpdateTitleCommand
  | UpdateDescriptionCommand
  | UpdateScheduledAtCommand
  | UpdateDurationCommand
  | UpdateLocationCommand
  | AddNoobCommand
  | RemoveNoobCommand
  | AddNerdCommand
  | RemoveNerdCommand;

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
