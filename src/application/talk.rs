use std::time::{Duration, SystemTime};

use async_trait::async_trait;
use sqlx::Error;
use tokio::sync::broadcast::Receiver;

#[async_trait]
pub trait TalkService {
    async fn register_for_updates(&self) -> Receiver<Update>;
    async fn trigger(&self, command: Command) -> Result<(), Error>;
}

pub enum Update {
    AddTalk {
        id: i64,
        creator: User,
        title: String,
        description: String,
        scheduled_at: Option<SystemTime>,
        duration: Duration,
        location: Option<String>,
        nerds: Vec<User>,
        noobs: Vec<User>,
    },
    RemoveTalk {
        id: i64,
    },
    UpdateTitle {
        id: i64,
        title: String,
    },
    UpdateDescription {
        id: i64,
        description: String,
    },
    UpdateScheduledAt {
        id: i64,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        id: i64,
        duration: Duration,
    },
    UpdateLocation {
        id: i64,
        location: Option<String>,
    },
    UpdateNerds {
        id: i64,
        nerds: Vec<User>,
    },
    UpdateNoobs {
        id: i64,
        noobs: Vec<User>,
    },
}

pub enum Command {
    AddTalk {
        title: String,
        description: String,
        duration: Duration,
    },
    RemoveTalk {
        id: i64,
    },
    UpdateTitle {
        id: i64,
        title: String,
    },
    UpdateDescription {
        id: i64,
        description: String,
    },
    UpdateScheduledAt {
        id: i64,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        id: i64,
        duration: Duration,
    },
    UpdateLocation {
        id: i64,
        location: Option<String>,
    },
    TriggerNerd {
        id: i64,
    },
    TriggerNoob {
        id: i64,
    },
}

pub struct User {
    name: String,
    team: String,
}
