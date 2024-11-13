use std::{
    collections::BTreeMap,
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};

use crate::storage::{Talk, User};

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
}

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
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UserReference {
    id: usize,
    name: String,
    team: String,
}

impl From<&User> for UserReference {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            team: user.team.clone(),
        }
    }
}
