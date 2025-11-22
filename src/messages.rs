use std::{
    collections::{BTreeMap, BTreeSet},
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};

use crate::storage::{AttendanceMode, Role, Talk, User};

/// Authentication command sent by the client.
#[derive(Clone, Debug, Deserialize)]
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
#[derive(Clone, Debug, Serialize)]
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
#[derive(Clone, Debug, Deserialize)]
pub enum Command {
    AddTalk {
        title: String,
        description: String,
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
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        duration: Duration,
    },
    UpdateLocation {
        talk_id: usize,
        location: Option<String>,
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
#[derive(Clone, Debug, Serialize)]
pub enum Update {
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
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        duration: Duration,
    },
    UpdateLocation {
        talk_id: usize,
        location: Option<String>,
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UserReference {
    id: usize,
    name: String,
    team: String,
    attendance_mode: AttendanceMode,
}

impl From<&User> for UserReference {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            team: user.team.clone(),
            attendance_mode: user.attendance_mode,
        }
    }
}
