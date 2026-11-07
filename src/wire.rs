use std::{
    collections::{BTreeMap, BTreeSet},
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub type UserId = usize;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
pub enum AttendanceMode {
    OnSite,
    Remote,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize, TS)]
pub enum Role {
    Editor,
    Scheduler,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Talk {
    pub id: usize,
    pub creator: UserId,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub highlight: bool,
    #[ts(as = "Option<crate::bindings::SystemTime>")]
    pub scheduled_at: Option<SystemTime>,
    #[ts(as = "crate::bindings::Duration")]
    pub duration: Duration,
    #[serde(default)]
    #[ts(as = "Option<crate::bindings::Duration>")]
    pub creator_duration: Option<Duration>,
    pub location: Option<usize>,
    pub nerds: BTreeSet<usize>,
    pub noobs: BTreeSet<usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Location {
    pub id: usize,
    pub name: String,
    pub live_stream: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct TimeRange {
    pub start: String,
    pub end: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Break {
    pub label: String,
    pub start: String,
    pub end: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct EventConfig {
    pub start: String,
    pub end: String,
    #[serde(default)]
    pub opening_hours: Vec<TimeRange>,
    #[serde(default)]
    pub breaks: Vec<Break>,
}

#[derive(Debug, Deserialize, TS)]
pub struct CommandRequest {
    pub id: usize,
    pub command: Command,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, TS)]
pub struct Schedule {
    #[ts(as = "Option<crate::bindings::SystemTime>")]
    pub scheduled_at: Option<SystemTime>,
    #[ts(as = "crate::bindings::Duration")]
    pub duration: Duration,
    pub location: Option<usize>,
}

impl From<&Talk> for Schedule {
    fn from(talk: &Talk) -> Self {
        Self {
            scheduled_at: talk.scheduled_at,
            duration: talk.duration,
            location: talk.location,
        }
    }
}

/// Authentication command sent by the client.
#[derive(Clone, Debug, Deserialize, TS)]
pub enum AuthenticationCommand {
    Register {
        name: String,
        team: String,
        attendance_mode: Option<AttendanceMode>,
        password: String,
    },
    Login {
        name: String,
        team: String,
        password: String,
    },
    Relogin {
        token: String,
    },
}

/// Server response to an authentication command.
#[derive(Clone, Debug, Serialize, TS)]
pub enum AuthenticationResponse {
    AuthenticationSuccess {
        user_id: usize,
        roles: BTreeSet<Role>,
        token: String,
    },
    AuthenticationError {
        reason: String,
    },
}

/// Commands are sent from the client to the server to request changes.
#[derive(Clone, Debug, Deserialize, TS)]
pub enum Command {
    Logout {},
    ScheduleTalk {
        talk_id: usize,
        before: Schedule,
        after: Schedule,
    },
    AddTalk {
        title: String,
        description: String,
        #[ts(as = "crate::bindings::Duration")]
        duration: Duration,
    },
    RemoveTalk {
        talk_id: usize,
    },
    UpdateTitle {
        talk_id: usize,
        title: String,
    },
    UpdateDescription {
        talk_id: usize,
        description: String,
    },
    UpdateScheduledAt {
        talk_id: usize,
        #[ts(as = "Option<crate::bindings::SystemTime>")]
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        #[ts(as = "crate::bindings::Duration")]
        duration: Duration,
    },
    UpdateLocation {
        talk_id: usize,
        location: Option<usize>,
    },
    AddNoob {
        talk_id: usize,
    },
    RemoveNoob {
        talk_id: usize,
    },
    AddNerd {
        talk_id: usize,
    },
    RemoveNerd {
        talk_id: usize,
    },
    SetAttendanceMode {
        attendance_mode: AttendanceMode,
    },
}

#[allow(clippy::enum_variant_names)]
/// Update messages are sent from the server to the client to inform the client of changes to the
/// state of the server.
#[derive(Clone, Debug, Serialize, TS)]
pub enum Update {
    CommandResult {
        id: usize,
        error: Option<String>,
    },
    State {
        users: BTreeMap<usize, UserReference>,
        talks: BTreeMap<usize, Talk>,
        teams: BTreeSet<String>,
        locations: BTreeMap<usize, Location>,
    },
    Users {
        users: BTreeMap<usize, UserReference>,
    },
    AddTalk {
        talk: Talk,
    },
    RemoveTalk {
        talk_id: usize,
    },
    UpdateTitle {
        talk_id: usize,
        title: String,
    },
    UpdateDescription {
        talk_id: usize,
        description: String,
    },
    UpdateScheduledAt {
        talk_id: usize,
        #[ts(as = "Option<crate::bindings::SystemTime>")]
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        #[ts(as = "crate::bindings::Duration")]
        duration: Duration,
        #[ts(as = "crate::bindings::Duration")]
        creator_duration: Duration,
    },
    UpdateLocation {
        talk_id: usize,
        location: Option<usize>,
    },
    AddNoob {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNoob {
        talk_id: usize,
        user_id: usize,
    },
    AddNerd {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNerd {
        talk_id: usize,
        user_id: usize,
    },
    UpdateAttendanceMode {
        user_id: usize,
        attendance_mode: AttendanceMode,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct UserReference {
    pub id: usize,
    pub name: String,
    pub team: String,
    pub attendance_mode: AttendanceMode,
    pub roles: BTreeSet<Role>,
}
